// src/components/features/Terminal/TerminalPanel.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { isWebContainerReady } from '@/core/webcontainer/webcontainer';
import { isDangerousCommand } from '@/core/webcontainer/process';
import { Plus, Trash2, Maximize2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface TerminalTabProps {
  sessionId: string;
  isActive: boolean;
  title: string;
  isRunning: boolean;
  onActivate: () => void;
  onClose: () => void;
}

function TerminalTab({ sessionId, isActive, title, isRunning, onActivate, onClose }: TerminalTabProps) {
  return (
    <div
      className={`tab-item ${isActive ? 'active' : ''}`}
      role="tab"
      aria-selected={isActive}
      style={{ maxWidth: 180 }}
    >
      <button
        className="flex items-center gap-1.5 flex-1 min-w-0 h-full bg-transparent border-none"
        style={{ color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
        onClick={onActivate}
        aria-label={`Terminal: ${title}`}
      >
        {isRunning && (
          <span className="flex-shrink-0 status-dot-green animate-pulse-glow" style={{ width: 6, height: 6 }} aria-label="Running" />
        )}
        <span className="truncate text-xs">{title}</span>
      </button>
      <button
        className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-sm ml-1"
        style={{ color: 'var(--text-muted)' }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label={`Close terminal ${title}`}
      >
        ×
      </button>
    </div>
  );
}

export function TerminalPanel() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const outputEndRef = useRef<HTMLDivElement>(null);

  const {
    terminalSessions,
    activeTerminalId,
    createTerminalSession,
    removeTerminalSession,
    setActiveTerminal,
    appendTerminalOutput,
    agentAutonomy,
  } = useAppStore();

  const activeSession = activeTerminalId ? terminalSessions[activeTerminalId] : null;

  // Create initial terminal session if none exist
  useEffect(() => {
    if (Object.keys(terminalSessions).length === 0) {
      const id = `term-${Date.now()}`;
      createTerminalSession(id, '/');
    }
  }, []);

  // Scroll to bottom on new output
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.output]);

  function newSession() {
    const id = `term-${Date.now()}`;
    createTerminalSession(id, '/');
    toast.success('New terminal session opened');
  }

  function clearOutput() {
    if (!activeTerminalId) return;
    // Clear by resetting the session output in the store
    const session = terminalSessions[activeTerminalId];
    if (session) {
      // We use appendTerminalOutput with a clear escape sequence
      appendTerminalOutput(activeTerminalId, '\x1bc');
    }
  }

  async function handleCommand(cmd: string) {
    if (!cmd.trim() || !activeTerminalId) return;

    setHistory((h) => [cmd, ...h.slice(0, 99)]);
    setHistoryIdx(-1);
    setInputValue('');

    if (!isWebContainerReady()) {
      appendTerminalOutput(activeTerminalId, `\r\n⚠ WebContainer not initialized. Boot the workspace to run real commands.\r\n`);
      return;
    }

    if (isDangerousCommand(cmd)) {
      if (agentAutonomy !== 'full-auto') {
        appendTerminalOutput(activeTerminalId, `\r\n🚫 Dangerous command blocked: "${cmd}"\r\n   Use Full-Auto mode to override (Settings > AI Agent > Autonomy).\r\n`);
        return;
      }
    }

    appendTerminalOutput(activeTerminalId, `\r\n$ ${cmd}\r\n`);

    try {
      const { spawn } = await import('@/core/webcontainer/process');
      const parts = cmd.trim().split(/\s+/);
      const command = parts[0];
      const args = parts.slice(1);

      const handle = await spawn(command, args, {
        cwd: activeSession?.cwd ?? '/',
        onOutput: (line) => appendTerminalOutput(activeTerminalId, line),
      });

      const exitCode = await handle.exitCode;
      if (exitCode !== 0) {
        appendTerminalOutput(activeTerminalId, `\r\n[exited ${exitCode}]\r\n`);
      } else {
        appendTerminalOutput(activeTerminalId, '\r\n');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      appendTerminalOutput(activeTerminalId, `\r\n[Error: ${msg}]\r\n`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommand(inputValue);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIdx = Math.min(historyIdx + 1, history.length - 1);
      setHistoryIdx(newIdx);
      setInputValue(history[newIdx] ?? '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIdx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(newIdx);
      setInputValue(newIdx === -1 ? '' : (history[newIdx] ?? ''));
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      clearOutput();
    }
  }

  const sessions = Object.values(terminalSessions);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-void)', borderTop: '1px solid var(--border-subtle)' }}
      role="region"
      aria-label="Terminal"
    >
      {/* Tab bar */}
      <div
        className="flex items-center border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-void)', height: 36 }}
        role="tablist"
        aria-label="Terminal sessions"
      >
        {sessions.map((session) => (
          <TerminalTab
            key={session.id}
            sessionId={session.id}
            isActive={session.id === activeTerminalId}
            title={session.title}
            isRunning={session.isRunning}
            onActivate={() => setActiveTerminal(session.id)}
            onClose={() => removeTerminalSession(session.id)}
          />
        ))}

        <button
          className="flex items-center justify-center w-8 h-8 ml-1 rounded transition-all hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
          onClick={newSession}
          aria-label="New terminal session"
          title="New Terminal (Ctrl+`)"
        >
          <Plus size={13} />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Tools */}
        <div className="flex items-center gap-1 pr-2">
          <button
            className="flex items-center justify-center w-7 h-7 rounded transition-all hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
            onClick={clearOutput}
            aria-label="Clear terminal"
            title="Clear (Ctrl+L)"
          >
            <Trash2 size={12} />
          </button>
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs"
            style={{
              background: isWebContainerReady() ? 'rgba(0,245,160,0.06)' : 'rgba(255,77,109,0.06)',
              border: `1px solid ${isWebContainerReady() ? 'rgba(0,245,160,0.2)' : 'rgba(255,77,109,0.2)'}`,
              color: isWebContainerReady() ? 'var(--success)' : 'var(--danger)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
            }}
            aria-live="polite"
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: isWebContainerReady() ? 'var(--success)' : 'var(--danger)' }}
              aria-hidden="true"
            />
            {isWebContainerReady() ? 'Connected' : 'Initializing…'}
          </div>
        </div>
      </div>

      {/* Output area */}
      <div
        className="flex-1 overflow-y-auto p-3"
        style={{ fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 1.6 }}
        role="log"
        aria-live="polite"
        aria-label="Terminal output"
        onClick={() => inputRef.current?.focus()}
      >
        {/* Welcome message */}
        {activeSession && activeSession.output.length === 0 && (
          <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--accent-400)' }}>YFitOps Terminal</span>
            {' '}— Engineering Command Centre
            <br />
            {isWebContainerReady()
              ? <span style={{ color: 'var(--success)' }}>✓ WebContainer ready. Commands execute in a real sandboxed environment.</span>
              : <span style={{ color: 'var(--warning)' }}>⚠ WebContainer initializing — commands will execute once ready.</span>
            }
          </div>
        )}

        {/* Output lines */}
        {activeSession?.output.map((line, i) => (
          <span
            key={i}
            className="block whitespace-pre-wrap break-all"
            style={{ color: 'var(--text-secondary)', fontSize: 13 }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: terminal output
            dangerouslySetInnerHTML={{ __html: line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }}
          />
        ))}

        <div ref={outputEndRef} />
      </div>

      {/* Input prompt */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-t flex-shrink-0"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-void)' }}
      >
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--accent-400)', fontFamily: 'var(--font-mono)' }}>
          {activeSession?.cwd ?? '/'}$
        </span>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent outline-none text-xs"
          style={{
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            caretColor: 'var(--accent-400)',
          }}
          placeholder={isWebContainerReady() ? 'Type a command…' : 'WebContainer initializing…'}
          aria-label="Terminal input"
          autoComplete="off"
          spellCheck={false}
        />
        <span
          className="animate-terminal-cursor"
          style={{ color: 'var(--accent-400)', fontFamily: 'var(--font-mono)', fontSize: 13 }}
          aria-hidden="true"
        >
          █
        </span>
      </div>

      {/* Dangerous command warning */}
      {inputValue && isDangerousCommand(inputValue) && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 border-t text-xs"
          style={{ borderColor: 'rgba(255,77,109,0.2)', background: 'rgba(255,77,109,0.06)', color: 'var(--danger)' }}
          role="alert"
        >
          <AlertTriangle size={11} aria-hidden="true" />
          <span>Dangerous command detected — will be blocked unless Full-Auto mode is active</span>
        </div>
      )}
    </div>
  );
}
