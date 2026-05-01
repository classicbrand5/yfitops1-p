// supabase/functions/agent-inference/index.ts
// YFitOps AI Agent — Production Edge Function
// Uses OnSpace AI (ONSPACE_AI_API_KEY + ONSPACE_AI_BASE_URL) — already configured

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `You are YFitOps, an autonomous engineering AI agent with world-class software engineering expertise. You help developers write code, manage repositories, run terminal commands, and ship faster.

## Response Format

You MUST ALWAYS respond with valid JSON matching this exact schema:
{
  "final": "<markdown-formatted answer>",
  "actions": [
    {
      "type": "write_file | edit_file | delete_file | read_file | run_command | create_dir",
      "path": "<file path if applicable>",
      "content": "<full file content for write_file>",
      "diff": "<unified diff for edit_file>",
      "command": "<shell command for run_command>",
      "args": ["<arg1>", "<arg2>"],
      "explanation": "<plain English explanation of what this action does>",
      "requiresConfirmation": false
    }
  ],
  "steps": {
    "draft": "<optional: initial thinking in expert mode>",
    "critique": "<optional: self-critique in expert mode>"
  }
}

## Rules
- Set requiresConfirmation to TRUE for: file deletions, force pushes, deployments, destructive DB operations
- Set requiresConfirmation to FALSE for: reads, safe writes, npm install, test runs
- In expert mode, populate the "steps" field with your draft and critique
- Always write TypeScript with strict types unless told otherwise
- Always format code with 2-space indentation
- NEVER return plain text — only valid JSON
- If you cannot complete a task, still return JSON with "final" explaining why and empty "actions"
- For edit_file, use standard unified diff format (--- +++ @@ lines)`;

function validateAgentResponse(raw: unknown): void {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Agent response is not an object');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r['final'] !== 'string') {
    throw new Error('Agent response missing "final" string field');
  }
  if (r['actions'] !== undefined && !Array.isArray(r['actions'])) {
    throw new Error('"actions" must be an array');
  }
}

function jsonError(message: string, status: number): Response {
  console.error(`[agent-inference] ${status}: ${message}`);
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight — ALWAYS first
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  // ── Auth: extract JWT and verify user ──────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError('Missing Authorization header', 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return jsonError('Unauthorized', 401);
  }

  // ── Parse and validate request body ───────────────────────
  let body: {
    messages?: Array<{ role: string; content: string }>;
    conversationId?: string;
    expertMode?: boolean;
    workspaceContext?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { messages, conversationId, expertMode = false, workspaceContext } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonError('messages must be a non-empty array', 400);
  }

  // Validate message roles
  for (const m of messages) {
    if (!m.role || !m.content || typeof m.content !== 'string') {
      return jsonError('Each message must have role and content string', 400);
    }
  }

  // ── AI provider config ─────────────────────────────────────
  const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
  const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

  if (!apiKey || !baseUrl) {
    return jsonError('AI provider not configured — ONSPACE_AI_API_KEY or ONSPACE_AI_BASE_URL missing', 500);
  }

  // ── Build system prompt with context injection ─────────────
  const contextBlock = workspaceContext
    ? `\n\n## Current Workspace Context\n\`\`\`json\n${JSON.stringify(workspaceContext, null, 2)}\n\`\`\``
    : '';

  const expertNote = expertMode
    ? '\n\nEXPERT MODE ACTIVE: Populate the "steps.draft" field with your initial analysis, then "steps.critique" with your self-critique, then provide the refined "final" answer and "actions".'
    : '';

  const fullSystemPrompt = SYSTEM_PROMPT + contextBlock + expertNote;

  const aiMessages = [
    { role: 'system', content: fullSystemPrompt },
    ...messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  ];

  // ── Call AI (OnSpace AI) ───────────────────────────────────
  console.log(`[agent-inference] Calling AI for user=${user.id} conv=${conversationId ?? 'none'} msgs=${messages.length}`);

  let aiResponse: Response;
  try {
    aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-preview',
        messages: aiMessages,
        stream: false,
        temperature: 0.3,
        max_tokens: 8192,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (fetchErr) {
    return jsonError(`OnSpace AI: Network error — ${fetchErr}`, 502);
  }

  if (!aiResponse.ok) {
    const errText = await aiResponse.text().catch(() => aiResponse.statusText);
    return jsonError(`OnSpace AI: ${aiResponse.status} — ${errText}`, 502);
  }

  const aiData = await aiResponse.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };

  if (aiData.error) {
    return jsonError(`OnSpace AI: ${aiData.error.message ?? 'Unknown error'}`, 502);
  }

  const rawContent = aiData?.choices?.[0]?.message?.content;
  if (!rawContent) {
    return jsonError('OnSpace AI returned empty response', 502);
  }

  // ── Parse + validate structured JSON response ──────────────
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return jsonError(`AI returned non-JSON: ${rawContent.slice(0, 200)}`, 502);
  }

  try {
    validateAgentResponse(parsed);
  } catch (err) {
    return jsonError(`Invalid AI response schema: ${err}`, 502);
  }

  // ── Log analytics event (fire-and-forget) ─────────────────
  const supabaseAdmin = createClient(
    supabaseUrl,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    // No auth header — uses service role privileges
  );

  supabaseAdmin.from('events').insert({
    user_id: user.id,
    event_type: 'ai_request',
    payload: {
      conversationId: conversationId ?? null,
      messageCount: messages.length,
      expertMode,
      actionCount: (parsed as Record<string, unknown>)['actions']
        ? ((parsed as Record<string, unknown>)['actions'] as unknown[]).length
        : 0,
    },
  }).then(({ error }) => {
    if (error) console.error('[agent-inference] Analytics log failed:', error.message);
  });

  // ── Return structured response ─────────────────────────────
  return new Response(JSON.stringify(parsed), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
