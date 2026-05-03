// ─────────────────────────────────────────────────────────────
// YFitOps Agent Inference — v3 (multi-provider, SSE streaming)
// Providers: OnSpace AI, Google AI Studio, Groq, OpenRouter,
//            Cloudflare AI, Cerebras, Together AI
// Features: SSE streaming, rate limiting, context trimming,
//           action validation, singleton clients, analytics,
//           typed slash commands, production system prompt.
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── PLAN LIMITS ──────────────────────────────────────────────
const PLAN_LIMITS: Record<string, number> = {
  starter: 500,
  pro: 5000,
  team: 99999,
  enterprise: 99999,
};

// ── MAX CONTEXT SIZE (chars) ─────────────────────────────────
const MAX_CONTEXT_CHARS = 12_000;

// ── CORS ─────────────────────────────────────────────────────
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

// ── MODULE-LEVEL SINGLETON CLIENTS ───────────────────────────
const _supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// ── PROVIDER REGISTRY ────────────────────────────────────────
// Maps provider IDs to their API base URLs and secret env var names.
// For Cloudflare Workers AI, the URL includes the account ID.
interface ProviderConfig {
  baseUrl: string;
  secretKey: string;       // env var name for the API key
  chatPath: string;        // path appended to baseUrl for chat completions
  supportsJsonMode: boolean;
  supportsStream: boolean;
  notes?: string;
}

const PROVIDERS: Record<string, ProviderConfig> = {
  onspace: {
    baseUrl: Deno.env.get('ONSPACE_AI_BASE_URL') ?? '',
    secretKey: 'ONSPACE_AI_API_KEY',
    chatPath: '/chat/completions',
    supportsJsonMode: true,
    supportsStream: true,
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    secretKey: 'GOOGLE_AI_API_KEY',
    chatPath: '/chat/completions',
    supportsJsonMode: false,      // Gemini via OpenAI-compat doesn't enforce JSON mode same way
    supportsStream: true,
    notes: 'Google AI Studio — 1M context, 15 RPM free',
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    secretKey: 'GROQ_API_KEY',
    chatPath: '/chat/completions',
    supportsJsonMode: true,
    supportsStream: true,
    notes: 'Groq Cloud — 600+ tok/s inference, free tier',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    secretKey: 'OPENROUTER_API_KEY',
    chatPath: '/chat/completions',
    supportsJsonMode: false,
    supportsStream: true,
    notes: 'OpenRouter — 200+ models, several free forever',
  },
  cloudflare: {
    baseUrl: `https://api.cloudflare.com/client/v4/accounts/${Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? 'MISSING'}/ai/v1`,
    secretKey: 'CLOUDFLARE_AI_API_KEY',
    chatPath: '/chat/completions',
    supportsJsonMode: false,
    supportsStream: true,
    notes: 'Cloudflare Workers AI — zero cold start, 10k neurons/day free',
  },
  cerebras: {
    baseUrl: 'https://api.cerebras.ai/v1',
    secretKey: 'CEREBRAS_API_KEY',
    chatPath: '/chat/completions',
    supportsJsonMode: true,
    supportsStream: true,
    notes: 'Cerebras — 2000+ tok/s, best for streaming',
  },
  together: {
    baseUrl: 'https://api.together.xyz/v1',
    secretKey: 'TOGETHER_API_KEY',
    chatPath: '/chat/completions',
    supportsJsonMode: true,
    supportsStream: true,
    notes: 'Together AI — $1 free credit, Qwen2.5-Coder best for code',
  },
};

// ── DEFAULT MODELS PER PROVIDER ──────────────────────────────
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
  context?: WorkspaceContext;
  expertMode?: boolean;
  conversationId?: string;
  slashCommand?: SlashCommand;
  stream?: boolean;
  model?: string;
  provider?: string;   // e.g. 'groq', 'google', 'onspace'
}

interface WorkspaceContext {
  openFiles?: string[];
  activeFile?: string;
  fileTree?: unknown;
  terminalOutput?: string;
  pinnedContext?: string[];
  repoInfo?: unknown;
  [key: string]: unknown;
}

