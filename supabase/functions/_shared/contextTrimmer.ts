// supabase/functions/_shared/contextTrimmer.ts
// Trims workspace context to fit within token budget
// Priority: pinnedContext > activeFile > openFiles > terminalOutput > fileTree

const MAX_CONTEXT_CHARS = 12_000;

interface WorkspaceContext {
  openFiles?: string[];
  activeFile?: string;
  fileTree?: unknown;
  terminalOutput?: string;
  pinnedContext?: string[];
  repoInfo?: unknown;
  [key: string]: unknown;
}

export function trimWorkspaceContext(ctx: WorkspaceContext): { context: string } {
  const priority: Record<string, unknown> = {};

  // Always include pinned context — user-selected
  if (ctx.pinnedContext?.length) {
    priority.pinnedContext = ctx.pinnedContext;
  }

  // Active file is highest signal
  if (ctx.activeFile) priority.activeFile = ctx.activeFile;

  // Open tabs (just the paths)
  if (ctx.openFiles?.length) {
    priority.openFiles = ctx.openFiles.slice(0, 10);
  }

  // Recent terminal output (tail 50 lines max)
  if (ctx.terminalOutput) {
    const lines = ctx.terminalOutput.split('\n');
    priority.terminalOutput = lines.slice(-50).join('\n');
  }

  // Repo info
  if (ctx.repoInfo) priority.repoInfo = ctx.repoInfo;

  // File tree: truncated to 3000 chars
  if (ctx.fileTree) {
    const treeStr = JSON.stringify(ctx.fileTree);
    priority.fileTree =
      treeStr.length > 3000
        ? treeStr.slice(0, 3000) + '... [truncated]'
        : ctx.fileTree;
  }

  const full = JSON.stringify(priority, null, 2);
  if (full.length <= MAX_CONTEXT_CHARS) return { context: full };

  // If still too large: drop fileTree, truncate terminal further
  delete priority.fileTree;
  if (priority.terminalOutput) {
    const lines = (priority.terminalOutput as string).split('\n');
    priority.terminalOutput = lines.slice(-20).join('\n');
  }

  return {
    context:
      JSON.stringify(priority, null, 2).slice(0, MAX_CONTEXT_CHARS) +
      '\n... [context truncated]',
  };
}
