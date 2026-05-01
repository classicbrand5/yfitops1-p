// src/hooks/useKeyboardShortcuts.ts
// Global keyboard shortcut registry — registered once in AppShell via useKeyboardShortcuts().
// All handlers call e.preventDefault() to avoid browser conflicts.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import type { LayoutMode } from '@/types/dev.types';

export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  const {
    openCommandPalette,
    closeCommandPalette,
    commandPaletteOpen,
    setLayoutMode,
    toggleTheme,
    setExpertMode,
    expertMode,
    activeTabId,
    closeTab,
    createTerminalSession,
  } = useAppStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // ── Command Palette: Cmd+K or Ctrl+K ──────────────────
      if (ctrlOrCmd && !e.shiftKey && !e.altKey && e.key === 'k') {
        e.preventDefault();
        if (commandPaletteOpen) closeCommandPalette();
        else openCommandPalette();
        return;
      }

      // ── Alternate palette open: Cmd+Shift+P ───────────────
      if (ctrlOrCmd && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      // ── Escape — close palette ────────────────────────────
      if (e.key === 'Escape' && commandPaletteOpen) {
        e.preventDefault();
        closeCommandPalette();
        return;
      }

      // ── Theme toggle: Cmd+Shift+L ─────────────────────────
      if (ctrlOrCmd && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        toggleTheme();
        return;
      }

      // ── Close active tab: Cmd+W ────────────────────────────
      if (ctrlOrCmd && !e.shiftKey && !e.altKey && e.key === 'w') {
        if (activeTabId) {
          e.preventDefault();
          closeTab(activeTabId);
        }
        return;
      }

      // ── New terminal tab: Ctrl+` ──────────────────────────
      // Note: backtick key is '`' (KeyCode 192)
      if (e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.key === '`') {
        e.preventDefault();
        const id = crypto.randomUUID();
        createTerminalSession(id, '/');
        navigate('/workspace');
        return;
      }

      // ── Layout shortcuts: Alt+H/V/E/T/C/F ────────────────
      if (e.altKey && !ctrlOrCmd) {
        const layoutMap: Record<string, LayoutMode> = {
          h: 'split-horizontal',
          H: 'split-horizontal',
          v: 'split-vertical',
          V: 'split-vertical',
          e: 'editor-only',
          E: 'editor-only',
          t: 'terminal-only',
          T: 'terminal-only',
          c: 'chat-only',
          C: 'chat-only',
          f: 'ide-full',
          F: 'ide-full',
        };
        const mode = layoutMap[e.key];
        if (mode) {
          e.preventDefault();
          setLayoutMode(mode);
          return;
        }
      }

      // ── Expert Mode toggle: Cmd+Shift+E ──────────────────
      if (ctrlOrCmd && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        setExpertMode(!expertMode);
        return;
      }

      // ── Navigate to Dashboard: Cmd+Shift+D ───────────────
      if (ctrlOrCmd && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        navigate('/dashboard');
        return;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    commandPaletteOpen,
    activeTabId,
    expertMode,
    openCommandPalette,
    closeCommandPalette,
    setLayoutMode,
    toggleTheme,
    setExpertMode,
    closeTab,
    createTerminalSession,
    navigate,
  ]);
}
