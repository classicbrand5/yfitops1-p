// src/pages/WorkspacePage.tsx — Main IDE page
import React, { Suspense, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { SplitLayout } from '@/components/layout/SplitLayout';
import { FileExplorer } from '@/components/features/FileExplorer/FileExplorer';
import { CodeEditor } from '@/components/features/Editor/CodeEditor';
import { TerminalPanel } from '@/components/features/Terminal/TerminalPanel';
import { AgentChat } from '@/components/features/AgentChat/AgentChat';
import { useAppStore } from '@/store/useAppStore';
import { useWebContainer } from '@/hooks/useWebContainer';

function LoadingSkeleton({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-full" style={{ background: 'var(--bg-base)' }}>
      <div className="text-center">
        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-2" style={{ borderColor: 'var(--accent-400)' }} aria-hidden="true" />
        <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Loading {label}…</p>
      </div>
    </div>
  );
}

export default function WorkspacePage() {
  const { layoutMode, rightPanelWidth } = useAppStore();
  const { status, boot } = useWebContainer();

  useEffect(() => {
    if (status === 'idle') boot();
  }, []);

  function renderLayout() {
    switch (layoutMode) {
      case 'editor-only':
        return (
          <div className="flex h-full overflow-hidden">
            <div className="w-56 flex-shrink-0"><FileExplorer /></div>
            <div className="flex-1"><CodeEditor /></div>
          </div>
        );

      case 'terminal-only':
        return <TerminalPanel />;

      case 'chat-only':
        return <AgentChat />;

      case 'split-vertical':
        return (
          <div className="flex h-full overflow-hidden">
            <div className="w-52 flex-shrink-0"><FileExplorer /></div>
            <SplitLayout
              direction="vertical"
              top={<CodeEditor />}
              bottom={<AgentChat />}
            />
          </div>
        );

      case 'ide-full':
        return (
          <div className="flex h-full overflow-hidden">
            <div className="w-52 flex-shrink-0"><FileExplorer /></div>
            <SplitLayout
              direction="horizontal"
              top={<CodeEditor />}
              bottom={<TerminalPanel />}
            />
            <div className="flex-shrink-0" style={{ width: rightPanelWidth, borderLeft: '1px solid var(--border-subtle)' }}>
              <AgentChat />
            </div>
          </div>
        );

      case 'split-horizontal':
      default:
        return (
          <div className="flex h-full overflow-hidden">
            {/* File Explorer */}
            <div className="w-52 flex-shrink-0" style={{ borderRight: '1px solid var(--border-subtle)' }}>
              <FileExplorer />
            </div>

            {/* Editor + Terminal split */}
            <div className="flex-1 overflow-hidden">
              <SplitLayout
                direction="horizontal"
                top={<CodeEditor />}
                bottom={<TerminalPanel />}
              />
            </div>

            {/* Agent Chat */}
            <div className="flex-shrink-0" style={{ width: rightPanelWidth }}>
              <AgentChat />
            </div>
          </div>
        );
    }
  }

  return (
    <AppShell>
      <Suspense fallback={<LoadingSkeleton label="workspace" />}>
        <div className="h-full overflow-hidden">
          {renderLayout()}
        </div>
      </Suspense>
    </AppShell>
  );
}
