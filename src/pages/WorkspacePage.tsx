// src/pages/WorkspacePage.tsx — Phase 3: real WebContainer boot UI + layout modes
import React, { Suspense, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { SplitLayout } from '@/components/layout/SplitLayout';
import { FileExplorer } from '@/components/features/FileExplorer/FileExplorer';
import { CodeEditor } from '@/components/features/Editor/CodeEditor';
import { TerminalPanel } from '@/components/features/Terminal/TerminalPanel';
import { AgentChat } from '@/components/features/AgentChat/AgentChat';
import { useAppStore } from '@/store/useAppStore';
import { useWebContainer } from '@/hooks/useWebContainer';
import { PanelErrorBoundary } from '@/components/ui/PanelErrorBoundary'; // Phase 2 fix: per-panel error boundaries
import { Zap, RefreshCw, AlertTriangle } from 'lucide-react';

// ── WebContainer boot overlay ──────────────────────────────
function BootOverlay() {
  const { status, error, progress, boot } = useWebContainer();

  if (status === 'ready') return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(6,6,9,0.85)', backdropFilter: 'blur(8px)' }}
      aria-live="polite"
      aria-label="WebContainer loading"
    >
      <div
        className="glass rounded-2xl p-8 max-w-sm w-full mx-4 text-center"
        style={{ border: '1px solid var(--border-accent)' }}
      >
        {status === 'error' ? (
          <>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(255,77,109,0.12)', border: '1px solid rgba(255,77,109,0.25)' }}
            >
              <AlertTriangle size={22} style={{ color: 'var(--danger)' }} aria-hidden="true" />
            </div>
            <h3 className="font-display text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              WebContainer Error
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {error ?? 'Failed to start the runtime environment.'}
            </p>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              Make sure your browser supports WebContainers (Chrome/Edge recommended) and cross-origin isolation is enabled.
            </p>
            <button
              className="btn-accent w-full flex items-center justify-center gap-2"
              onClick={() => void boot()}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Retry
            </button>
          </>
        ) : (
          <>
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-glow"
              style={{ background: 'var(--accent-glow)', border: '1px solid var(--border-accent)' }}
            >
              <Zap size={22} style={{ color: 'var(--accent-400)' }} aria-hidden="true" />
            </div>
            <h3 className="font-display text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Starting Workspace
            </h3>
            <p className="text-xs mb-6" style={{ color: 'var(--text-muted)' }}>
              {progress.step || 'Initializing WebContainer runtime…'}
            </p>

            {/* Progress bar */}
            <div
              className="w-full rounded-full overflow-hidden mb-2"
              style={{ height: 4, background: 'var(--bg-overlay)' }}
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Boot progress: ${progress.percent}%`}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress.percent}%`,
                  background: 'linear-gradient(90deg, var(--accent-500), var(--accent-400))',
                  boxShadow: '0 0 8px rgba(0,245,160,0.5)',
                }}
              />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {progress.percent}%
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg-base)' }}>
      <div className="text-center">
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-2"
          style={{ borderColor: 'var(--accent-400)' }}
          aria-hidden="true"
        />
        <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
          Loading {label}…
        </p>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const { layoutMode, rightPanelWidth } = useAppStore();
  const { status, boot } = useWebContainer();

  useEffect(() => {
    if (status === 'idle') void boot();
  }, []);

  function renderLayout() {
    switch (layoutMode) {
      case 'editor-only':
        return (
          <div className="flex h-full overflow-hidden">
            <div className="w-56 flex-shrink-0" style={{ borderRight: '1px solid var(--border-subtle)' }}>
              {/* Phase 2 fix: FileExplorer wrapped in PanelErrorBoundary */}
              <PanelErrorBoundary panelName="Explorer">
                <FileExplorer />
              </PanelErrorBoundary>
            </div>
            <div className="flex-1 overflow-hidden">
              {/* Phase 2 fix: CodeEditor wrapped in PanelErrorBoundary */}
              <PanelErrorBoundary panelName="Editor">
                <CodeEditor />
              </PanelErrorBoundary>
            </div>
          </div>
        );

      case 'terminal-only':
        return (
          // Phase 2 fix: TerminalPanel wrapped in PanelErrorBoundary
          <PanelErrorBoundary panelName="Terminal">
            <TerminalPanel />
          </PanelErrorBoundary>
        );

      case 'chat-only':
        return (
          // Phase 2 fix: AgentChat wrapped in PanelErrorBoundary
          <PanelErrorBoundary panelName="Agent">
            <AgentChat />
          </PanelErrorBoundary>
        );

      case 'split-vertical':
        return (
          <div className="flex h-full overflow-hidden">
            <div className="w-52 flex-shrink-0" style={{ borderRight: '1px solid var(--border-subtle)' }}>
              {/* Phase 2 fix: Explorer wrapped */}
              <PanelErrorBoundary panelName="Explorer">
                <FileExplorer />
              </PanelErrorBoundary>
            </div>
            <SplitLayout
              direction="vertical"
              top={
                <PanelErrorBoundary panelName="Editor">
                  <CodeEditor />
                </PanelErrorBoundary>
              }
              bottom={
                <PanelErrorBoundary panelName="Agent">
                  <AgentChat />
                </PanelErrorBoundary>
              }
            />
          </div>
        );

      case 'ide-full':
        return (
          <div className="flex h-full overflow-hidden">
            <div className="w-52 flex-shrink-0" style={{ borderRight: '1px solid var(--border-subtle)' }}>
              {/* Phase 2 fix: all panels wrapped */}
              <PanelErrorBoundary panelName="Explorer">
                <FileExplorer />
              </PanelErrorBoundary>
            </div>
            <div className="flex-1 overflow-hidden">
              <SplitLayout
                direction="horizontal"
                top={
                  <PanelErrorBoundary panelName="Editor">
                    <CodeEditor />
                  </PanelErrorBoundary>
                }
                bottom={
                  <PanelErrorBoundary panelName="Terminal">
                    <TerminalPanel />
                  </PanelErrorBoundary>
                }
              />
            </div>
            <div
              className="flex-shrink-0"
              style={{ width: rightPanelWidth, borderLeft: '1px solid var(--border-subtle)' }}
            >
              <PanelErrorBoundary panelName="Agent">
                <AgentChat />
              </PanelErrorBoundary>
            </div>
          </div>
        );

      case 'split-horizontal':
      default:
        return (
          <div className="flex h-full overflow-hidden">
            {/* File Explorer — Phase 2 fix: wrapped in PanelErrorBoundary */}
            <div className="w-52 flex-shrink-0" style={{ borderRight: '1px solid var(--border-subtle)' }}>
              <PanelErrorBoundary panelName="Explorer">
                <FileExplorer />
              </PanelErrorBoundary>
            </div>

            {/* Editor + Terminal split — Phase 2 fix: each panel wrapped */}
            <div className="flex-1 overflow-hidden">
              <SplitLayout
                direction="horizontal"
                top={
                  <PanelErrorBoundary panelName="Editor">
                    <CodeEditor />
                  </PanelErrorBoundary>
                }
                bottom={
                  <PanelErrorBoundary panelName="Terminal">
                    <TerminalPanel />
                  </PanelErrorBoundary>
                }
              />
            </div>

            {/* Agent Chat — Phase 2 fix: wrapped in PanelErrorBoundary */}
            <div
              className="flex-shrink-0"
              style={{ width: rightPanelWidth, borderLeft: '1px solid var(--border-subtle)' }}
            >
              <PanelErrorBoundary panelName="Agent">
                <AgentChat />
              </PanelErrorBoundary>
            </div>
          </div>
        );
    }
  }

  return (
    <AppShell>
      <Suspense fallback={<LoadingSkeleton label="workspace" />}>
        <div className="h-full overflow-hidden relative">
          {/* WebContainer boot overlay — disappears when ready */}
          <BootOverlay />
          {renderLayout()}
        </div>
      </Suspense>
    </AppShell>
  );
}