interface AgentAction {
  type: 'write_file' | 'edit_file' | 'delete_file' | 'read_file' |
        'run_command' | 'create_dir' | 'search_files' | 'open_pr';
  path?: string;
  content?: string;
  diff?: string;
  command?: string;
  args?: string[];
  explanation: string;
  requiresConfirmation: boolean;
}

// ── CONTEXT TRIMMER ──────────────────────────────────────────
function trimContext(ctx: WorkspaceContext): string {
  const priority: Record<string, unknown> = {};

  if (ctx.pinnedContext?.length) priority.pinnedContext = ctx.pinnedContext;
  if (ctx.activeFile) priority.activeFile = ctx.activeFile;
  if (ctx.openFiles?.length) priority.openFiles = ctx.openFiles.slice(0, 10);
  if (ctx.terminalOutput) {
    const lines = ctx.terminalOutput.split('\n');
    priority.terminalOutput = lines.slice(-50).join('\n');
  }
  if (ctx.repoInfo) priority.repoInfo = ctx.repoInfo;
  if (ctx.fileTree) {
    const treeStr = JSON.stringify(ctx.fileTree);
    priority.fileTree = treeStr.length > 3000
      ? treeStr.slice(0, 3000) + '... [truncated]'
      : ctx.fileTree;
  }

  const full = JSON.stringify(priority, null, 2);
  if (full.length <= MAX_CONTEXT_CHARS) return full;

  delete priority.fileTree;
  if (priority.terminalOutput) {
    const lines = (priority.terminalOutput as string).split('\n');
    priority.terminalOutput = lines.slice(-20).join('\n');
  }
  return JSON.stringify(priority, null, 2).slice(0, MAX_CONTEXT_CHARS) + '\n... [context truncated]';
}

// ── ACTION VALIDATOR ─────────────────────────────────────────
function validateActions(raw: unknown[]): AgentAction[] {
  const REQUIRES_CONFIRMATION: AgentAction['type'][] = ['delete_file', 'open_pr'];
  const valid: AgentAction[] = [];

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const a = item as Record<string, unknown>;

    const type = a.type as AgentAction['type'];
    const validTypes = [
      'write_file','edit_file','delete_file','read_file',
      'run_command','create_dir','search_files','open_pr',
    ];
    if (!validTypes.includes(type)) continue;

    if ((type === 'write_file' || type === 'edit_file') && typeof a.path !== 'string') continue;
    if (type === 'run_command' && typeof a.command !== 'string') continue;
    if (type === 'delete_file' && typeof a.path !== 'string') continue;

    const requiresConfirmation =
      REQUIRES_CONFIRMATION.includes(type) || a.requiresConfirmation === true;

    valid.push({
      type,
      path: typeof a.path === 'string' ? a.path : undefined,
      content: typeof a.content === 'string' ? a.content : undefined,
      diff: typeof a.diff === 'string' ? a.diff : undefined,
      command: typeof a.command === 'string' ? a.command : undefined,
      args: Array.isArray(a.args) ? a.args.map(String) : undefined,
      explanation: typeof a.explanation === 'string' ? a.explanation : `${type} action`,
      requiresConfirmation,
    });
  }

  return valid;
}

// ── SYSTEM PROMPT BUILDER ────────────────────────────────────
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
You MUST respond with ONLY a single valid JSON object. No markdown fences. No preamble. No explanation outside the JSON.

