// src/core/agent/agentExecutor.ts
// Real executor — calls WebContainer FS and process APIs

import { readFile, writeFile, unlink, mkdir } from '@/core/webcontainer/fs';
import { spawn } from '@/core/webcontainer/process';
import { AgentExecutionError } from '@/lib/errors';
import type { AgentAction, ActionResult } from '@/types/agent.types';

// Auto-create parent directories for a given file path
async function ensureParentDirs(filePath: string): Promise<void> {
  const segments = filePath.split('/').filter(Boolean);
  segments.pop(); // remove filename
  if (segments.length === 0) return;

  let current = '';
  for (const seg of segments) {
    current += '/' + seg;
    try {
      await mkdir(current);
    } catch {
      // Directory already exists — ignore
    }
  }
}

// Apply unified diff — real implementation using hunk parsing
function applyUnifiedDiff(original: string, patch: string): string {
  const originalLines = original.split('\n');
  const result: string[] = [];
  const patchLines = patch.split('\n');

  let origIdx = 0;
  let i = 0;

  while (i < patchLines.length) {
    const line = patchLines[i];

    // Skip file headers
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ') || line.startsWith('index ')) {
      i++;
      continue;
    }

    // Hunk header: @@ -l,s +l,s @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        const origStart = parseInt(match[1], 10) - 1; // 0-indexed

        // Copy unchanged lines up to hunk start
        while (origIdx < origStart && origIdx < originalLines.length) {
          result.push(originalLines[origIdx++]);
        }
      }
      i++;
      continue;
    }

    if (line.startsWith(' ')) {
      // Context line — keep
      result.push(originalLines[origIdx] ?? line.slice(1));
      origIdx++;
    } else if (line.startsWith('-')) {
      // Removed line — skip
      origIdx++;
    } else if (line.startsWith('+')) {
      // Added line — insert
      result.push(line.slice(1));
    } else if (line === '\\ No newline at end of file') {
      // Ignore
    } else {
      // Unknown — keep as-is context
      if (origIdx < originalLines.length) {
        result.push(originalLines[origIdx++]);
      }
    }
    i++;
  }

  // Append remaining original lines after last hunk
  while (origIdx < originalLines.length) {
    result.push(originalLines[origIdx++]);
  }

  return result.join('\n');
}

export async function executeAction(
  action: AgentAction,
  onOutput: (line: string) => void
): Promise<ActionResult> {
  switch (action.type) {
    case 'read_file': {
      if (!action.path) throw new AgentExecutionError('read_file requires path', action);
      const content = await readFile(action.path);
      return { success: true, output: content };
    }

    case 'write_file': {
      if (!action.path || action.content === undefined) {
        throw new AgentExecutionError('write_file requires path and content', action);
      }
      // Auto-create parent directories so nested paths don't ENOENT
      await ensureParentDirs(action.path);
      await writeFile(action.path, action.content);
      // Verify the write actually happened
      const written = await readFile(action.path);
      if (written !== action.content) {
        throw new AgentExecutionError(
          `write_file verification failed for "${action.path}" — content mismatch`,
          action
        );
      }
      return { success: true, changedPaths: [action.path] };
    }

    case 'edit_file': {
      if (!action.path) {
        throw new AgentExecutionError('edit_file requires path', action);
      }
      const original = await readFile(action.path);

      // If a unified diff is provided, try patching
      if (action.diff) {
        const patched = applyUnifiedDiff(original, action.diff);
        if (patched !== original) {
          await writeFile(action.path, patched);
          return { success: true, changedPaths: [action.path] };
        }
        // Diff produced no change — fall through to content replacement if available
        onOutput(`[edit_file] Diff produced no change in "${action.path}" — trying content replacement\n`);
      }

      // Fallback: if agent provided full new content, use it
      if (action.content !== undefined && action.content !== original) {
        await writeFile(action.path, action.content);
        return { success: true, changedPaths: [action.path] };
      }

      throw new AgentExecutionError(
        `edit_file produced no change in "${action.path}" — diff malformed and no content fallback provided`,
        action
      );
    }

    case 'delete_file': {
      if (!action.path) throw new AgentExecutionError('delete_file requires path', action);
      await unlink(action.path);
      return { success: true, changedPaths: [action.path] };
    }

    case 'create_dir': {
      if (!action.path) throw new AgentExecutionError('create_dir requires path', action);
      await mkdir(action.path); // mkdir already uses { recursive: true } in fs.ts
      return { success: true, changedPaths: [action.path] };
    }

    case 'run_command': {
      if (!action.command) throw new AgentExecutionError('run_command requires command', action);
      const outputLines: string[] = [];
      const handle = await spawn(action.command, action.args ?? [], {
        onOutput: (line) => {
          outputLines.push(line);
          onOutput(line);
        },
      });
      const exitCode = await handle.exitCode;
      if (exitCode !== 0) {
        throw new AgentExecutionError(
          `Command "${action.command}" exited with code ${exitCode}`,
          action
        );
      }
      return { success: true, exitCode, output: outputLines.join('') };
    }

    default: {
      const exhaustive: never = action.type;
      throw new AgentExecutionError(`Unknown action type: ${exhaustive}`, action);
    }
  }
}

export async function executeActions(
  actions: AgentAction[],
  options: {
    autonomy: 'ask' | 'auto-safe' | 'full-auto';
    onOutput: (line: string) => void;
    onActionStatus: (idx: number, status: AgentAction['status'], result?: ActionResult) => void;
    requestConfirmation: (action: AgentAction) => Promise<boolean>;
  }
): Promise<void> {
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];

    const needsConfirm =
      action.requiresConfirmation ||
      options.autonomy === 'ask' ||
      (options.autonomy === 'auto-safe' && action.type === 'delete_file');

    if (needsConfirm) {
      const approved = await options.requestConfirmation(action);
      if (!approved) {
        options.onActionStatus(i, 'rejected');
        continue;
      }
    }

    options.onActionStatus(i, 'executing');

    try {
      const result = await executeAction(action, options.onOutput);
      options.onActionStatus(i, 'done', result);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      options.onActionStatus(i, 'failed', { success: false, error });
      throw err;
    }
  }
}
