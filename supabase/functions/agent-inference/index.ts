// supabase/functions/agent-inference/index.ts
// ─────────────────────────────────────────────────────────────
// YFitOps Agent Inference — v4
// Features:
//   • 7 AI providers (OnSpace, Google, Groq, OpenRouter, Cloudflare, Cerebras, Together)
//   • Typed SSE streaming protocol  { t:'token'|'done'|'error' }
//   • Shared _shared/contextTrimmer + _shared/actionValidator modules
//   • Rate limiting per plan, analytics, action validation
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { trimWorkspaceContext } from '../_shared/contextTrimmer.ts';
import { validateActions } from '../_shared/actionValidator.ts';

// ── CORS ─────────────────────────────────────────────────────
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonRes = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

// ── PLAN LIMITS ───────────────────────────────────────────────
const PLAN_LIMITS: Record<string, number> = {
  starter: 500,
  pro: 5000,
  team: 99999,
  enterprise: 99999,
};

// ── MODULE-LEVEL SINGLETON (reused across warm Deno invocations) ──
const adminClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// ── PROVIDER REGISTRY ─────────────────────────────────────────
interface ProviderConfig {
  baseUrl: string;
  secretKey: string;
  chatPath: string;
  supportsJsonMode: boolean;
  extraHeaders?: (req: Request) => Record<string, string>;
}

function buildProviders(): Record<string, ProviderConfig> {
  return {
    onspace: {
      baseUrl: Deno.env.get('ONSPACE_AI_BASE_URL') ?? '',
      secretKey: 'ONSPACE_AI_API_KEY',
      chatPath: '/chat/completions',
      supportsJsonMode: true,
    },
    google: {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      secretKey: 'GOOGLE_AI_API_KEY',
      chatPath: '/chat/completions',
      supportsJsonMode: false,
    },
    groq: {
      baseUrl: 'https://api.groq.com/openai/v1',
      secretKey: 'GROQ_API_KEY',
      chatPath: '/chat/completions',
      supportsJsonMode: true,
    },
    openrouter: {
      baseUrl: 'https://openrouter.ai/api/v1',
      secretKey: 'OPENROUTER_API_KEY',
      chatPath: '/chat/completions',
      supportsJsonMode: false,
      extraHeaders: () => ({
        'HTTP-Referer': 'https://yfitops1.pages.dev',
        'X-Title': 'YFitOps AI Agent',
      }),
    },
    cloudflare: {
      baseUrl: `https://api.cloudflare.com/client/v4/accounts/${
        Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? 'MISSING'
      }/ai/v1`,
      secretKey: 'CLOUDFLARE_AI_API_KEY',
      chatPath: '/chat/completions',
      supportsJsonMode: false,
    },
    cerebras: {
      baseUrl: 'https://api.cerebras.ai/v1',
      secretKey: 'CEREBRAS_API_KEY',
      chatPath: '/chat/completions',
      supportsJsonMode: true,
    },
    together: {
      baseUrl: 'https://api.together.xyz/v1',
      secretKey: 'TOGETHER_AI_API_KEY',
      chatPath: '/chat/completions',
      supportsJsonMode: true,
    },
  };
}

const DEFAULT_MODELS: Record<string, string> = {
  onspace: 'google/gemini-2.5-flash-preview',
  google: 'gemini-2.5-flash-preview',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'deepseek/deepseek-r1:free',
  cloudflare: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  cerebras: 'llama-3.3-70b',
  together: 'Qwen/Qwen2.5-Coder-32B-Instruct',
};

// ── TYPES ─────────────────────────────────────────────────────
type SlashCommand = 'CODE_REVIEW_MODE' | 'EXPLAIN_MODE' | 'TEST_MODE' | null;

interface RequestBody {
  messages: Array<{ role: string; content: string }>;
  context?: Record<string, unknown>;
  expertMode?: boolean;
  conversationId?: string;
  slashCommand?: SlashCommand;
  stream?: boolean;
  model?: string;
  provider?: string;
}