Schema:
{
  "final": "string — your markdown-formatted answer to the user",
  "actions": [
    {
      "type": "write_file | edit_file | delete_file | read_file | run_command | create_dir | search_files | open_pr",
      "path": "string — required for file operations",
      "content": "string — full file content for write_file",
      "diff": "string — unified diff for edit_file (prefer this for small edits)",
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
CONFIRMATION RULES (strictly enforced):
- requiresConfirmation: TRUE  → delete_file, open_pr, git push --force, DROP TABLE, rm -rf
- requiresConfirmation: FALSE → read_file, write_file, edit_file, create_dir, npm install, test runs

CODE RULES:
- Default to TypeScript with strict types
- Always handle errors in async functions
- Use idiomatic code for the detected language/framework

RESPONSE RULES:
- Answer the user's question directly in "final" — no filler phrases
- Never hallucinate file contents — only write what you know is correct
- Use edit_file with unified diff for changes <50 lines; use write_file for full rewrites
- If you cannot complete a task, say why clearly in "final" and return empty actions: []
</rules>

<examples>
User: "Add a console.log to debug the auth flow"
{
  "type": "edit_file",
  "path": "src/hooks/useAuth.ts",
  "diff": "@@ -45,6 +45,7 @@\n   const { data, error } = await supabase.auth.getSession();\n+  console.log('[useAuth] session:', data?.session?.user?.id);\n   if (error) throw error;",
  "explanation": "Add debug log after getSession call",
  "requiresConfirmation": false
}

User: "Delete the old migration file"
{
  "type": "delete_file",
  "path": "supabase/migrations/20240101_old.sql",
  "explanation": "Remove deprecated migration file",
  "requiresConfirmation": true
}
</examples>`;

  const expertNote = expertMode
    ? '\n<expert_mode>Populate "steps.draft" with your step-by-step reasoning before writing "final". Populate "steps.critique" with what could go wrong with your approach.</expert_mode>'
    : '';

  const slashNotes: Record<NonNullable<SlashCommand>, string> = {
    CODE_REVIEW_MODE: `\n<mode_override>CODE REVIEW MODE — Structure "final" as:
## Summary — Quality score X/10 + 2 sentence rationale
## Critical Issues — each with code block and fix suggestion
## Warnings — minor issues
## What's Good — 1-3 genuine strengths
Include edit_file actions for each fix.</mode_override>`,

    EXPLAIN_MODE: `\n<mode_override>EXPLAIN MODE — Structure "final" as:
1. One-sentence TL;DR
2. Step-by-step walkthrough with actual line/function names
3. Gotchas or non-obvious behaviours
No actions needed unless changes are requested.</mode_override>`,

    TEST_MODE: `\n<mode_override>TEST MODE — Generate comprehensive Vitest tests:
1. Happy path
2. Edge cases
3. Error conditions
Return as write_file action creating *.test.ts alongside the source.</mode_override>`,
  };

  const slashNote = slashCommand && slashNotes[slashCommand] ? slashNotes[slashCommand] : '';

  return `${base}${expertNote}${slashNote}

<workspace_context>
${ctx}
</workspace_context>`;
}

// ── RESOLVE PROVIDER + API KEY ────────────────────────────────
function resolveProvider(providerId: string): {
  config: ProviderConfig;
  apiKey: string;
  url: string;
} | null {
  const config = PROVIDERS[providerId];
  if (!config) return null;

  const apiKey = Deno.env.get(config.secretKey);
  if (!apiKey) {
    console.warn(`[agent-inference] Secret ${config.secretKey} not set for provider ${providerId}`);
    return null;
  }

  const url = `${config.baseUrl}${config.chatPath}`;
  return { config, apiKey, url };
}

// ── MAIN HANDLER ─────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const startMs = Date.now();

  try {
    // ── Auth ──────────────────────────────────────────────
    const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
    if (!token) return json({ error: 'Missing token' }, 401);

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    // ── Rate limit ────────────────────────────────────────
    const { data: profile } = await _supabaseAdmin
      .from('profiles')
      .select('plan, ai_requests_used')
      .eq('id', user.id)
      .single();

    if (profile) {
      const plan = profile.plan ?? 'starter';
      const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.starter;
      const used = profile.ai_requests_used ?? 0;

      if (used >= limit) {
        return json({
          error: 'AI request limit reached',
          used, limit, plan,
          upgradeUrl: '/billing',
        }, 429);
      }
    }

    // ── Parse body ─────────────────────────────────────────
    let body: RequestBody;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'Invalid JSON body' }, 400);
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
      return json({ error: 'messages must be a non-empty array' }, 400);
    }

    // ── Resolve provider ───────────────────────────────────
    const resolved = resolveProvider(provider);
    if (!resolved) {
      // Fallback to onspace if requested provider not configured
      const fallback = resolveProvider('onspace');
      if (!fallback) {
        return json({ error: `Provider '${provider}' not configured and no fallback available` }, 500);
      }
      console.warn(`[agent-inference] Provider '${provider}' unavailable, falling back to onspace`);
      Object.assign(resolved ?? {}, fallback);
    }

    const { config, apiKey, url } = resolved!;

    // ── Select model ───────────────────────────────────────
    const selectedModel = model ?? DEFAULT_MODELS[provider] ?? DEFAULT_MODELS.onspace;

    // ── Build prompt ───────────────────────────────────────
    const trimmedCtx = trimContext(context as WorkspaceContext);
    const systemPrompt = buildSystemPrompt(trimmedCtx, expertMode, slashCommand);

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content),
      })),
    ];

    // Build payload — conditionally add response_format for providers that support it
    const aiPayload: Record<string, unknown> = {
      model: selectedModel,
      messages: aiMessages,
      temperature: 0.3,
      max_tokens: 8192,
    };

    if (config.supportsJsonMode) {
      aiPayload.response_format = { type: 'json_object' };
    }

    if (stream && config.supportsStream) {
      aiPayload.stream = true;
    }

    // ── Call AI provider ───────────────────────────────────
    let aiResponse: Response;
    try {
      aiResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          // OpenRouter requires these headers for attribution
          ...(provider === 'openrouter' ? {
            'HTTP-Referer': 'https://yfitops1.pages.dev',
            'X-Title': 'YFitOps AI Agent',
          } : {}),
        },
        body: JSON.stringify(aiPayload),
      });
    } catch (fetchErr) {
      return json({ error: `${provider}: Network error — ${fetchErr}` }, 502);
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => aiResponse.statusText);
      return json({ error: `${provider}: ${aiResponse.status} — ${errText}` }, 502);
    }

    // ── STREAMING PATH ─────────────────────────────────────
    if (stream && aiResponse.body) {
      // Increment usage counter (fire-and-forget)
      _supabaseAdmin
        .from('profiles')
        .update({ ai_requests_used: (profile?.ai_requests_used ?? 0) + 1 })
        .eq('id', user.id)
        .then(() => {})
        .catch(console.error);

      return new Response(aiResponse.body, {
        headers: {
          ...cors,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    // ── NON-STREAMING PATH ─────────────────────────────────
    const aiData = await aiResponse.json();
    const rawContent = aiData?.choices?.[0]?.message?.content ?? '';

    let parsed: { final: string; actions?: unknown[]; steps?: unknown };
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Some providers may not strictly return JSON even with json_object mode
      // Attempt to extract JSON from the response
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
    const latencyMs = Date.now() - startMs;
    const estimatedTokens = Math.round(
      (systemPrompt.length + messages.map((m) => m.content).join('').length) / 4
    );

    // ── Analytics (fire-and-forget) ────────────────────────
    const logAnalytics = async () => {
      try {
        await Promise.all([
          _supabaseAdmin.from('events').insert({
            user_id: user.id,
            event_type: 'ai_request',
            payload: {
              conversationId,
              messageCount: messages.length,
              expertMode,
              actionCount: validatedActions.length,
              actionTypes: validatedActions.map((a) => a.type),
              provider,
              model: selectedModel,
              latencyMs,
              estimatedTokens,
              wasJsonValid: rawContent.trim().startsWith('{'),
            },
          }),
          _supabaseAdmin
            .from('profiles')
            .update({ ai_requests_used: (profile?.ai_requests_used ?? 0) + 1 })
            .eq('id', user.id),
        ]);
      } catch (e) {
        console.error('[agent-inference] analytics failed (non-fatal):', e);
      }
    };

    // Use Deno Deploy's waitUntil if available
    if (typeof (globalThis as Record<string, unknown>).EdgeRuntime !== 'undefined') {
      // @ts-ignore — Deno Deploy global
      EdgeRuntime.waitUntil(logAnalytics());
    } else {
      logAnalytics();
    }

    return json({
      final: parsed.final,
      actions: validatedActions,
      steps: parsed.steps ?? {},
      _meta: { latencyMs, provider, model: selectedModel, estimatedTokens },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[agent-inference] Unhandled error:', message);
    return json({ error: message }, 500);
  }
});
