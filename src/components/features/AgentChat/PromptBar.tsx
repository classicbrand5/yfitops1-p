// src/components/features/AgentChat/PromptBar.tsx
import React, { useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Paperclip, Send, Zap, Database, FolderOpen, GitBranch, TerminalSquare } from 'lucide-react';

interface PromptBarProps {
  onSend: (message: string) => void;
  isThinking: boolean;
}

export function PromptBar({ onSend, isThinking }: PromptBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { agentContext, updateAgentContext } = useAppStore();

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isThinking) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // Plain Enter sends (Shift+Enter inserts newline)
      e.preventDefault();
      handleSend();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      // Ctrl/Cmd+Enter also sends
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    // Auto-resize
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
    }
  }

  const charCount = value.length;
  const maxChars = 4000;

  type ContextKey = 'includeOpenFiles' | 'includeBuildStatus' | 'includeTerminalOutput' | 'includeGitHistory';

  const contextToggles: Array<{ key: ContextKey; label: string; icon: React.ElementType }> = [
    { key: 'includeOpenFiles',     label: 'files',    icon: FolderOpen },
    { key: 'includeBuildStatus',   label: 'builds',   icon: Database },
    { key: 'includeTerminalOutput',label: 'terminal', icon: TerminalSquare },
    { key: 'includeGitHistory',    label: 'git',      icon: GitBranch },
  ];

  return (
    <div
      className="flex-shrink-0 border-t"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}
    >
      {/* Context toggles */}
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Context:</span>
        {contextToggles.map(({ key, label, icon: Icon }) => {
          const isActive = agentContext[key];
          return (
            <button
              key={key}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all"
              style={{
                background: isActive ? 'rgba(0,245,160,0.1)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? 'rgba(0,245,160,0.25)' : 'var(--border-subtle)'}`,
                color: isActive ? 'var(--accent-400)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
              }}
              onClick={() => updateAgentContext({ [key]: !isActive })}
              aria-pressed={isActive}
              aria-label={`${isActive ? 'Disable' : 'Enable'} ${label} context`}
            >
              <Icon size={9} aria-hidden="true" />
              {label}
              {isActive && <span aria-hidden="true">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 px-3 py-2">
        {/* Attach */}
        <button
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-all hover:opacity-80"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border-default)' }}
          aria-label="Attach file"
          title="Attach file from workspace"
        >
          <Paperclip size={14} />
        </button>

        {/* Textarea */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Write your next task… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={isThinking}
            className="w-full resize-none outline-none rounded-lg px-3 py-2.5 text-sm transition-all"
            style={{
              background: 'var(--bg-input)',
              border: `1px solid ${value.length > 0 ? 'var(--border-accent)' : 'var(--border-default)'}`,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              caretColor: 'var(--accent-400)',
              minHeight: 44,
              maxHeight: 140,
              lineHeight: 1.5,
              fontSize: 14,
              opacity: isThinking ? 0.6 : 1,
            }}
            aria-label="Message input"
            aria-disabled={isThinking}
            maxLength={maxChars}
          />
          {charCount > 800 && (
            <span
              className="absolute bottom-2 right-2 text-xs"
              style={{ color: charCount > maxChars * 0.9 ? 'var(--warning)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}
              aria-live="polite"
            >
              {charCount}/{maxChars}
            </span>
          )}
        </div>

        {/* Send */}
        <button
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-all"
          style={{
            background: value.trim() && !isThinking ? 'var(--accent-400)' : 'var(--bg-input)',
            border: `1px solid ${value.trim() && !isThinking ? 'transparent' : 'var(--border-default)'}`,
            color: value.trim() && !isThinking ? 'var(--text-inverse)' : 'var(--text-muted)',
            boxShadow: value.trim() && !isThinking ? 'var(--shadow-accent)' : 'none',
            cursor: value.trim() && !isThinking ? 'pointer' : 'not-allowed',
          }}
          onClick={handleSend}
          disabled={!value.trim() || isThinking}
          aria-label="Send message (Ctrl+Enter)"
          title="Send (Ctrl+Enter)"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