// ── SSE FRAME TYPES ───────────────────────────────────────────
// Every frame sent over the wire is one of these shapes.
// The client switches on the "t" discriminant.
type SseFrame =
  | { t: 'token'; v: string }
  | { t: 'done'; actions: unknown[]; steps: unknown; meta: { model: string; provider: string; latencyMs: number } }
  | { t: 'error'; message: string };

function encodeFrame(frame: SseFrame): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(frame)}\n\n`);
}

const DONE_SENTINEL = new TextEncoder().encode('data: [DONE]\n\n');

// ── SYSTEM PROMPT ─────────────────────────────────────────────
function buildSystemPrompt(
  ctx: string,
  expertMode: boolean,
  slashCommand: SlashCommand,
): string {
  const base = `<identity>
You are YFitOps Agent — an autonomous AI pair-programmer embedded in a browser IDE.
You have full access to the user's WebContainer filesystem and terminal.
Your job: read, write, debug, refactor, and ship code. Be decisive. Be concise.
</identity>

<output_format>
You MUST respond with ONLY a single valid JSON object. No markdown fences. No preamble.

Schema:
{
  "final": "string — your markdown-formatted answer to the user",
  "actions": [
    {
      "type": "write_file | edit_file | delete_file | read_file | run_command | create_dir | search_files | open_pr",
      "path": "string — required for file operations",
      "content": "string — full file content for write_file",
      "diff": "string — unified diff for edit_file (prefer for small edits)",
      "command": "string — required for run_command",
      "args": ["string"],
      "explanation": "string — one sentence plain English",
      "requiresConfirmation": false
    }
  ],
  "steps": {
    "draft": "string — initial thinking (expert mode only)",
    "critique": "string — self-critique (expert mode only)"
  }
}
</output_format>

<rules>
CONFIRMATION RULES:
- requiresConfirmation: TRUE  → delete_file, open_pr, git push --force, DROP TABLE, rm -rf
- requiresConfirmation: FALSE → read_file, write_file, edit_file, create_dir, npm install, tests

CODE RULES:
- Default to TypeScript with strict types
- Always handle errors in async functions
- Use idiomatic code for the detected language/framework

RESPONSE RULES:
- Answer directly in "final" — no filler phrases
- Never hallucinate file contents
- Use edit_file with unified diff for changes < 50 lines; write_file for full rewrites
- If you cannot complete a task, say why clearly and return empty actions: []
</rules>`;

  const expertNote = expertMode
    ? '\n<expert_mode>Populate "steps.draft" with step-by-step reasoning. Populate "steps.critique" with what could go wrong.</expert_mode>'
    : '';

  const slashNotes: Record<NonNullable<SlashCommand>, string> = {
    CODE_REVIEW_MODE: `\n<mode_override>CODE REVIEW MODE — Structure "final" as:
## Summary — Quality score X/10 + 2 sentence rationale
## Critical Issues — each with code block and fix
## Warnings — minor issues
## What's Good — 1-3 genuine strengths
Include edit_file actions for each fix.</mode_override>`,
    EXPLAIN_MODE: `\n<mode_override>EXPLAIN MODE — Structure "final" as:
1. One-sentence TL;DR
2. Step-by-step walkthrough with actual line/function names
3. Gotchas or non-obvious behaviours</mode_override>`,
    TEST_MODE: `\n<mode_override>TEST MODE — Generate comprehensive Vitest tests:
1. Happy path 2. Edge cases 3. Error conditions
Return as write_file action creating *.test.ts alongside the source.</mode_override>`,
  };

  const slashNote =
    slashCommand && slashNotes[slashCommand] ? slashNotes[slashCommand] : '';

  return `${base}${expertNote}${slashNote}

