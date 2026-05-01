// src/components/features/CommandPalette/CommandPalette.tsx
// Phase 7: Full Command Palette — built with cmdk
// Opened via Cmd+K / Ctrl+K; closed via Escape or backdrop click.

import React, { useEffect, useCallback } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import type { LayoutMode } from '@/types/dev.types';
import type { ConversationMeta } from '@/types/agent.types';

// ── Icon components (inline SVG — avoids any lucide mismatch) ─
function Icon({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  );
}

// ── Shortcut badge ─────────────────────────────────────────
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      style={{
        background: 'var(--bg-elevated)',
        color: 'var(--text-muted)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-sm)',
        padding: '2px 8px',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        lineHeight: 1.6,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {children}
    </kbd>
  );
}

// ── Individual command row ─────────────────────────────────
interface CmdRowProps {
  icon: string;
  label: string;
  shortcut?: string;
  onSelect: () => void;
}

function CmdRow({ icon, label, shortcut, onSelect }: CmdRowProps) {
  return (
    <Command.Item
      onSelect={onSelect}
      style={{ all: 'unset', display: 'block', width: '100%' }}
    >
      <div
        className="cmd-item"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          borderRadius: 8,
          cursor: 'pointer',
          borderLeft: '2px solid transparent',
          transition: 'background 120ms ease, border-color 120ms ease',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--text-secondary)',
        }}
      >
        <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }} aria-hidden="true">
          {icon}
        </span>
        <span style={{ flex: 1 }}>{label}</span>
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </div>
    </Command.Item>
  );
}

// ── Group heading ──────────────────────────────────────────
function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: '12px 16px 6px',
        fontSize: 11,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-body)',
        fontWeight: 500,
      }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

// ── Separator line ─────────────────────────────────────────
function Sep() {
  return (
    <div
      style={{
        height: 1,
        background: 'var(--border-subtle)',
        margin: '4px 0',
      }}
      role="separator"
    />
  );
}

