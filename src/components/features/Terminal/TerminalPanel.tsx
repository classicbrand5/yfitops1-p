
// src/components/features/Terminal/TerminalPanel.tsx
// Pure React terminal emulator — no external packages required.
// Handles ANSI colors, command history, WebContainer stdin/stdout, multi-tab.

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useLayoutEffect,
} from 'react';
import { useAppStore } from '@/store/useAppStore';
import { isWebContainerReady } from '@/core/webcontainer/webcontainer';
import { isDangerousCommand } from '@/core/webcontainer/process';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// ── ANSI → React spans ────────────────────────────────────────────────────────

const ANSI_COLORS: Record<number, string> = {
  30: '#1e1e2e', 31: '#FF4D6D', 32: '#00F5A0', 33: '#FBBF24',
  34: '#38BDF8', 35: '#9B6EF5', 36: '#00D4D8', 37: '#EEEEFF',
  90: '#5C5C7A', 91: '#FF6B84', 92: '#1AFFB8', 93: '#FCD34D',
  94: '#60CDFF', 95: '#B48EFF', 96: '#1AFFDC', 97: '#FFFFFF',
  // Background colors (40-47 + 100-107) mapped to text for simplicity
  40: '#0C0C12', 41: '#FF4D6D', 42: '#00F5A0', 43: '#FBBF24',
  44: '#38BDF8', 45: '#9B6EF5', 46: '#00D4D8', 47: '#EEEEFF',
};

interface AnsiSpan {
  text: string;
  color?: string;
  bold?: boolean;
  dim?: boolean;
  underline?: boolean;
}

function parseAnsi(raw: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  // Split on ESC sequences
  const parts = raw.split(/(\x1b\[[0-9;]*m)/g);
  let color: string | undefined;
  let bold = false;
  let dim = false;
  let underline = false;

  for (const part of parts) {
    if (part.startsWith('\x1b[') && part.endsWith('m')) {
      const codes = part.slice(2, -1).split(';').map(Number);
      for (const code of codes) {
        if (code === 0) { color = undefined; bold = false; dim = false; underline = false; }
        else if (code === 1) bold = true;
        else if (code === 2) dim = true;
        else if (code === 4) underline = true;
        else if (code === 22) { bold = false; dim = false; }
        else if (code === 24) underline = false;
        else if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
          color = ANSI_COLORS[code];
        }
        else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
          // background — ignore for simplicity
        }
        else if (code === 39) color = undefined;
      }
    } else if (part) {
      spans.push({ text: part, color, bold, dim, underline });
    }
  }

  return spans;
}

// ── TerminalLine ──────────────────────────────────────────────────────────────

interface TerminalLine {
  id: number;
  raw: string;       // raw string with ANSI
  spans: AnsiSpan[]; // parsed
}

let _lineId = 0;
function makeLines(text: string): TerminalLine[] {
  // Split into lines by \r\n, \n, \r
  const segments = text.split(/\r?\n|\r/);
  return segments.map((s) => ({
    id: ++_lineId,
    raw: s,
    spans: parseAnsi(s),
  }));
}

// ── Session state ─────────────────────────────────────────────────────────────

interface TermSession {
  id: string;
  lines: TerminalLine[];
  lineBuffer: string;
  history: string[];     // oldest first
  historyIdx: number;    // -1 = not navigating
  stdin?: WritableStreamDefaultWriter<string>;
  killProcess?: () => void;
  isRunning: boolean;
}

const sessions = new Map<string, TermSession>();

function getOrCreateSession(id: string): TermSession {
  if (!sessions.has(id)) {
    sessions.set(id, {
      id,
      lines: [],
      lineBuffer: '',
      history: [],
      historyIdx: -1,
      isRunning: false,
    });
  }
  return sessions.get(id)!;
}

// ── TerminalOutput ────────────────────────────────────────────────────────────

function SpanEl({ span }: { span: AnsiSpan }) {
  return (
    <span
      style={{
        color: span.color,
        fontWeight: span.bold ? 700 : undefined,
        opacity: span.dim ? 0.5 : undefined,
        textDecoration: span.underline ? 'underline' : undefined,
      }}
    >
      {span.text}
    </span>
  );
}

interface TerminalOutputProps {
  lines: TerminalLine[];
  lineBuffer: string;
  showCursor: boolean;
}

