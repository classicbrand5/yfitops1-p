// src/components/features/AgentChat/AgentMessage.tsx
import React, { useState } from 'react';
import { ActionCard } from './ActionCard';
import { Copy, Check, ThumbsUp, ThumbsDown } from 'lucide-react';
import { executeActions } from '@/core/agent/agentExecutor';
import { useAppStore } from '@/store/useAppStore';
import { useFileSystem } from '@/hooks/useFileSystem';
import { toast } from 'sonner';
import type { ConversationMessage } from '@/types/agent.types';

interface AgentMessageProps {
  message: ConversationMessage;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Simple markdown renderer (no external dep)
function SimpleMarkdown({ content }: { content: string }) {
  const html = content
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre class="code-block my-2" style="font-size:12px;padding:10px 12px"><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--bg-void);border:1px solid var(--border-default);border-radius:3px;padding:1px 5px;font-family:var(--font-mono);font-size:12px;color:var(--accent-400)">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--text-primary);font-weight:600">$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h3 style="font-family:var(--font-display);font-size:14px;font-weight:600;color:var(--text-primary);margin:12px 0 6px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-family:var(--font-display);font-size:16px;font-weight:600;color:var(--text-primary);margin:14px 0 8px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-family:var(--font-display);font-size:18px;font-weight:700;color:var(--text-primary);margin:16px 0 8px">$1</h1>')
    .replace(/^- (.+)$/gm, '<li style="margin:2px 0;color:var(--text-secondary)">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="list-style:disc;padding-left:18px;margin:6px 0">$&</ul>')
    .replace(/\n/g, '<br/>');

  return (
    <div
      className="text-sm leading-relaxed"
      style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: markdown rendering
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function AgentMessage({ message }: AgentMessageProps) {
  const [copied, setCopied] = useState(false);
  const { agentAutonomy, appendTerminalOutput, activeTerminalId, updateActionStatus, addNotification } = useAppStore();
  const { refreshTree } = useFileSystem();
  const isUser = message.role === 'user';

  async function handleCopy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleApprove(actionIdx: number) {
    if (!message.actions?.[actionIdx]) return;
    const action = message.actions[actionIdx];

    updateActionStatus(message.id, actionIdx, 'executing');

    try {
      await executeActions([action], {
        autonomy: agentAutonomy,
        onOutput: (line) => {
          if (activeTerminalId) appendTerminalOutput(activeTerminalId, line);
        },
        onActionStatus: (_i, status, result) => {
          updateActionStatus(message.id, actionIdx, status, result);
        },
        requestConfirmation: async () => true,
      });

      // Refresh file tree after any action that touches the filesystem
      const fsActions = ['write_file', 'edit_file', 'delete_file', 'create_dir'];
      if (fsActions.includes(action.type)) {
        await refreshTree();
      }

      addNotification({ type: 'success', title: 'Action completed', message: action.explanation });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateActionStatus(message.id, actionIdx, 'failed', { success: false, error: msg });
      toast.error('Action failed', { description: msg });
    }
  }

  function handleReject(actionIdx: number) {
    updateActionStatus(message.id, actionIdx, 'rejected');
  }

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-up" role="article" aria-label="Your message">
        <div className="max-w-[75%]">
          <div
            className="rounded-xl px-4 py-3"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}
          >
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
              {message.content}
            </p>
          </div>
          <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>
            {formatTime(message.timestamp)}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (message.error) {
    return (
      <div className="flex items-start gap-3 animate-fade-up" role="article" aria-label="Error message">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'rgba(255,77,109,0.12)', border: '1px solid rgba(255,77,109,0.3)', color: 'var(--danger)', fontFamily: 'var(--font-display)', fontSize: 10 }}>
          AI
        </div>
        <div className="flex-1 min-w-0">
          <div className="glass rounded-xl p-4" style={{ border: '1px solid rgba(255,77,109,0.2)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--danger)' }}>Agent Error</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{message.error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-fade-up" role="article" aria-label="AI agent message">
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
        style={{ background: 'rgba(0,245,160,0.12)', border: '1px solid rgba(0,245,160,0.25)', color: 'var(--accent-400)', fontFamily: 'var(--font-display)', fontSize: 10 }}
        aria-hidden="true"
      >
        AI
      </div>

      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold" style={{ color: 'var(--accent-400)', fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
            YFitOps
          </span>
          <button
            className="flex items-center justify-center w-6 h-6 rounded transition-all hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
            onClick={handleCopy}
            aria-label="Copy message"
          >
            {copied ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
          </button>
        </div>

        {/* Content */}
        <div className="glass rounded-xl p-4">
          {message.content && <SimpleMarkdown content={message.content} />}

          {/* Action cards */}
          {message.actions && message.actions.length > 0 && (
            <div className="mt-3 space-y-0">
              {message.actions.map((action, idx) => (
                <ActionCard
                  key={idx}
                  action={action}
                  index={idx}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  showControls={true}
                />
              ))}
            </div>
          )}

          {/* Streaming indicator */}
          {message.isStreaming && (
            <span className="inline-block animate-terminal-cursor" style={{ color: 'var(--accent-400)', marginLeft: 2 }}>▌</span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 mt-1">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{formatTime(message.timestamp)}</p>
          <div className="flex items-center gap-1">
            <button className="w-5 h-5 flex items-center justify-center rounded hover:opacity-80 transition-all" style={{ color: 'var(--text-muted)' }} aria-label="Helpful">
              <ThumbsUp size={10} />
            </button>
            <button className="w-5 h-5 flex items-center justify-center rounded hover:opacity-80 transition-all" style={{ color: 'var(--text-muted)' }} aria-label="Not helpful">
              <ThumbsDown size={10} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
