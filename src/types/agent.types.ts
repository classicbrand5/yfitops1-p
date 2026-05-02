// src/types/agent.types.ts
// Strict TypeScript types for the YFitOps AI Agent system

export type AgentActionType =
  | 'read_file'
  | 'write_file'
  | 'edit_file'
  | 'delete_file'
  | 'create_dir'
  | 'run_command'
  | 'search_files'
  | 'open_pr';

export type AgentActionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'done'
  | 'failed';

export interface AgentAction {
  type: AgentActionType;
  path?: string;
  content?: string;
  diff?: string;
  command?: string;
  args?: string[];
  query?: string;
  explanation: string;
  requiresConfirmation: boolean;
  status: AgentActionStatus;
  result?: ActionResult;
}

export interface AgentStep {
  draft?: string;
  critique?: string;
}

export interface AgentResponse {
  final: string;
  actions?: AgentAction[];
  steps?: AgentStep;
}

export interface ActionResult {
  success: boolean;
  output?: string;
  error?: string;
  changedPaths?: string[];
  exitCode?: number;
}

export type AgentAutonomy = 'ask' | 'auto-safe' | 'full-auto';

export interface AgentContext {
  includeGitHistory: boolean;
  includeOpenFiles: boolean;
  includeBuildStatus: boolean;
  includeTerminalOutput: boolean;
  maxContextLines: number;
}

export function validateAgentResponse(raw: unknown): AgentResponse {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Agent response is not an object');
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.final !== 'string') {
    throw new Error('Agent response missing "final" string field');
  }
  if (r.actions !== undefined && !Array.isArray(r.actions)) {
    throw new Error('"actions" must be an array');
  }
  return r as unknown as AgentResponse;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  actions?: AgentAction[];
  executionResults?: ActionResult[];
  steps?: AgentStep;  // Expert mode reasoning steps
  error?: string;
}

export interface ConversationMeta {
  id: string;
  title: string;
  category: string;
  repoId?: string;
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}
