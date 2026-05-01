
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
  onKey(callback: (e: { key: string; domEvent: KeyboardEvent }) => void): void;
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

// ── Per-session xterm state ───────────────────────────────────────────────────
interface XtermSession {
  terminal: ITerminal;
  fitAddon: IFitAddon;
  stdin?: WritableStreamDefaultWriter<string>;
  killProcess?: () => void;
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
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [inputValue, setInputValue] = useState(''); // This state is not directly used for xterm input, but for the warning overlay
  const [xtermReady, setXtermReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The original code had `activeInputValueRef` but it was not used. Removing it to prevent lint warnings
  // const activeInputValueRef = useRef('');

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

  // ── Create initial session ─────────────────────────────────────────────────
  useEffect(() => {
    if (Object.keys(terminalSessions).length === 0) {
      const id = `term-${Date.now()}`;
      createTerminalSession(id, '/');
    }
  }, [createTerminalSession, terminalSessions]); // Add dependencies for useEffect

  // ── Boot xterm for the active terminal ────────────────────────────────────
  useEffect(() => {
    if (!activeTerminalId || !containerRef.current) return;

    let mounted = true;

    async function initXterm() {
      if (!containerRef.current || !mounted) return;

      // Reuse existing xterm session if already created for this id
      if (xtermSessions.has(activeTerminalId!)) {
        const sess = xtermSessions.get(activeTerminalId!)!;
        // Remount into the current container
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
          letterSpacing: 0,
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

        // Write welcome banner
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
        term.writeln('');

        // Store the session
        const sess: XtermSession = { terminal: term, fitAddon };
        xtermSessions.set(activeTerminalId!, sess);

        // Handle user input — buffer line, send on Enter
        let lineBuffer = '';

        term.onData((data: string) => {
          setInputValue(lineBuffer + data); // Update inputValue state for the warning overlay
          const code = data.charCodeAt(0);

          // Ctrl+C → send SIGINT
          if (code === 3) {
            if (sess.stdin) {
              void sess.stdin.write('\x03').catch(() => undefined);
            }
            term.write('^C\r\n');
            lineBuffer = '';
            setInputValue(''); // Clear inputValue on Ctrl+C
            return;
          }

          // Ctrl+D → send EOF
          if (code === 4) {
            if (sess.stdin) {
              void sess.stdin.write('\x04').catch(() => undefined);
            }
            return;
          }

          // Ctrl+L → clear
          if (code === 12) {
            term.clear();
            return;
          }

          // If we have a running process, forward raw input directly
          if (sess.stdin) {
            void sess.stdin.write(data).catch(() => undefined);
            return;
          }

          // Otherwise, line-edit mode (echo locally)
          if (data === '\r') {
            // Enter — run the command
            term.write('\r\n');
            const cmd = lineBuffer.trim();
            lineBuffer = '';
            setInputValue(''); // Clear inputValue on Enter
            if (cmd) {
              void runXtermCommand(cmd, sess, term, activeTerminalId!);
            } else {
              term.write('\x1b[32m$\x1b[0m ');
            }
          } else if (data === '\x7f' || data === '\b') {
            // Backspace
            if (lineBuffer.length > 0) {
              lineBuffer = lineBuffer.slice(0, -1);
              term.write('\b \b');
            }
          } else if (data === '\x1b[A' || data === '\x1b[B') {
            // Arrow up/down — ignore for now (no history in raw mode)
          } else if (code >= 32) {
            // Printable character
            lineBuffer += data;
            term.write(data);
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
  }, [activeTerminalId, appendTerminalOutput, agentAutonomy]); // Add dependencies for useEffect

  // ── Replay buffered store output to xterm ─────────────────────────────────
  // When store has output lines (from agent executor), flush them to xterm
  useEffect(() => {
    if (!activeTerminalId || !activeSession) return;
    const sess = xtermSessions.get(activeTerminalId);
    if (!sess) return;

    // Flush any output that arrived before xterm was ready
    // Only flush if xterm is open (containerRef has content)
    if (activeSession.output.length > 0) {
      // The original code was only writing the last line. If the intent is to replay ALL buffered output,
      // a loop should be used. Assuming the current logic is to just ensure the _latest_ state is reflected.
      // If `activeSession.output` is an array of lines, a loop might be more appropriate here:
      // activeSession.output.forEach(line => sess.terminal.write(line));
      const lastLine = activeSession.output[activeSession.output.length - 1];
      if (lastLine) { // Check if lastLine exists before writing
        sess.terminal.write(lastLine);
      }
    }
  }, [activeTerminalId, activeSession]); // Removed eslint-disable-line directive and added explicit dependencies

  // ── ResizeObserver for fit ────────────────────────────────────────────────
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
    resizeObserverRef.current = obs;
    return () => obs.disconnect();
  }, [activeTerminalId]);

  // ── Dispose xterm when tab is removed ─────────────────────────────────────
  function disposeXtermSession(id: string) {
    const sess = xtermSessions.get(id);
    if (sess) {
      try { sess.terminal.dispose(); } catch { /* ignore */ }
      try { sess.fitAddon.dispose(); } catch { /* ignore */ }
      if (sess.killProcess) sess.killProcess();
      xtermSessions.delete(id);
    }
  }

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

        // Store stdin writer and kill for Ctrl+C
        sess.stdin = handle.stdin;
        sess.killProcess = () => handle.kill();

        const exitCode = await handle.exitCode;

        // Clear stdin now that process exited
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
    if (sess) {
      sess.terminal.clear();
    }
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

        {/* Status + clear */}
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
        {/* The actual xterm.js mount point */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ padding: '8px 4px' }}
          role="region"
          aria-label="Terminal output"
        />

        {/* Loading state while xterm is being fetched */}
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

        {/* Error state */}
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

      {/* Dangerous command warning overlay (for typed input that we can observe) */}
      {inputValue && isDangerousCommand(inputValue) && (
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
