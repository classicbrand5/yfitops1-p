// src/components/features/AgentChat/AgentContextPanel.tsx
// Shows what context the agent can see — each chip is toggleable
// Placed above the PromptBar textarea

import React from 'react';
import { FileText, FolderOpen, Terminal, GitBranch, History } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';

interface ContextChipProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onToggle?: () => void;
  title?: string;
}

function ContextChip({ icon, label, active, onToggle, title }: ContextChipProps) {
  return (
    <button
      className={`context-chip ${active ? 'active' : ''}`}
      onClick={onToggle}
      title={title}
      aria-pressed={active}
      aria-label={`${label} context ${active ? 'enabled' : 'disabled'}`}
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function AgentContextPanel() {
  const {
    openTabs,
    fileTree,
    agentContext,
    updateAgentContext,
    activeTerminalId,
    conversations,
    activeConversationId,
  } = useAppStore();

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  const fileCount = openTabs.length;
  const treeCount = fileTree.length;

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-2 flex-wrap"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}
      aria-label="Agent context configuration"
      role="group"
    >
      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
        Context:
      </span>

      <ContextChip
        icon={<FileText size={9} aria-hidden="true" />}
        label={`${fileCount} file${fileCount !== 1 ? 's' : ''}`}
        active={agentContext.includeOpenFiles && fileCount > 0}
        onToggle={() => updateAgentContext({ includeOpenFiles: !agentContext.includeOpenFiles })}
        title="Include open editor files in agent context"
      />

      <ContextChip
        icon={<FolderOpen size={9} aria-hidden="true" />}
        label={`${treeCount} nodes`}
        active={treeCount > 0}
        title="File tree is always included in context"
      />

      <ContextChip
        icon={<Terminal size={9} aria-hidden="true" />}
        label="terminal"
        active={agentContext.includeTerminalOutput && !!activeTerminalId}
        onToggle={() => updateAgentContext({ includeTerminalOutput: !agentContext.includeTerminalOutput })}
        title="Include recent terminal output in agent context"
      />

      <ContextChip
        icon={<History size={9} aria-hidden="true" />}
        label="git history"
        active={agentContext.includeGitHistory}
        onToggle={() => updateAgentContext({ includeGitHistory: !agentContext.includeGitHistory })}
        title="Include git history in agent context"
      />

      {activeConv && (
        <span
          className="ml-auto text-xs flex-shrink-0"
          style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
        >
          {activeConv.messageCount} msg{activeConv.messageCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
}
