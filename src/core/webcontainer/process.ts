// src/core/webcontainer/process.ts
// Real WebContainer process spawn — with dangerous command gate

import { getWebContainerSync } from './webcontainer';
import { DangerousCommandError } from '@/lib/errors';
import type { ProcessHandle } from './types';

// Commands that could destroy the workspace or exfiltrate data
const DANGEROUS_PATTERNS: RegExp[] = [
  /\brm\s+-rf\s+\/\b/,
  /\brm\s+-rf\s+\*\b/,
  /\bsudo\s+rm\b/,
  /\bdd\s+if=/,
  /\bmkfs\b/,
  /\bformat\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\bhalt\b/,
  /\bpoweroff\b/,
  /:\(\)\{.*:\|:&\};:/, // fork bomb
  /\bchmod\s+-R\s+777\s+\/\b/,
  /\bcurl.*\|\s*(ba)?sh\b/,
  /\bwget.*\|\s*(ba)?sh\b/,
];

export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(command));
}

function generateId(): string {
  return `proc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type WebContainerProcess = {
  output: ReadableStream<string>;
  input: WritableStream<string>;
  exit: Promise<number>;
  kill: () => void;
};

type WC = {
  spawn(
    command: string,
    args: string[],
    options?: { cwd?: string; terminal?: { cols: number; rows: number } }
  ): Promise<WebContainerProcess>;
};

export async function spawn(
  command: string,
  args: string[],
  options: { cwd?: string; onOutput: (line: string) => void }
): Promise<ProcessHandle> {
  const fullCommand = `${command} ${args.join(' ')}`.trim();

  if (isDangerousCommand(fullCommand)) {
    throw new DangerousCommandError(fullCommand);
  }

  const wc = getWebContainerSync() as WC;
  const process = await wc.spawn(command, args, {
    cwd: options.cwd ?? '/',
    terminal: { cols: 120, rows: 40 },
  });

  // Pipe output
  const reader = process.output.getReader();
  (async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        options.onOutput(value);
      }
    } catch {
      // Stream ended or process killed — not an error
    }
  })();

  return {
    id: generateId(),
    exitCode: process.exit,
    kill: () => process.kill(),
    stdin: process.input.getWriter(),
  };
}