<workspace_context>
${ctx}
</workspace_context>`;
}

// ── STREAMING RESPONSE BUILDER ────────────────────────────────
/**
 * Pipes the upstream AI SSE stream through our own ReadableStream.
 * Extracts text deltas and accumulates for final JSON parse.
 *
 * Upstream format (OpenAI-compatible SSE):
 *   data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}
 *   data: [DONE]
 *
 * Our output format (typed frames):
 *   data: {"t":"token","v":"Hello"}
 *   data: {"t":"done","actions":[...],"steps":{},"meta":{...}}
 *   data: [DONE]
 */
function buildStreamingResponse(
  upstreamBody: ReadableStream<Uint8Array>,
  startMs: number,
  selectedModel: string,
  providerId: string,
): Response {
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = '';
      const reader = upstreamBody
        .pipeThrough(new TextDecoderStream())
        .getReader();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;

            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;

            let chunk: Record<string, unknown>;
            try {
              chunk = JSON.parse(payload);
            } catch {
              continue;
            }

            const delta = (
              chunk?.choices as Array<Record<string, unknown>>
            )?.[0]?.delta as Record<string, unknown> | undefined;
            const content = delta?.content;

            if (typeof content === 'string' && content.length > 0) {
              fullText += content;
              controller.enqueue(encodeFrame({ t: 'token', v: content }));
            }
          }
        }
      } catch (streamErr) {
        controller.enqueue(
          encodeFrame({ t: 'error', message: String(streamErr) }),
        );
        controller.enqueue(DONE_SENTINEL);
        controller.close();
        return;
      }

      // ── Parse accumulated text for actions/steps ──────────
      let actions: unknown[] = [];
      let steps: unknown = {};

      try {
        const parsed = JSON.parse(fullText) as Record<string, unknown>;

        if (parsed.actions !== undefined || parsed.final !== undefined) {
          actions = Array.isArray(parsed.actions) ? parsed.actions : [];
          steps = parsed.steps ?? {};

          // If model streamed raw JSON wrapper instead of plain text,
          // send REPLACE signal so client can strip the JSON chrome.
          if (
            typeof parsed.final === 'string' &&
            fullText.trim().startsWith('{')
          ) {
            controller.enqueue(
              encodeFrame({
                t: 'token',
                v: '\x00REPLACE\x00' + parsed.final,
              }),
            );
          }
        }
      } catch {
        // Model streamed plain markdown — treat as final text
        actions = [];
        steps = {};
      }

      const validatedActions = validateActions(actions);

      controller.enqueue(
        encodeFrame({
          t: 'done',
          actions: validatedActions,
          steps,
          meta: {
            model: selectedModel,
            provider: providerId,
            latencyMs: Date.now() - startMs,
          },
        }),
      );

      controller.enqueue(DONE_SENTINEL);
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      ...cors,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    },
  });
}

// ── MAIN HANDLER ──────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const startMs = Date.now();

  try {
    // ── Auth ───────────────────────────────────────────────
    const token = (req.headers.get('Authorization') ?? '')
      .replace('Bearer ', '')
      .trim();
    if (!token) return jsonRes({ error: 'Missing token' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) return jsonRes({ error: 'Unauthorized' }, 401);

    // ── Rate limit ─────────────────────────────────────────
    const { data: profile } = await adminClient
      .from('profiles')
      .select('plan, ai_requests_used')
      .eq('id', user.id)
      .single();

    const plan = profile?.plan ?? 'starter';
    const used = profile?.ai_requests_used ?? 0;
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;

    if (used >= limit) {
      return jsonRes(
        { error: 'AI request limit reached', used, limit, plan, upgradeUrl: '/billing' },
        429,
      );
    }

    // ── Parse body ─────────────────────────────────────────
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return jsonRes({ error: 'Invalid JSON body' }, 400);
    }

    const {
      messages,
      context = {},
      expertMode = false,
      conversationId,
      slashCommand = null,
      stream = false,
      model,
      provider = 'onspace',
    } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonRes({ error: 'messages must be a non-empty array' }, 400);
    }

    // ── Resolve provider ───────────────────────────────────
    const PROVIDERS = buildProviders();
    let providerId = provider;
    let config = PROVIDERS[providerId];

    if (!config) {
      console.warn(`[agent-inference] Unknown provider '${providerId}', falling back to onspace`);
      providerId = 'onspace';
      config = PROVIDERS.onspace;
    }

    const apiKey = Deno.env.get(config.secretKey);
    if (!apiKey) {
      // Fallback to OnSpace AI if requested provider key is missing
      console.warn(`[agent-inference] Key ${config.secretKey} not set for provider '${providerId}', falling back to onspace`);
      providerId = 'onspace';
      config = PROVIDERS.onspace;
      const fallbackKey = Deno.env.get('ONSPACE_AI_API_KEY');
      if (!fallbackKey) {
        return jsonRes({ error: 'No AI provider configured' }, 500);
      }
    }

    const resolvedApiKey = Deno.env.get(config.secretKey) ?? Deno.env.get('ONSPACE_AI_API_KEY') ?? '';
    const selectedModel = model ?? DEFAULT_MODELS[providerId] ?? DEFAULT_MODELS.onspace;
    const apiUrl = `${config.baseUrl}${config.chatPath}`;

    // ── Build prompt + payload ─────────────────────────────
    const { context: trimmedCtx } = trimWorkspaceContext(context as never);
    const systemPrompt = buildSystemPrompt(trimmedCtx, expertMode, slashCommand);

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content),
      })),
    ];

    const aiPayload: Record<string, unknown> = {
      model: selectedModel,
      messages: aiMessages,
      temperature: 0.3,
      max_tokens: 8192,
      ...(config.supportsJsonMode
        ? { response_format: { type: 'json_object' } }
        : {}),
      ...(stream ? { stream: true } : {}),
    };

    // ── Call AI provider ───────────────────────────────────
    let aiRes: Response;
    try {
      aiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolvedApiKey}`,
          'Content-Type': 'application/json',
          ...(config.extraHeaders ? config.extraHeaders(req) : {}),
        },
        body: JSON.stringify(aiPayload),
      });
    } catch (fetchErr) {
      return jsonRes(
        { error: `${providerId}: Network error — ${fetchErr}` },
        502,
      );
    }

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => aiRes.statusText);
      return jsonRes(
        { error: `${providerId}: ${aiRes.status} — ${errText}` },
        502,
      );
    }

    // ── Fire-and-forget: increment usage + log analytics ──
    const logAsync = async () => {
      try {
        await Promise.all([
          adminClient
            .from('profiles')
            .update({ ai_requests_used: used + 1 })
            .eq('id', user.id),
          adminClient.from('events').insert({
            user_id: user.id,
            event_type: 'ai_request',
            payload: {
              conversationId,
              provider: providerId,
              model: selectedModel,
              stream,
              messageCount: messages.length,
              expertMode,
            },
          }),
        ]);
      } catch (e) {
        console.error('[agent-inference] analytics failed (non-fatal):', e);
      }
    };

    if (typeof (globalThis as Record<string, unknown>).EdgeRuntime !== 'undefined') {
      // @ts-ignore — Deno Deploy global
      EdgeRuntime.waitUntil(logAsync());
    } else {
      logAsync();
    }

    // ── STREAMING PATH ────────────────────────────────────
    if (stream && aiRes.body) {
      return buildStreamingResponse(aiRes.body, startMs, selectedModel, providerId);
    }

    // ── NON-STREAMING PATH (fallback) ─────────────────────
    const aiData = await aiRes.json();
    const rawContent = aiData?.choices?.[0]?.message?.content ?? '';

    let parsed: { final: string; actions?: unknown[]; steps?: unknown };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          parsed = { final: rawContent, actions: [] };
        }
      } else {
        parsed = { final: rawContent, actions: [] };
      }
    }

    if (typeof parsed.final !== 'string') parsed.final = rawContent;
    if (!Array.isArray(parsed.actions)) parsed.actions = [];

    const validatedActions = validateActions(parsed.actions);

    return jsonRes({
      final: parsed.final,
      actions: validatedActions,
      steps: parsed.steps ?? {},
      _meta: {
        latencyMs: Date.now() - startMs,
        provider: providerId,
        model: selectedModel,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[agent-inference] Unhandled error:', msg);
    return jsonRes({ error: msg }, 500);
  }
});