// ── Main Component ─────────────────────────────────────────
export function CommandPalette() {
  const navigate = useNavigate();

  const {
    commandPaletteOpen,
    closeCommandPalette,
    setLayoutMode,
    toggleTheme,
    theme,
    setExpertMode,
    expertMode,
    createTerminalSession,
    addConversation,
    setActiveConversation,
    clearChat,
    activeConversationId,
  } = useAppStore();

  // ── Close on Escape (cmdk handles this, but belt-and-suspenders) ──
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) closeCommandPalette();
    },
    [closeCommandPalette],
  );

  // ── Helper: run action + close ────────────────────────────
  function run(fn: () => void) {
    fn();
    closeCommandPalette();
  }

  // ── Layout actions ─────────────────────────────────────────
  function layout(mode: LayoutMode) {
    return () => run(() => setLayoutMode(mode));
  }

  // ── New terminal tab ───────────────────────────────────────
  function newTerminalTab() {
    run(() => {
      const id = crypto.randomUUID();
      createTerminalSession(id, '/');
      navigate('/workspace');
    });
  }

  // ── New AI conversation ────────────────────────────────────
  function newConversation() {
    run(() => {
      const id = crypto.randomUUID();
      const conv: ConversationMeta = {
        id,
        title: 'New conversation',
        category: 'general',
        messageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      addConversation(conv);
      setActiveConversation(id);
      navigate('/workspace');
    });
  }

  // ── Clear current chat ─────────────────────────────────────
  function clearCurrentChat() {
    run(() => {
      if (activeConversationId) clearChat(activeConversationId);
    });
  }

  // Don't render at all when closed — keeps React tree clean
  if (!commandPaletteOpen) return null;

  return (
    <>
      {/* ── Global cmdk style overrides ── */}
      <style>{`
        /* Selected item highlight — cmdk sets aria-selected */
        [cmdk-item][aria-selected="true"] .cmd-item {
          background: rgba(0, 245, 160, 0.07);
          border-left-color: var(--accent-400) !important;
          color: var(--text-primary);
        }
        [cmdk-item][aria-selected="true"] .cmd-item span:first-child {
          color: var(--accent-400);
        }
        /* Hover — non-selected items */
        [cmdk-item]:not([aria-selected="true"]):hover .cmd-item {
          background: rgba(255, 255, 255, 0.03);
        }
        /* Remove default cmdk focus ring */
        [cmdk-item] {
          outline: none;
          cursor: pointer;
        }
        /* Input */
        [cmdk-input] {
          all: unset;
          flex: 1;
          font-size: 14px;
          color: var(--text-primary);
          font-family: var(--font-body);
          caret-color: var(--accent-400);
          background: transparent;
        }
        [cmdk-input]::placeholder {
          color: var(--text-muted);
        }
        /* Empty state */
        [cmdk-empty] {
          padding: 48px 16px;
          text-align: center;
          font-size: 14px;
          color: var(--text-muted);
          font-family: var(--font-body);
        }
        /* List */
        [cmdk-list] {
          max-height: 380px;
          overflow-y: auto;
          padding: 8px;
          scrollbar-width: thin;
          scrollbar-color: var(--border-strong) transparent;
        }
        [cmdk-list]::-webkit-scrollbar {
          width: 4px;
        }
        [cmdk-list]::-webkit-scrollbar-thumb {
          background: var(--border-strong);
          border-radius: 2px;
        }
        /* Remove the default cmdk group heading */
        [cmdk-group-heading] {
          display: none;
        }
      `}</style>

      {/* ── Backdrop ─────────────────────────────────────────── */}
      <div
        className="fixed inset-0"
        style={{
          background: 'rgba(6,6,9,0.72)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          zIndex: 50,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '15vh',
        }}
        onClick={closeCommandPalette}
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        {/* ── Palette container ──────────────────────────────── */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 600,
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,245,160,0.04)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 500,
            animation: 'fade-up 200ms var(--ease-out-back) both',
          }}
        >
          <Command
            label="Command Palette"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                closeCommandPalette();
              }
            }}
            loop
            style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
          >
            {/* ── Search input ───────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              {/* Search icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ color: 'var(--text-muted)', flexShrink: 0 }}
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>

              <Command.Input
                autoFocus
                placeholder="Search commands, files, conversations…"
              />

              <Kbd>ESC</Kbd>
            </div>

            {/* ── Results list ───────────────────────────────── */}
            <Command.List>
              <Command.Empty>No commands found.</Command.Empty>

              {/* ════ GROUP: Layout ════ */}
              <Command.Group>
                <GroupHeading>Layout</GroupHeading>

                <CmdRow
                  icon="⊞"
                  label="Split Horizontal"
                  shortcut="⌘\"
                  onSelect={layout('split-horizontal')}
                />
                <CmdRow
                  icon="⊟"
                  label="Split Vertical"
                  shortcut="⌘⇧\"
                  onSelect={layout('split-vertical')}
                />
                <CmdRow
                  icon="□"
                  label="Editor Only"
                  shortcut="⌘E"
                  onSelect={layout('editor-only')}
                />
                <CmdRow
                  icon="─"
                  label="Terminal Only"
                  shortcut="⌘T"
                  onSelect={layout('terminal-only')}
                />
                <CmdRow
                  icon="💬"
                  label="Chat Only"
                  shortcut="⌘C"
                  onSelect={layout('chat-only')}
                />
                <CmdRow
                  icon="⊡"
                  label="Full IDE View"
                  shortcut="⌘F"
                  onSelect={layout('ide-full')}
                />
              </Command.Group>

              <Sep />

              {/* ════ GROUP: Navigation ════ */}
              <Command.Group>
                <GroupHeading>Navigation</GroupHeading>

                <CmdRow
                  icon="📂"
                  label="Go to File…"
                  shortcut="⌘P"
                  onSelect={() => run(() => {})}
                />
                <CmdRow
                  icon="📌"
                  label="Go to Line…"
                  shortcut="⌃G"
                  onSelect={() => run(() => {})}
                />
                <CmdRow
                  icon="🔍"
                  label="Search in Files…"
                  shortcut="⌘⇧F"
                  onSelect={() => run(() => {})}
                />
                <CmdRow
                  icon="🏠"
                  label="Go to Dashboard"
                  onSelect={() => run(() => navigate('/dashboard'))}
                />
                <CmdRow
                  icon="📊"
                  label="Go to Analytics"
                  onSelect={() => run(() => navigate('/analytics'))}
                />
                <CmdRow
                  icon="🔨"
                  label="Go to Build Monitor"
                  onSelect={() => run(() => navigate('/builds'))}
                />
                <CmdRow
                  icon="⚙️"
                  label="Go to Settings"
                  onSelect={() => run(() => navigate('/settings'))}
                />
                <CmdRow
                  icon="💳"
                  label="Go to Billing"
                  onSelect={() => run(() => navigate('/billing'))}
                />
              </Command.Group>

              <Sep />

              {/* ════ GROUP: Agent ════ */}
              <Command.Group>
                <GroupHeading>Agent</GroupHeading>

                <CmdRow
                  icon="🤖"
                  label="New AI Conversation"
                  onSelect={newConversation}
                />
                <CmdRow
                  icon="🗑"
                  label="Clear Current Chat"
                  onSelect={clearCurrentChat}
                />
              </Command.Group>

              <Sep />

              {/* ════ GROUP: Terminal ════ */}
              <Command.Group>
                <GroupHeading>Terminal</GroupHeading>

                <CmdRow
                  icon="➕"
                  label="New Terminal Tab"
                  shortcut="⌃`"
                  onSelect={newTerminalTab}
                />
                <CmdRow
                  icon="🗑"
                  label="Clear Terminal"
                  shortcut="⌃L"
                  onSelect={() => run(() => {})}
                />
              </Command.Group>

              <Sep />

              {/* ════ GROUP: Appearance ════ */}
              <Command.Group>
                <GroupHeading>Appearance</GroupHeading>

                <CmdRow
                  icon="🌙"
                  label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  shortcut="⌘⇧L"
                  onSelect={() => run(toggleTheme)}
                />
                <CmdRow
                  icon="🔬"
                  label={expertMode ? 'Disable Expert Mode' : 'Enable Expert Mode'}
                  onSelect={() => run(() => setExpertMode(!expertMode))}
                />
              </Command.Group>

              <Sep />

              {/* ════ GROUP: System ════ */}
              <Command.Group>
                <GroupHeading>System</GroupHeading>

                <CmdRow
                  icon="🔄"
                  label="Reload Page"
                  onSelect={() => window.location.reload()}
                />
              </Command.Group>
            </Command.List>

            {/* ── Footer hint bar ────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '8px 16px',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <Kbd>↑↓</Kbd> navigate
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <Kbd>↵</Kbd> select
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                <Kbd>ESC</Kbd> close
              </span>
            </div>
          </Command>
        </div>
      </div>
    </>
  );
}
