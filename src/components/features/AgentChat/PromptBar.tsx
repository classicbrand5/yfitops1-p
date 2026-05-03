// src/components/features/AgentChat/PromptBar.tsx
// Phase 0 fix: added slash command autocomplete menu for /review, /explain, /test
import React, { useRef, useState, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Paperclip, Send, Database, FolderOpen, GitBranch, TerminalSquare, Code2, BookOpen, FlaskConical, X } from 'lucide-react';

interface PromptBarProps {
  onSend: (message: string, slashCommand?: SlashCommand) => void;
  isThinking: boolean;
  isAuthenticated?: boolean;
}

// ── Slash command types (must match edge function) ─────────
type SlashCommand = 'CODE_REVIEW_MODE' | 'EXPLAIN_MODE' | 'TEST_MODE';

interface SlashOption {
  command: string;       // The /command text
  mode: SlashCommand;
  label: string;
  description: string;
  shortcut: string;
  color: string;
  icon: React.ElementType;
  badgeBg: string;
  badgeColor: string;
}

const SLASH_COMMANDS: SlashOption[] = [
  {
    command: '/review',
    mode: 'CODE_REVIEW_MODE',
    label: 'Code Review',
    description: 'Get a structured code review with quality score, issues, and fixes',
    shortcut: '/review',
    color: '#00F5A0',
    icon: Code2,
    badgeBg: 'rgba(0,245,160,0.12)',
    badgeColor: '#00F5A0',
  },
  {
    command: '/explain',
    mode: 'EXPLAIN_MODE',
    label: 'Explain Code',
    description: 'Step-by-step walkthrough of what the code does and why',
    shortcut: '/explain',
    color: '#38BDF8',
    icon: BookOpen,
    badgeBg: 'rgba(56,189,248,0.12)',
    badgeColor: '#38BDF8',
  },
  {
    command: '/test',
    mode: 'TEST_MODE',
    label: 'Generate Tests',
    description: 'Generate Vitest tests: happy path, edge cases, error conditions',
    shortcut: '/test',
    color: '#9B6EF5',
    icon: FlaskConical,
    badgeBg: 'rgba(155,110,245,0.12)',
    badgeColor: '#9B6EF5',
  },
];

