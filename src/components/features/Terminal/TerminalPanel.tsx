
// src/components/features/Terminal/TerminalPanel.tsx
// Real xterm.js terminal — multi-tab, WebContainer wired, ANSI color support
// xterm loaded via dynamic import (CDN) so no package.json change needed

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { isWebContainerReady } from '@/core/webcontainer/webcontainer';
import { isDangerousCommand } from '@/core/webcontainer/process';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

// ── xterm types (minimal, for TS without the package installed) ──────────────
interface ITerminal {
  open(el: HTMLElement): void;
  write(data: string): void;
  writeln(data: string): void;
  onData(callback: (data: string) => void): void;
  dispose(): void;
  clear(): void;
  focus(): void;
  cols: number;
  rows: number;
}

interface IFitAddon {
  activate(terminal: ITerminal): void;
  fit(): void;
  dispose(): void;
}

type TerminalLib = {
  Terminal: new (opts: Record<string, unknown>) => ITerminal;
};
type FitAddonLib = {
  FitAddon: new () => IFitAddon;
};

// ── Singleton xterm loader ────────────────────────────────────────────────────
let _xtermLib: TerminalLib | null = null;
let _fitLib: FitAddonLib | null = null;
let _loading: Promise<void> | null = null;

async function loadXterm(): Promise<{ TerminalCtor: TerminalLib['Terminal']; FitAddonCtor: FitAddonLib['FitAddon'] }> {
  if (_xtermLib && _fitLib) {
    return { TerminalCtor: _xtermLib.Terminal, FitAddonCtor: _fitLib.FitAddon };
  }
  if (!_loading) {
    _loading = (async () => {
      // Load from esm.sh — works without package.json changes
      // esm.sh serves with proper CORS headers for crossOriginIsolated environments
      const [xt, fa] = await Promise.all([
        import(/* @vite-ignore */ 'https://esm.sh/@xterm/xterm@5.3.0'),
        import(/* @vite-ignore */ 'https://esm.sh/@xterm/addon-fit@0.8.0'),
      ]);
      _xtermLib = xt as TerminalLib;
      _fitLib = fa as FitAddonLib;

      // Load xterm CSS dynamically
      if (!document.getElementById('xterm-css')) {
        const link = document.createElement('link');
        link.id = 'xterm-css';
        link.rel = 'stylesheet';
        link.href = 'https://esm.sh/@xterm/xterm@5.3.0/css/xterm.css';
        document.head.appendChild(link);
      }
    })();
  }
  await _loading;
  return { TerminalCtor: _xtermLib!.Terminal, FitAddonCtor: _fitLib!.FitAddon };
}

// ── Per-session state ────────────────────────────────────────────────────────
interface XtermSession {
  terminal: ITerminal;
  fitAddon: IFitAddon;
  stdin?: WritableStreamDefaultWriter<string>;
  killProcess?: () => void;
  history: string[];         // command history (newest last)
  historyIdx: number;        // -1 = not navigating
  lineBuffer: string;        // current typed line
}

const xtermSessions = new Map<string, XtermSession>();

// ── Tab component ─────────────────────────────────────────────────────────────
interface TerminalTabProps {
  sessionId: string;
  isActive: boolean;
  title: string;
  isRunning: boolean;
  onActivate: () => void;
  onClose: () => void;
}

