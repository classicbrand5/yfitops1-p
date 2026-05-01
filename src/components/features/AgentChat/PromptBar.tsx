// src/components/features/AgentChat/PromptBar.tsx
import React, { useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Paperclip, Send, Database, FolderOpen, GitBranch, TerminalSquare } from 'lucide-react';

interface PromptBarProps {
  onSend: (message: string) => void;
  isThinking: boolean;
  isAuthenticated?: boolean;
}

export function PromptBar({ onSend, isThinking, isAuthenticated = true }: PromptBarProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { agentContext, updateAgentContext } = useAppStore();

  const isDisabled = isThinking || !isAuthenticated;

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleSend();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
    }
  }

  // ── File attach ───────────────────────────────────────────────────────────
  function handleAttachClick() {
    if (!isAuthenticated) return;
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      const ext = file.name.split('.').pop() ?? '';
      const block = `\`\`\`${ext}\n// File: ${file.name}\n${content}\n\`\`\`\n\n`;
      setValue((prev) => block + prev);

      // Auto-resize textarea
      requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.style.height = 'auto';
          ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
          ta.focus();
        }
      });
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-attached
    e.target.value = '';
  }

  const charCount = value.length;
  const maxChars = 4000;
  const canSend = value.trim().length > 0 && !isDisabled;

  type ContextKey = 'includeOpenFiles' | 'includeBuildStatus' | 'includeTerminalOutput' | 'includeGitHistory';

  const contextToggles: Array<{ key: ContextKey; label: string; icon: React.ElementType }> = [
    { key: 'includeOpenFiles',      label: 'files',    icon: FolderOpen },
    { key: 'includeBuildStatus',    label: 'builds',   icon: Database },
    { key: 'includeTerminalOutput', label: 'terminal', icon: TerminalSquare },
    { key: 'includeGitHistory',     label: 'git',      icon: GitBranch },
  ];

  return (
    <div
      className="flex-shrink-0 border-t"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}
    >
      {/* Context toggles */}
      <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 flex-wrap">
        <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
          Context:
        </span>
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
                opacity: !isAuthenticated ? 0.4 : 1,
              }}
              onClick={() => isAuthenticated && updateAgentContext({ [key]: !isActive })}
              aria-pressed={isActive}
              aria-label={`${isActive ? 'Disable' : 'Enable'} ${label} context`}
              disabled={!isAuthenticated}
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
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".ts,.tsx,.js,.jsx,.json,.md,.txt,.css,.html,.py,.go,.rs,.yaml,.yml,.toml,.env,.sh"
          className="hidden"
          onChange={handleFileChange}
          aria-label="Attach file"
        />

        {/* Attach button */}
        <button
          className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg transition-all hover:opacity-80"
          style={{
            color: 'var(--text-muted)',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            opacity: !isAuthenticated ? 0.4 : 1,
            cursor: !isAuthenticated ? 'not-allowed' : 'pointer',
          }}
          aria-label="Attach file from disk"
          title={isAuthenticated ? 'Attach file (inserts content into prompt)' : 'Sign in required'}
          onClick={handleAttachClick}
          disabled={!isAuthenticated}
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
            placeholder={
              !isAuthenticated
                ? 'Sign in to use the AI agent…'
                : isThinking
                  ? 'Agent is thinking…'
                  : 'Write your next task… (Enter to send, Shift+Enter for newline)'
            }
            rows={1}
            disabled={isDisabled}
            className="w-full resize-none outline-none rounded-lg px-3 py-2.5 text-sm transition-all"
            style={{
              background: 'var(--bg-input)',
              border: `1px solid ${value.length > 0 && !isDisabled ? 'var(--border-accent)' : 'var(--border-default)'}`,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              caretColor: 'var(--accent-400)',
              minHeight: 44,
              maxHeight: 140,
              lineHeight: 1.5,
              fontSize: 14,
              opacity: isDisabled ? 0.5 : 1,
              cursor: !isAuthenticated ? 'not-allowed' : 'text',
            }}
            aria-label="Message input"
            aria-disabled={isDisabled}
            maxLength={maxChars}
          />
          {charCount > 800 && (
            <span
              className="absolute bottom-2 right-2 text-xs"
              style={{
                color: charCount > maxChars * 0.9 ? 'var(--warning)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
              }}
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
            background: canSend ? 'var(--accent-400)' : 'var(--bg-input)',
            border: `1px solid ${canSend ? 'transparent' : 'var(--border-default)'}`,
            color: canSend ? 'var(--text-inverse)' : 'var(--text-muted)',
            boxShadow: canSend ? 'var(--shadow-accent)' : 'none',
            cursor: canSend ? 'pointer' : 'not-allowed',
          }}
          onClick={handleSend}
          disabled={!canSend}
          aria-label={isAuthenticated ? 'Send message (Enter)' : 'Sign in to send messages'}
          title={isAuthenticated ? 'Send (Enter)' : 'Sign in required'}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
