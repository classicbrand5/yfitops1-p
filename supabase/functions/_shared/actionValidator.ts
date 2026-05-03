// supabase/functions/_shared/actionValidator.ts
// Validates and normalises every action the AI returns.
// Returns only valid, typed actions — drops malformed ones.

type AgentActionType =
  | 'write_file'
  | 'edit_file'
  | 'delete_file'
  | 'read_file'
  | 'run_command'
  | 'create_dir'
  | 'search_files'
  | 'open_pr';

export interface ValidatedAction {
  type: AgentActionType;
  path?: string;
  content?: string;
  diff?: string;
  command?: string;
  args?: string[];
  explanation: string;
  requiresConfirmation: boolean;
}

const ALWAYS_CONFIRM: AgentActionType[] = ['delete_file', 'open_pr'];

const VALID_TYPES: AgentActionType[] = [
  'write_file',
  'edit_file',
  'delete_file',
  'read_file',
  'run_command',
  'create_dir',
  'search_files',
  'open_pr',
];

export function validateActions(raw: unknown[]): ValidatedAction[] {
  const valid: ValidatedAction[] = [];

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const a = item as Record<string, unknown>;

    const type = a.type as AgentActionType;
    if (!VALID_TYPES.includes(type)) continue;

    // Type-specific required field checks
    if (
      (type === 'write_file' || type === 'edit_file') &&
      typeof a.path !== 'string'
    )
      continue;
    if (type === 'run_command' && typeof a.command !== 'string') continue;
    if (type === 'delete_file' && typeof a.path !== 'string') continue;

    // Coerce requiresConfirmation
    const requiresConfirmation =
      ALWAYS_CONFIRM.includes(type) || a.requiresConfirmation === true;

    valid.push({
      type,
      path: typeof a.path === 'string' ? a.path : undefined,
      content: typeof a.content === 'string' ? a.content : undefined,
      diff: typeof a.diff === 'string' ? a.diff : undefined,
      command: typeof a.command === 'string' ? a.command : undefined,
      args: Array.isArray(a.args) ? a.args.map(String) : undefined,
      explanation:
        typeof a.explanation === 'string' ? a.explanation : `${type} action`,
      requiresConfirmation,
    });
  }

  return valid;
}