function TerminalTab({ isActive, title, isRunning, onActivate, onClose }: TerminalTabProps) {
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
            className="flex-shrink-0 status-dot-green animate-pulse-glow"
            style={{ width: 6, height: 6 }}
            aria-label="Running"
          />
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

// ── Main component ────────────────────────────────────────────────────────────
export function TerminalPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [dangerWarning, setDangerWarning] = useState('');
  const [xtermReady, setXtermReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    terminalSessions,
    activeTerminalId,
    createTerminalSession,
    removeTerminalSession,
    setActiveTerminal,
    appendTerminalOutput,
    agentAutonomy,
  } = useAppStore();

  // ── Create initial session ─────────────────────────────────────────────────
  useEffect(() => {
    if (Object.keys(terminalSessions).length === 0) {
      const id = `term-${Date.now()}`;
      createTerminalSession(id, '/');
    }
  }, [createTerminalSession, terminalSessions]); // Added terminalSessions to deps

  // ── Run a command via WebContainer ────────────────────────────────────────
  const runXtermCommand = useCallback(
    async (cmd: string, sess: XtermSession, term: ITerminal, sessionId: string) => {
      if (!cmd) return;

      if (!isWebContainerReady()) {
        term.writeln('\x1b[33m⚠ WebContainer not initialized — boot the workspace first.\x1b[0m');
        term.write('\x1b[32m$\x1b[0m ');
        return;
      }

      if (isDangerousCommand(cmd)) {
        if (agentAutonomy !== 'full-auto') {
          term.writeln(`\x1b[31m🚫 Blocked: "${cmd}" — dangerous command. Enable Full-Auto mode to override.\x1b[0m`);
          term.write('\x1b[32m$\x1b[0m ');
          return;
        }
      }

      const parts = cmd.trim().split(/\s+/);
      const command = parts[0];
      const args = parts.slice(1);

      try {
        const { spawn } = await import('@/core/webcontainer/process');
        const handle = await spawn(command, args, {
          cwd: '/',
          onOutput: (data: string) => {
            term.write(data);
            appendTerminalOutput(sessionId, data);
          },
        });

        sess.stdin = handle.stdin;
        sess.killProcess = () => handle.kill();

        const exitCode = await handle.exitCode;

        sess.stdin = undefined;
        sess.killProcess = undefined;

        if (exitCode !== 0) {
          term.write(`\r\n\x1b[31m[exited ${exitCode}]\x1b[0m\r\n`);
        } else {
          term.write('\r\n');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        term.writeln(`\x1b[31m[Error: ${msg}]\x1b[0m`);
      }

      term.write('\x1b[32m$\x1b[0m ');
    },
    [appendTerminalOutput, agentAutonomy]
  );

  // ── Boot xterm for the active terminal ────────────────────────────────────
  useEffect(() => {
    if (!activeTerminalId || !containerRef.current) return;

    let mounted = true;

    async function initXterm() {
      if (!containerRef.current || !mounted) return;

      // Reuse existing xterm session
      if (xtermSessions.has(activeTerminalId!)) {
        const sess = xtermSessions.get(activeTerminalId!)!;
        containerRef.current.innerHTML = '';
        sess.terminal.open(containerRef.current);
        sess.fitAddon.fit();
        sess.terminal.focus();
        setXtermReady(true);
        return;
      }

      try {
        const { TerminalCtor, FitAddonCtor } = await loadXterm();
        if (!mounted || !containerRef.current) return;

        const term = new TerminalCtor({
          theme: {
            background: '#060609',
            foreground: '#EEEEFF',
            cursor: '#00F5A0',
            cursorAccent: '#060609',
            black: '#0C0C12',
            red: '#FF4D6D',
            green: '#00F5A0',
            yellow: '#FBBF24',
            blue: '#38BDF8',
            magenta: '#9B6EF5',
            cyan: '#00D4D8',
            white: '#9494B8',
            brightBlack: '#5C5C7A',
            brightRed: '#FF6B84',
            brightGreen: '#1AFFB8',
            brightYellow: '#FCD34D',
            brightBlue: '#60CDFF',
            brightMagenta: '#B48EFF',
            brightCyan: '#1AFFDC',
            brightWhite: '#EEEEFF',
            selectionBackground: 'rgba(124,58,237,0.35)',
          },
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: 13,
          lineHeight: 1.5,
          cursorBlink: true,
          cursorStyle: 'block',
          scrollback: 5000,
          convertEol: true,
          allowTransparency: true,
        });

        const fitAddon = new FitAddonCtor();
        fitAddon.activate(term);

        containerRef.current.innerHTML = '';
        term.open(containerRef.current);
        fitAddon.fit();
        term.focus();

        if (!mounted) return;
        term.writeln('\x1b[38;5;10m  ██╗   ██╗███████╗██╗████████╗ ██████╗ ██████╗ ███████╗\x1b[0m');
        term.writeln('\x1b[38;5;10m  ╚██╗ ██╔╝██╔════╝██║╚══██╔══╝██╔═══██╗██╔══██╗██╔════╝\x1b[0m');
        term.writeln('\x1b[38;5;10m   ╚████╔╝ █████╗  ██║   ██║   ██║   ██║██████╔╝███████╗\x1b[0m');
        term.writeln('\x1b[38;5;10m    ╚██╔╝  ██╔══╝  ██║   ██║   ██║   ██║██╔═══╝ ╚════██║\x1b[0m');
        term.writeln('\x1b[38;5;10m     ██║   ██║     ██║   ██║   ╚██████╔╝██║     ███████║\x1b[0m');
        term.writeln('\x1b[38;5;10m     ╚═╝   ╚═╝     ╚═╝   ╚═╝    ╚═════╝ ╚═╝     ╚══════╝\x1b[0m');
        term.writeln('');
        if (isWebContainerReady()) {
          term.writeln('  \x1b[32m✓ WebContainer ready\x1b[0m — Real sandboxed shell. Type commands and press Enter.');
        } else {
          term.writeln('  \x1b[33m⚠ WebContainer initializing\x1b[0m — Commands will run once boot completes.');
        }
        term.writeln('  \x1b[90mTip: ↑/↓ arrows for history · Ctrl+C to kill · Ctrl+L to clear\x1b[0m');
        term.writeln('');
        term.write('\x1b[32m$\x1b[0m ');

        // Create session object with history support
        const sess: XtermSession = {
          terminal: term,
          fitAddon,
          history: [],
          historyIdx: -1,
          lineBuffer: '',
        };
        xtermSessions.set(activeTerminalId!, sess);

        // ── Input handler ─────────────────────────────────────
        term.onData((data: string) => {
          const code = data.charCodeAt(0);

          // Ctrl+C → SIGINT
          if (code === 3) {
            if (sess.stdin) {
              void sess.stdin.write('\x03').catch(() => undefined);
            }
            term.write('^C\r\n');
            sess.lineBuffer = '';
            sess.historyIdx = -1;
            setDangerWarning('');
            term.write('\x1b[32m$\x1b[0m ');
            return;
          }

          // Ctrl+D → EOF
          if (code === 4) {
            if (sess.stdin) void sess.stdin.write('\x04').catch(() => undefined);
            return;
          }

          // Ctrl+L → clear
          if (code === 12) {
            term.clear();
            term.write('\x1b[32m$\x1b[0m ' + sess.lineBuffer);
            return;
          }

          // If a process is running, forward raw input
          if (sess.stdin) {
            void sess.stdin.write(data).catch(() => undefined);
            return;
          }

          // ── Arrow keys (history navigation) ────────────────
          if (data === '\x1b[A') {
            // Up arrow — older command
            if (sess.history.length === 0) return;
            if (sess.historyIdx === -1) {
              sess.historyIdx = sess.history.length - 1;
            } else if (sess.historyIdx > 0) {
              sess.historyIdx--;
            }
            const entry = sess.history[sess.historyIdx] ?? '';
            // Clear current line and rewrite
            term.write('\x1b[2K\r\x1b[32m$\x1b[0m ' + entry);
            sess.lineBuffer = entry;
            setDangerWarning(isDangerousCommand(entry) ? entry : '');
            return;
          }

          if (data === '\x1b[B') {
            // Down arrow — newer command
            if (sess.historyIdx === -1) return;
            if (sess.historyIdx < sess.history.length - 1) {
              sess.historyIdx++;
              const entry = sess.history[sess.historyIdx] ?? '';
              term.write('\x1b[2K\r\x1b[32m$\x1b[0m ' + entry);
              sess.lineBuffer = entry;
              setDangerWarning(isDangerousCommand(entry) ? entry : '');
            } else {
              // Past the end — clear line
              sess.historyIdx = -1;
              term.write('\x1b[2K\r\x1b[32m$\x1b[0m ');
              sess.lineBuffer = '';
              setDangerWarning('');
            }
            return;
          }

          // Left/Right arrows — ignore (no cursor movement in raw mode)
          if (data === '\x1b[C' || data === '\x1b[D') return;

          // Enter — submit command
          if (data === '\r') {
            term.write('\r\n');
            const cmd = sess.lineBuffer.trim();
            sess.lineBuffer = '';
            sess.historyIdx = -1;
            setDangerWarning('');

            if (cmd) {
              // Add to history (newest last), cap at 100
              if (sess.history.length === 0 || sess.history[sess.history.length - 1] !== cmd) {
                sess.history.push(cmd);
                if (sess.history.length > 100) sess.history.shift();
              }
              void runXtermCommand(cmd, sess, term, activeTerminalId!);
            } else {
              term.write('\x1b[32m$\x1b[0m ');
            }
            return;
          }

          // Backspace
          if (data === '\x7f' || data === '\b') {
            if (sess.lineBuffer.length > 0) {
              sess.lineBuffer = sess.lineBuffer.slice(0, -1);
              term.write('\b \b');
              setDangerWarning(isDangerousCommand(sess.lineBuffer) ? sess.lineBuffer : '');
            }
            return;
          }

          // Printable character
          if (code >= 32) {
            sess.lineBuffer += data;
            term.write(data);
            setDangerWarning(isDangerousCommand(sess.lineBuffer) ? sess.lineBuffer : '');
          }
        });

        setXtermReady(true);
      } catch (err) {
        console.error('[TerminalPanel] Failed to load xterm:', err);
        setLoadError('Failed to load terminal. Check your internet connection.');
        setXtermReady(false);
      }
    }

    void initXterm();

    return () => {
      mounted = false;
    };
  }, [activeTerminalId, runXtermCommand]);

  // ── ResizeObserver ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!panelRef.current) return;
    const obs = new ResizeObserver(() => {
      if (activeTerminalId) {
        const sess = xtermSessions.get(activeTerminalId);
        if (sess) {
          try { sess.fitAddon.fit(); } catch { /* ignore */ }
        }
      }
    });
    obs.observe(panelRef.current);
    return () => obs.disconnect();
  }, [activeTerminalId]);

  // ── Dispose session ───────────────────────────────────────────────────────
  function disposeXtermSession(id: string) {
    const sess = xtermSessions.get(id);
    if (sess) {
      try { sess.terminal.dispose(); } catch { /* ignore */ }
      try { sess.fitAddon.dispose(); } catch { /* ignore */ }
      if (sess.killProcess) sess.killProcess();
      xtermSessions.delete(id);
    }
  }

  // ── Tab management ────────────────────────────────────────────────────────
  const newSession = useCallback(() => {
    const id = `term-${Date.now()}`;
    createTerminalSession(id, '/');
    toast.success('New terminal session');
  }, [createTerminalSession]);

  const closeSession = useCallback((id: string) => {
    disposeXtermSession(id);
    removeTerminalSession(id);
  }, [removeTerminalSession]);

  const clearTerminal = useCallback(() => {
    if (!activeTerminalId) return;
    const sess = xtermSessions.get(activeTerminalId);
    if (sess) sess.terminal.clear();
  }, [activeTerminalId]);

  const sessions = Object.values(terminalSessions);

  return (
    <div
      ref={panelRef}
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
            onClose={() => closeSession(session.id)}
          />
        ))}

        <button
          className="flex items-center justify-center w-8 h-8 ml-1 rounded transition-all hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
          onClick={newSession}
          aria-label="New terminal session"
          title="New Terminal"
        >
          <Plus size={13} />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-2 pr-2">
          <button
            className="flex items-center justify-center w-7 h-7 rounded transition-all hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
            onClick={clearTerminal}
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

      {/* xterm container */}
      <div
        className="flex-1 overflow-hidden relative"
        style={{ background: 'var(--bg-void)' }}
        onClick={() => {
          const sess = activeTerminalId ? xtermSessions.get(activeTerminalId) : undefined;
          if (sess) sess.terminal.focus();
        }}
      >
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ padding: '8px 4px' }}
          role="region"
          aria-label="Terminal output"
        />

        {!xtermReady && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'var(--bg-void)' }}>
            <div className="text-center">
              <div
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-2"
                style={{ borderColor: 'var(--accent-400)' }}
                aria-hidden="true"
              />
              <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Loading terminal…
              </p>
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4" style={{ background: 'var(--bg-void)' }}>
            <AlertTriangle size={20} style={{ color: 'var(--danger)' }} className="mb-2" aria-hidden="true" />
            <p className="text-xs text-center" style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
              {loadError}
            </p>
            <p className="text-xs text-center mt-1" style={{ color: 'var(--text-muted)' }}>
              Terminal requires internet access to load the xterm.js library.
            </p>
          </div>
        )}
      </div>

      {/* Dangerous command warning */}
      {dangerWarning && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 border-t text-xs flex-shrink-0"
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
