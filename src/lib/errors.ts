// src/lib/errors.ts
// YFitOps typed error class hierarchy

import type { AgentAction } from '@/types/agent.types';

export class YFitOpsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'YFitOpsError';
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class WebContainerError extends YFitOpsError {
  constructor(message: string, details?: unknown) {
    super(message, 'WEBCONTAINER_ERROR', details);
    this.name = 'WebContainerError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FilesystemError extends YFitOpsError {
  constructor(message: string, path: string) {
    super(message, 'FILESYSTEM_ERROR', { path });
    this.name = 'FilesystemError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AgentExecutionError extends YFitOpsError {
  constructor(message: string, action: AgentAction) {
    super(message, 'AGENT_EXECUTION_ERROR', { action });
    this.name = 'AgentExecutionError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BackendUnavailableError extends YFitOpsError {
  constructor(url: string) {
    super(`Backend unavailable: ${url}`, 'BACKEND_UNAVAILABLE', { url });
    this.name = 'BackendUnavailableError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthError extends YFitOpsError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DangerousCommandError extends YFitOpsError {
  constructor(command: string) {
    super(`Blocked dangerous command: ${command}`, 'DANGEROUS_COMMAND', { command });
    this.name = 'DangerousCommandError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function formatError(err: unknown): string {
  if (err instanceof YFitOpsError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