export function PromptBar({ onSend, isThinking, isAuthenticated = true }: PromptBarProps) {
  const [value, setValue] = useState('');
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedSlashIdx, setSelectedSlashIdx] = useState(0);
  // Active slash command badge (set when user selects a slash command)
  const [activeSlashCommand, setActiveSlashCommand] = useState<SlashOption | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slashMenuRef = useRef<HTMLDivElement>(null);
  const { agentContext, updateAgentContext } = useAppStore();

  const isDisabled = isThinking || !isAuthenticated;

  // ── Slash command autocomplete logic ──────────────────────
  // Open slash menu when user types "/" at start of input
  useEffect(() => {
    const trimmed = value.trimStart();
    if (trimmed.startsWith('/') && !activeSlashCommand) {
      const afterSlash = trimmed.slice(1);
      setSlashFilter(afterSlash.toLowerCase());
      setSlashMenuOpen(true);
      setSelectedSlashIdx(0);
    } else {
      setSlashMenuOpen(false);
      setSlashFilter('');
    }
  }, [value, activeSlashCommand]);

  const filteredSlashCommands = SLASH_COMMANDS.filter(
    (c) =>
      c.command.slice(1).includes(slashFilter) ||
      c.label.toLowerCase().includes(slashFilter),
  );

  function applySlashCommand(option: SlashOption) {
    setActiveSlashCommand(option);
    setValue(''); // Clear the /command text so user types their actual prompt
    setSlashMenuOpen(false);
    setSlashFilter('');
    textareaRef.current?.focus();
  }

  function clearSlashCommand() {
    setActiveSlashCommand(null);
    textareaRef.current?.focus();
  }

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || isDisabled) return;
    onSend(trimmed, activeSlashCommand?.mode);
    setValue('');
    setActiveSlashCommand(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Slash menu navigation
    if (slashMenuOpen && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSlashIdx((i) => (i + 1) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSlashIdx((i) => (i - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        applySlashCommand(filteredSlashCommands[selectedSlashIdx]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenuOpen(false);
        return;
      }
    }

    // Normal send
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

  // ── File attach ──────────────────────────────────────────
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
    e.target.value = '';
  }

  const charCount = value.length;
  const maxChars = 4000;
  const canSend = value.trim().length > 0 && !isDisabled;

  type ContextKey = 'includeOpenFiles' | 'includeBuildStatus' | 'includeTerminalOutput' | 'includeGitHistory';

  const contextToggles: Array<{ key: ContextKey; label: string; icon: React.ElementType }> = [
    { key: 'includeOpenFiles', label: 'files', icon: FolderOpen },
    { key: 'includeBuildStatus', label: 'builds', icon: Database },
    { key: 'includeTerminalOutput', label: 'terminal', icon: TerminalSquare },
    { key: 'includeGitHistory', label: 'git', icon: GitBranch },
  ];

  return (
    <div
      className="flex-shrink-0 border-t relative"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}
    >
      {/* ── Slash command popup menu ─────────────────────────── */}
      {slashMenuOpen && filteredSlashCommands.length > 0 && (
        <div
          ref={slashMenuRef}
          className="absolute bottom-full left-0 right-0 mx-3 mb-2 animate-fade-up rounded-xl overflow-hidden"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
            zIndex: 60,
          }}
          role="listbox"
          aria-label="Slash command options"
        >
          {/* Header */}
          <div
            className="px-3 py-2 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 10 }}>
              Slash Commands
            </p>
          </div>

          {filteredSlashCommands.map((opt, idx) => {
            const Icon = opt.icon;
            const isHighlighted = idx === selectedSlashIdx;
            return (
              <div
                key={opt.command}
                className="flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-all"
                style={{
                  background: isHighlighted ? 'rgba(0,245,160,0.05)' : 'transparent',
                  borderLeft: isHighlighted ? `2px solid ${opt.color}` : '2px solid transparent',
                }}
                onMouseEnter={() => setSelectedSlashIdx(idx)}
                onClick={() => applySlashCommand(opt)}
                role="option"
                aria-selected={isHighlighted}
              >
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: opt.badgeBg }}
                  aria-hidden="true"
                >
                  <Icon size={13} style={{ color: opt.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                      {opt.label}
                    </span>
                    <code
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{ background: opt.badgeBg, color: opt.color, fontFamily: 'var(--font-mono)', fontSize: 10 }}
                    >
                      {opt.shortcut}
                    </code>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 11 }}>
                    {opt.description}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Footer hint */}
          <div
            className="flex items-center gap-3 px-3 py-2 border-t"
            style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-void)' }}
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 10 }}>
              ↑↓ navigate · Enter or Tab to select · Esc to close
            </span>
          </div>
        </div>
      )}

      {/* ── Active slash command badge ───────────────────────── */}
      {activeSlashCommand && (
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <div
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium animate-fade-in"
            style={{
              background: activeSlashCommand.badgeBg,
              border: `1px solid ${activeSlashCommand.color}40`,
              color: activeSlashCommand.color,
              fontFamily: 'var(--font-body)',
            }}
          >
            <activeSlashCommand.icon size={11} aria-hidden="true" />
            {activeSlashCommand.label} Mode
            <button
              onClick={clearSlashCommand}
              className="ml-1 rounded hover:opacity-70 transition-opacity"
              aria-label={`Clear ${activeSlashCommand.label} mode`}
              style={{ color: 'inherit', lineHeight: 1 }}
            >
              <X size={10} />
            </button>
          </div>
          <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: 10 }}>
            Active mode — your message will be processed in {activeSlashCommand.label} format
          </span>
        </div>
      )}

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

        {/* Slash command hint — show only when no active command */}
        {!activeSlashCommand && (
          <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.6 }}>
            type / for commands
          </span>
        )}
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
                  : activeSlashCommand
                    ? `Describe what to ${activeSlashCommand.label.toLowerCase()}…`
                    : 'Write your next task… (/ for commands, Enter to send)'
            }
            rows={1}
            disabled={isDisabled}
            className="w-full resize-none outline-none rounded-lg px-3 py-2.5 text-sm transition-all"
            style={{
              background: 'var(--bg-input)',
              border: `1px solid ${
                activeSlashCommand
                  ? activeSlashCommand.color + '40'
                  : value.length > 0 && !isDisabled
                    ? 'var(--border-accent)'
                    : 'var(--border-default)'
              }`,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
              caretColor: activeSlashCommand ? activeSlashCommand.color : 'var(--accent-400)',
              minHeight: 44,
              maxHeight: 140,
              lineHeight: 1.5,
              fontSize: 14,
              opacity: isDisabled ? 0.5 : 1,
              cursor: !isAuthenticated ? 'not-allowed' : 'text',
            }}
            aria-label="Message input"
            aria-disabled={isDisabled}
            aria-autocomplete={slashMenuOpen ? 'list' : 'none'}
            aria-expanded={slashMenuOpen}
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
            background: canSend
              ? activeSlashCommand
                ? activeSlashCommand.color
                : 'var(--accent-400)'
              : 'var(--bg-input)',
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
