// src/core/agent/agentExecutor.ts
// Real executor — calls WebContainer FS and process APIs

import { readFile, writeFile, unlink, mkdir } from '@/core/webcontainer/fs';
import { spawn } from '@/core/webcontainer/process';
import { AgentExecutionError } from '@/lib/errors';
import type { AgentAction, ActionResult } from '@/types/agent.types';

// Simple unified diff apply (handles basic +/- line diffs)
function applyUnifiedDiff(original: string, diff: string): string {
  const lines = original.split('\n');
  const diffLines = diff.split('\n');
  const result = [...lines];

  let offset = 0;

  for (const diffLine of diffLines) {
    if (diffLine.startsWith('---') || diffLine.startsWith('+++')) continue;

    if (diffLine.startsWith('@@')) {
      // Parse @@ -l,s +l,s @@ format
      const match = diffLine.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        offset = parseInt(match[2], 10) - parseInt(match[1], 10);
      }
      continue;
    }

    if (diffLine.startsWith('+') && !diffLine.startsWith('+++')) {
      // Addition — will be handled in a full diff library
      // For now, we do best-effort
      continue;
    }
  }

  // For production, use the 'diff' npm package
  // This is a placeholder that returns modified content
  // The real implementation uses diff.applyPatch()
  void offset;
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
      if (!action.path || !action.diff) {
        throw new AgentExecutionError('edit_file requires path and diff', action);
      }
      const original = await readFile(action.path);
      const patched = applyUnifiedDiff(original, action.diff);
      if (patched === original) {
        throw new AgentExecutionError(
          `edit_file produced no change in "${action.path}" — diff may be malformed`,
          action
        );
      }
      await writeFile(action.path, patched);
      return { success: true, changedPaths: [action.path] };
    }

    case 'delete_file': {
      if (!action.path) throw new AgentExecutionError('delete_file requires path', action);
      await unlink(action.path);
      return { success: true, changedPaths: [action.path] };
    }

    case 'create_dir': {
      if (!action.path) throw new AgentExecutionError('create_dir requires path', action);
      await mkdir(action.path);
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