const TerminalOutput = React.memo(function TerminalOutput({
  lines,
  lineBuffer,
  showCursor,
}: TerminalOutputProps) {
  return (
    <div
      style={{
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
        fontSize: 13,
        lineHeight: 1.6,
        color: '#EEEEFF',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        padding: '8px 12px',
        minHeight: '100%',
      }}
      aria-live="polite"
      aria-label="Terminal output"
      role="log"
    >
      {lines.map((line) => (
        <div key={line.id} style={{ minHeight: '1.6em' }}>
          {line.spans.length > 0
            ? line.spans.map((s, i) => <SpanEl key={i} span={s} />)
            : '\u200b'}
        </div>
      ))}
      {/* Input line with cursor */}
      <div style={{ minHeight: '1.6em', display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#00F5A0' }}>$</span>
        <span>&nbsp;</span>
        <span style={{ color: '#EEEEFF' }}>{lineBuffer}</span>
        {showCursor && (
          <span
            style={{
              display: 'inline-block',
              width: '0.55em',
              height: '1.1em',
              background: '#00F5A0',
              marginLeft: 1,
              verticalAlign: 'text-bottom',
              animation: 'term-blink 1s step-end infinite',
            }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
});

// ── TerminalTab ───────────────────────────────────────────────────────────────

interface TerminalTabProps {
  sessionId: string;
  isActive: boolean;
  title: string;
  isRunning: boolean;
  onActivate: () => void;
  onClose: () => void;
}

function TerminalTabEl({ isActive, title, isRunning, onActivate, onClose }: TerminalTabProps) {
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
          <span
            className="flex-shrink-0 animate-pulse"
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#00F5A0' }}
            aria-label="Running"
          />
        )}
        <span className="truncate text-xs">{title}</span>
      </button>
      <button
        className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-sm ml-1"
        style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label={`Close terminal ${title}`}
      >
        ×
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TerminalPanel() {
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, forceRender] = useState(0);
  const [focused, setFocused] = useState(false);
  const [dangerWarning, setDangerWarning] = useState('');

  const {
    terminalSessions,
    activeTerminalId,
    createTerminalSession,
    removeTerminalSession,
    setActiveTerminal,
    appendTerminalOutput,
    agentAutonomy,
  } = useAppStore();

  // Stable force-render callback
  const refresh = useCallback(() => forceRender((n) => n + 1), []);

  // ── Ensure at least one session ──────────────────────────────────────────
  useEffect(() => {
    if (Object.keys(terminalSessions).length === 0) {
      const id = `term-${Date.now()}`;
      createTerminalSession(id, '/');
    }
  }, [createTerminalSession, terminalSessions]); // Added terminalSessions to deps

  // ── Append text to the active session's lines ──────────────────────────
  const appendOutput = useCallback(
    (sessionId: string, text: string) => {
      const sess = getOrCreateSession(sessionId);
      // Handle carriage-return-only lines (overwrite last line)
      // For simplicity we split and append new lines
      const newLines = makeLines(text);
      sess.lines.push(...newLines);
      // Cap at 5000 lines
      if (sess.lines.length > 5000) {
        sess.lines = sess.lines.slice(sess.lines.length - 4500);
      }
      appendTerminalOutput(sessionId, text);
      refresh();
    },
    [appendTerminalOutput, refresh]
  );

  // Write welcome banner on first session creation
  useEffect(() => {
    if (!activeTerminalId) return;
    const sess = getOrCreateSession(activeTerminalId);
    if (sess.lines.length === 0) {
      const banner = [
        '\x1b[32m  ╔══════════════════════════════╗\x1b[0m',
        '\x1b[32m  ║   YFitOps Terminal  v1.0     ║\x1b[0m',
        '\x1b[32m  ╚══════════════════════════════╝\x1b[0m',
        '',
        isWebContainerReady()
          ? '\x1b[32m  ✓ WebContainer ready\x1b[0m — Real sandboxed shell. Type commands and press Enter.'
          : '\x1b[33m  ⚠ WebContainer initializing\x1b[0m — Commands will execute once boot completes.',
        '  \x1b[90mTip: ↑/↓ arrows for history · Ctrl+C to kill · Ctrl+L to clear\x1b[0m',
        '',
      ];
      for (const line of banner) {
        sess.lines.push(...makeLines(line));
      }
      refresh();
    }
  }, [activeTerminalId, refresh]);

  // ── Auto-scroll to bottom when lines change ──────────────────────────────
  useLayoutEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  });

  // ── Run command via WebContainer ────────────────────────────────────────
  const runCommand = useCallback(
    async (cmd: string, sessionId: string) => {
      const sess = getOrCreateSession(sessionId);
      if (!cmd.trim()) return;

      if (!isWebContainerReady()) {
        sess.lines.push(...makeLines('\x1b[33m⚠ WebContainer not initialized — boot the workspace first.\x1b[0m'));
        refresh();
        return;
      }

      if (isDangerousCommand(cmd) && agentAutonomy !== 'full-auto') {
        sess.lines.push(...makeLines(
          `\x1b[31m🚫 Blocked: "${cmd}" — dangerous command. Enable Full-Auto mode to override.\x1b[0m`
        ));
        refresh();
        return;
      }

      const parts = cmd.trim().split(/\s+/);
      const command = parts[0];
      const args = parts.slice(1);

      sess.isRunning = true;
      refresh();

      try {
        const { spawn } = await import('@/core/webcontainer/process');
        const handle = await spawn(command, args, {
          cwd: '/',
          onOutput: (data: string) => {
            appendOutput(sessionId, data);
          },
        });

        sess.stdin = handle.stdin;
        sess.killProcess = () => handle.kill();

        const exitCode = await handle.exitCode;
        sess.stdin = undefined;
        sess.killProcess = undefined;
        sess.isRunning = false;

        if (exitCode !== 0) {
          sess.lines.push(...makeLines(`\x1b[31m[exited ${exitCode}]\x1b[0m`));
        }
        refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        sess.lines.push(...makeLines(`\x1b[31m[Error: ${msg}]\x1b[0m`));
        sess.isRunning = false;
        refresh();
      }
    },
    [appendOutput, refresh, agentAutonomy]
  );

  // ── Key handler ────────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!activeTerminalId) return;
      const sess = getOrCreateSession(activeTerminalId);

      // Ctrl+C — SIGINT
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        if (sess.stdin) {
          void sess.stdin.write('\x03').catch(() => undefined);
        }
        sess.lines.push(...makeLines('^C'));
        sess.lineBuffer = '';
        sess.historyIdx = -1;
        setDangerWarning('');
        refresh();
        return;
      }

      // Ctrl+D — EOF
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        if (sess.stdin) void sess.stdin.write('\x04').catch(() => undefined);
        return;
      }

      // Ctrl+L — clear
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        sess.lines = [];
        refresh();
        return;
      }

      // Enter — submit
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = sess.lineBuffer.trim();

        // Echo the command
        sess.lines.push(...makeLines(`\x1b[32m$\x1b[0m ${sess.lineBuffer}`));
        const prevBuffer = sess.lineBuffer;
        sess.lineBuffer = '';
        sess.historyIdx = -1;
        setDangerWarning('');
        refresh();

        if (cmd) {
          // Add to history (avoid consecutive duplicates)
          if (sess.history.length === 0 || sess.history[sess.history.length - 1] !== cmd) {
            sess.history.push(cmd);
            if (sess.history.length > 100) sess.history.shift();
          }

          // If a process is running, send to stdin
          if (sess.stdin) {
            void sess.stdin.write(prevBuffer + '\n').catch(() => undefined);
          } else {
            void runCommand(cmd, activeTerminalId);
          }
        }
        return;
      }

      // Arrow Up — older history
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (sess.history.length === 0) return;
        if (sess.historyIdx === -1) {
          sess.historyIdx = sess.history.length - 1;
        } else if (sess.historyIdx > 0) {
          sess.historyIdx--;
        }
        sess.lineBuffer = sess.history[sess.historyIdx] ?? '';
        setDangerWarning(isDangerousCommand(sess.lineBuffer) ? sess.lineBuffer : '');
        refresh();
        return;
      }

      // Arrow Down — newer history
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (sess.historyIdx === -1) return;
        if (sess.historyIdx < sess.history.length - 1) {
          sess.historyIdx++;
          sess.lineBuffer = sess.history[sess.historyIdx] ?? '';
        } else {
          sess.historyIdx = -1;
          sess.lineBuffer = '';
        }
        setDangerWarning(isDangerousCommand(sess.lineBuffer) ? sess.lineBuffer : '');
        refresh();
        return;
      }

      // Backspace
      if (e.key === 'Backspace') {
        e.preventDefault();
        sess.lineBuffer = sess.lineBuffer.slice(0, -1);
        setDangerWarning(isDangerousCommand(sess.lineBuffer) ? sess.lineBuffer : '');
        refresh();
        return;
      }
    },
    [activeTerminalId, runCommand, refresh]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!activeTerminalId) return;
      const sess = getOrCreateSession(activeTerminalId);

      // If a process is running, pipe to stdin
      if (sess.stdin) {
        void sess.stdin.write(e.target.value.slice(-1)).catch(() => undefined);
        return;
      }

      sess.lineBuffer = e.target.value;
      setDangerWarning(isDangerousCommand(sess.lineBuffer) ? sess.lineBuffer : '');
      refresh();

      // Keep input in sync by resetting value
      e.target.value = sess.lineBuffer;
    },
    [activeTerminalId, refresh]
  );

  // ── Tab management ────────────────────────────────────────────────────────
  const newSession = useCallback(() => {
    const id = `term-${Date.now()}`;
    createTerminalSession(id, '/');
    toast.success('New terminal session');
  }, [createTerminalSession]);

  const closeSession = useCallback(
    (id: string) => {
      const sess = sessions.get(id);
      if (sess?.killProcess) sess.killProcess();
      sessions.delete(id);
      removeTerminalSession(id);
    },
    [removeTerminalSession]
  );

  const clearTerminal = useCallback(() => {
    if (!activeTerminalId) return;
    const sess = sessions.get(activeTerminalId);
    if (sess) {
      sess.lines = [];
      refresh();
    }
  }, [activeTerminalId, refresh]);

  // Focus the hidden input to capture keyboard events
  const focusInput = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // ── Current session data ──────────────────────────────────────────────────
  const activeSess = activeTerminalId ? getOrCreateSession(activeTerminalId) : null;
  const allSessions = Object.values(terminalSessions);
  const wcReady = isWebContainerReady();

  return (
    <>
      {/* Blink keyframe injected once */}
      <style>{`@keyframes term-blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

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
          {allSessions.map((session) => (
            <TerminalTabEl
              key={session.id}
              sessionId={session.id}
              isActive={session.id === activeTerminalId}
              title={sessions.get(session.id)?.isRunning ? 'bash (running)' : 'bash'}
              isRunning={sessions.get(session.id)?.isRunning ?? false}
              onActivate={() => setActiveTerminal(session.id)}
              onClose={() => closeSession(session.id)}
            />
          ))}

          <button
            className="flex items-center justify-center w-8 h-8 ml-1 rounded transition-all"
            style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
            onClick={newSession}
            aria-label="New terminal session"
            title="New Terminal"
          >
            <Plus size={13} />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-2 pr-2">
            <button
              className="flex items-center justify-center w-7 h-7 rounded transition-all"
              style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onClick={clearTerminal}
              aria-label="Clear terminal"
              title="Clear (Ctrl+L)"
            >
              <Trash2 size={12} />
            </button>

            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs"
              style={{
                background: wcReady ? 'rgba(0,245,160,0.06)' : 'rgba(255,77,109,0.06)',
                border: `1px solid ${wcReady ? 'rgba(0,245,160,0.2)' : 'rgba(255,77,109,0.2)'}`,
                color: wcReady ? 'var(--success)' : 'var(--danger)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
              }}
              aria-live="polite"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: wcReady ? '#00F5A0' : '#FF4D6D', display: 'inline-block' }}
                aria-hidden="true"
              />
              {wcReady ? 'Connected' : 'Initializing…'}
            </div>
          </div>
        </div>

        {/* Output area — click to focus input */}
        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ background: 'var(--bg-void)', cursor: 'text' }}
          onClick={focusInput}
          aria-label="Click to focus terminal input"
        >
          {activeSess && (
            <TerminalOutput
              lines={activeSess.lines}
              lineBuffer={activeSess.lineBuffer}
              showCursor={focused}
            />
          )}
        </div>

        {/* Hidden input — captures keystrokes */}
        <input
          ref={inputRef}
          type="text"
          value={activeSess?.lineBuffer ?? ''}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            position: 'absolute',
            left: -9999,
            top: -9999,
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: 'none',
          }}
          aria-hidden="true"
          tabIndex={-1}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Danger warning */}
        {dangerWarning && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 border-t text-xs flex-shrink-0"
            style={{
              borderColor: 'rgba(255,77,109,0.2)',
              background: 'rgba(255,77,109,0.06)',
              color: 'var(--danger)',
            }}
            role="alert"
          >
            <AlertTriangle size={11} aria-hidden="true" />
            <span>Dangerous command detected — blocked unless Full-Auto mode is active</span>
          </div>
        )}
      </div>
    </>
  );
}
