// src/hooks/useTerminal.ts
import { useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { spawn, isDangerousCommand } from '@/core/webcontainer/process';
import { isWebContainerReady } from '@/core/webcontainer/webcontainer';
import { toast } from 'sonner';

export function useTerminal() {
  const {
    terminalSessions,
    activeTerminalId,
    createTerminalSession,
    removeTerminalSession,
    setActiveTerminal,
    appendTerminalOutput,
    setTerminalRunning,
    setTerminalExitCode,
    agentAutonomy,
  } = useAppStore();

  const createSession = useCallback((cwd?: string) => {
    const id = `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    createTerminalSession(id, cwd);
    return id;
  }, [createTerminalSession]);

  const runCommand = useCallback(async (
    sessionId: string,
    command: string,
    args: string[] = [],
    cwd?: string
  ) => {
    const fullCmd = `${command} ${args.join(' ')}`.trim();

    if (isDangerousCommand(fullCmd)) {
      if (agentAutonomy !== 'full-auto') {
        toast.error('Dangerous command blocked', {
          description: `"${fullCmd}" was blocked by the safety gate.`,
        });
        return;
      }
      // In full-auto mode, still warn but allow with explicit confirmation
      toast.warning('Dangerous command detected', {
        description: 'Proceeding only because Full-Auto mode is active.',
      });
    }

    if (!isWebContainerReady()) {
      toast.error('WebContainer not ready', {
        description: 'Cannot run command — workspace is not initialized.',
      });
      return;
    }

    const session = terminalSessions[sessionId];
    if (!session) return;

    setTerminalRunning(sessionId, true);
    appendTerminalOutput(sessionId, `\r\n$ ${fullCmd}\r\n`);

    try {
      const handle = await spawn(command, args, {
        cwd: cwd ?? session.cwd,
        onOutput: (line) => appendTerminalOutput(sessionId, line),
      });

      const exitCode = await handle.exitCode;
      setTerminalExitCode(sessionId, exitCode);
      appendTerminalOutput(sessionId, `\r\n[Process exited with code ${exitCode}]\r\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendTerminalOutput(sessionId, `\r\n[Error: ${msg}]\r\n`);
      setTerminalRunning(sessionId, false);
    }
  }, [terminalSessions, agentAutonomy, appendTerminalOutput, setTerminalRunning, setTerminalExitCode]);

  const closeSession = useCallback((id: string) => {
    removeTerminalSession(id);
  }, [removeTerminalSession]);

  const activeSessions = Object.values(terminalSessions);

  return {
    terminalSessions,
    activeTerminalId,
    activeSessions,
    createSession,
    runCommand,
    closeSession,
    setActiveTerminal,
  };
}
