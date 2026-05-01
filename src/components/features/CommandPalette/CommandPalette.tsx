// src/components/features/CommandPalette/CommandPalette.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import {
  Columns2,
  Rows2,
  Square,
  TerminalSquare,
  MessageSquare,
  Maximize2,
  FolderOpen,
  RotateCcw,
  Moon,
  Sun,
  Bot,
  Trash2,
  Zap,
  BarChart3,
  Settings,
  GitBranch,
} from 'lucide-react';
import type { LayoutMode } from '@/types/dev.types';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  shortcut?: string;
  icon: React.ElementType;
  group: string;
  action: () => void;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const {
    closeCommandPalette,
    setLayoutMode,
    toggleTheme,
    theme,
    setExpertMode,
    expertMode,
    createTerminalSession,
    clearChat,
    activeConversationId,
  } = useAppStore();

  const commands: CommandItem[] = [
    // Layout
    {
      id: 'layout-split-h',
      label: 'Split Horizontal',
      shortcut: 'Alt+H',
      icon: Rows2,
      group: 'Layout',
      action: () => { setLayoutMode('split-horizontal' as LayoutMode); closeCommandPalette(); },
    },
    {
      id: 'layout-split-v',
      label: 'Split Vertical',
      shortcut: 'Alt+V',
      icon: Columns2,
      group: 'Layout',
      action: () => { setLayoutMode('split-vertical' as LayoutMode); closeCommandPalette(); },
    },
    {
      id: 'layout-editor',
      label: 'Editor Only',
      shortcut: 'Alt+E',
      icon: Square,
      group: 'Layout',
      action: () => { setLayoutMode('editor-only' as LayoutMode); closeCommandPalette(); },
    },
    {
      id: 'layout-terminal',
      label: 'Terminal Only',
      shortcut: 'Alt+T',
      icon: TerminalSquare,
      group: 'Layout',
      action: () => { setLayoutMode('terminal-only' as LayoutMode); closeCommandPalette(); },
    },
    {
      id: 'layout-chat',
      label: 'Chat Only',
      shortcut: 'Alt+C',
      icon: MessageSquare,
      group: 'Layout',
      action: () => { setLayoutMode('chat-only' as LayoutMode); closeCommandPalette(); },
    },
    {
      id: 'layout-full',
      label: 'Full IDE View',
      shortcut: 'Alt+F',
      icon: Maximize2,
      group: 'Layout',
      action: () => { setLayoutMode('ide-full' as LayoutMode); closeCommandPalette(); },
    },
    // Navigation
    {
      id: 'nav-workspace',
      label: 'Go to Workspace',
      icon: FolderOpen,
      group: 'Navigation',
      action: () => { navigate('/workspace'); closeCommandPalette(); },
    },
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      icon: BarChart3,
      group: 'Navigation',
      action: () => { navigate('/dashboard'); closeCommandPalette(); },
    },
    {
      id: 'nav-analytics',
      label: 'Go to Analytics',
      icon: BarChart3,
      group: 'Navigation',
      action: () => { navigate('/analytics'); closeCommandPalette(); },
    },
    {
      id: 'nav-builds',
      label: 'Go to Build Monitor',
      icon: GitBranch,
      group: 'Navigation',
      action: () => { navigate('/builds'); closeCommandPalette(); },
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      icon: Settings,
      group: 'Navigation',
      action: () => { navigate('/settings'); closeCommandPalette(); },
    },
    // Agent
    {
      id: 'agent-new',
      label: 'New AI Conversation',
      icon: Bot,
      group: 'Agent',
      action: () => { navigate('/workspace'); closeCommandPalette(); },
    },
    {
      id: 'agent-clear',
      label: 'Clear Current Chat',
      icon: Trash2,
      group: 'Agent',
      action: () => {
        if (activeConversationId) clearChat(activeConversationId);
        closeCommandPalette();
      },
    },
    // Terminal
    {
      id: 'terminal-new',
      label: 'New Terminal Tab',
      shortcut: 'Ctrl+`',
      icon: TerminalSquare,
      group: 'Terminal',
      action: () => {
        const id = `term-${Date.now()}`;
        createTerminalSession(id);
        navigate('/workspace');
        closeCommandPalette();
      },
    },
    // Appearance
    {
      id: 'appearance-theme',
      label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      shortcut: '⌘⇧L',
      icon: theme === 'dark' ? Sun : Moon,
      group: 'Appearance',
      action: () => { toggleTheme(); closeCommandPalette(); },
    },
    {
      id: 'appearance-expert',
      label: expertMode ? 'Disable Expert Mode' : 'Enable Expert Mode',
      icon: Zap,
      group: 'Appearance',
      action: () => { setExpertMode(!expertMode); closeCommandPalette(); },
    },
    // Reload
    {
      id: 'system-reload',
      label: 'Reload Page',
      icon: RotateCcw,
      group: 'System',
      action: () => { window.location.reload(); },
    },
  ];

  const filtered = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.group.toLowerCase().includes(query.toLowerCase()) ||
        (c.description?.toLowerCase().includes(query.toLowerCase()))
      )
    : commands;

  // Group commands
  const grouped: Record<string, CommandItem[]> = {};
  for (const cmd of filtered) {
    if (!grouped[cmd.group]) grouped[cmd.group] = [];
    grouped[cmd.group].push(cmd);
  }

  const allFiltered = filtered;

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, allFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      allFiltered[selectedIdx]?.action();
    } else if (e.key === 'Escape') {
      closeCommandPalette();
    }
  }

  let itemIdx = 0;

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(6,6,9,0.7)', backdropFilter: 'blur(8px)', zIndex: 'var(--z-command)' }}
      onClick={closeCommandPalette}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="w-full max-w-xl glass rounded-xl overflow-hidden animate-fade-up"
        style={{ boxShadow: 'var(--shadow-lg), var(--shadow-accent)', maxHeight: '60vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded="true"
        aria-haspopup="listbox"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, files, conversations…"
            className="flex-1 bg-transparent outline-none text-sm"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)', caretColor: 'var(--accent-400)' }}
            aria-label="Search commands"
            role="searchbox"
          />
          <kbd className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-overlay)', color: 'var(--text-muted)', border: '1px solid var(--border-default)', fontSize: 10 }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1" role="listbox" aria-label="Commands">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div className="px-4 py-2 text-label-sm" style={{ color: 'var(--text-muted)' }}>{group}</div>
              {items.map((cmd) => {
                const currentIdx = itemIdx++;
                const isSelected = currentIdx === selectedIdx;
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all text-left"
                    style={{
                      background: isSelected ? 'rgba(0,245,160,0.08)' : 'transparent',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      borderLeft: isSelected ? '2px solid var(--accent-400)' : '2px solid transparent',
                      fontFamily: 'var(--font-body)',
                    }}
                    onClick={cmd.action}
                    onMouseEnter={() => setSelectedIdx(currentIdx)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <Icon size={15} style={{ color: isSelected ? 'var(--accent-400)' : 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
                    <span className="flex-1">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="text-xs px-1.5 py-0.5 rounded ml-auto" style={{ background: 'var(--bg-overlay)', color: 'var(--text-muted)', border: '1px solid var(--border-default)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No commands found for "{query}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
