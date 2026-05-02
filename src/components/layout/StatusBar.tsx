// src/components/layout/StatusBar.tsx
import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { GitBranch, AlertTriangle, Info, Check, Bot, Zap } from 'lucide-react';
import { isWebContainerReady } from '@/core/webcontainer/webcontainer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function StatusBar() {
  const {
    currentBranch,
    editorErrors,
    editorWarnings,
    openTabs,
    activeTabId,
    workspaceReady,
    user,
  } = useAppStore();

  const activeTab = openTabs.find((t) => t.id === activeTabId);
  const encoding = 'UTF-8';
  const indentation = 'Spaces: 2';
  const wcReady = isWebContainerReady();

  // Fetch AI usage counter
  const { data: aiUsage } = useQuery({
    queryKey: ['ai-usage-statusbar', user?.id],
    queryFn: async () => {
      if (!supabase || !user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('ai_requests_used,ai_requests_limit')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!supabase && !!user,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

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

      {/* WebContainer status dot */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: wcReady ? 'var(--success)' : 'var(--warning)',
            boxShadow: wcReady ? '0 0 4px var(--success)' : undefined,
            animation: !wcReady ? 'pulse 1s ease-in-out infinite' : undefined,
          }}
          aria-hidden="true"
        />
        {workspaceReady ? (
          <span style={{ color: 'var(--success)' }}>Ready</span>
        ) : (
          <span style={{ color: 'var(--warning)' }}>Initializing…</span>
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

      {/* AI usage counter */}
      {aiUsage && (
        <>
          <div className="flex items-center gap-1.5 flex-shrink-0"
            style={{ color: (aiUsage.ai_requests_used / aiUsage.ai_requests_limit) > 0.85 ? 'var(--warning)' : 'var(--text-muted)' }}
            title={`AI requests: ${aiUsage.ai_requests_used} / ${aiUsage.ai_requests_limit} this month`}
          >
            <Bot size={10} aria-hidden="true" />
            <span>{aiUsage.ai_requests_used}/{aiUsage.ai_requests_limit}</span>
          </div>
          <div style={{ color: 'var(--border-default)' }}>|</div>
        </>
      )}

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
