// src/components/layout/StatusBar.tsx
import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { GitBranch, AlertTriangle, Info, Check } from 'lucide-react';

export function StatusBar() {
  const {
    currentBranch,
    editorErrors,
    editorWarnings,
    openTabs,
    activeTabId,
    workspaceReady,
  } = useAppStore();

  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const encoding = 'UTF-8';
  const indentation = 'Spaces: 2';

  return (
    <footer
      className="flex items-center gap-4 px-4 text-xs flex-shrink-0 border-t select-none overflow-x-auto"
      style={{
        height: 26,
        background: 'var(--bg-void)',
        borderColor: 'var(--border-subtle)',
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-muted)',
      }}
      role="status"
      aria-label="Editor status bar"
    >
      {/* Branch */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <GitBranch size={11} />
        <span>{currentBranch}</span>
      </div>

      <div style={{ color: 'var(--border-default)' }}>|</div>

      {/* Workspace status */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {workspaceReady ? (
          <>
            <Check size={10} style={{ color: 'var(--success)' }} />
            <span style={{ color: 'var(--success)' }}>Workspace Ready</span>
          </>
        ) : (
          <>
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--warning)' }} aria-hidden="true" />
            <span style={{ color: 'var(--warning)' }}>Initializing…</span>
          </>
        )}
      </div>

      {/* Errors */}
      {editorErrors > 0 && (
        <>
          <div style={{ color: 'var(--border-default)' }}>|</div>
          <button
            className="flex items-center gap-1.5 flex-shrink-0 transition-all hover:opacity-80"
            style={{ color: 'var(--danger)' }}
            aria-label={`${editorErrors} error${editorErrors !== 1 ? 's' : ''}`}
          >
            <AlertTriangle size={11} />
            <span>{editorErrors} error{editorErrors !== 1 ? 's' : ''}</span>
          </button>
        </>
      )}

      {/* Warnings */}
      {editorWarnings > 0 && (
        <>
          <div style={{ color: 'var(--border-default)' }}>|</div>
          <button
            className="flex items-center gap-1.5 flex-shrink-0 transition-all hover:opacity-80"
            style={{ color: 'var(--warning)' }}
            aria-label={`${editorWarnings} warning${editorWarnings !== 1 ? 's' : ''}`}
          >
            <Info size={11} />
            <span>{editorWarnings} warning{editorWarnings !== 1 ? 's' : ''}</span>
          </button>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side info */}
      {activeTab && (
        <>
          <span className="flex-shrink-0">{encoding}</span>
          <div style={{ color: 'var(--border-default)' }}>|</div>
          <span className="flex-shrink-0 capitalize">{activeTab.language}</span>
          <div style={{ color: 'var(--border-default)' }}>|</div>
          <span className="flex-shrink-0">{indentation}</span>
          {activeTab.cursorLine && (
            <>
              <div style={{ color: 'var(--border-default)' }}>|</div>
              <span className="flex-shrink-0">
                Ln {activeTab.cursorLine}, Col {activeTab.cursorCol ?? 1}
              </span>
            </>
          )}
        </>
      )}
    </footer>
  );
}
