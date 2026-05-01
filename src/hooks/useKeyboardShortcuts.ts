// src/hooks/useKeyboardShortcuts.ts
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
    activeTabId,
    closeTab,
  } = useAppStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isMac = navigator.platform.toUpperCase().includes('MAC');
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Command Palette: Cmd+K or Ctrl+K
      if (ctrlOrCmd && e.key === 'k') {
        e.preventDefault();
        if (commandPaletteOpen) closeCommandPalette();
        else openCommandPalette();
        return;
      }

      // Alternate: Cmd+Shift+P
      if (ctrlOrCmd && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        openCommandPalette();
        return;
      }

      // Escape — close palette
      if (e.key === 'Escape' && commandPaletteOpen) {
        e.preventDefault();
        closeCommandPalette();
        return;
      }

      // Toggle theme: Cmd+Shift+L
      if (ctrlOrCmd && e.shiftKey && e.key === 'l') {
        e.preventDefault();
        toggleTheme();
        return;
      }

      // Close active tab: Cmd+W
      if (ctrlOrCmd && e.key === 'w') {
        if (activeTabId) {
          e.preventDefault();
          closeTab(activeTabId);
        }
        return;
      }

      // Layout shortcuts: Alt+H/V/E/T/C
      if (e.altKey) {
        const layoutMap: Record<string, LayoutMode> = {
          h: 'split-horizontal',
          v: 'split-vertical',
          e: 'editor-only',
          t: 'terminal-only',
          c: 'chat-only',
          f: 'ide-full',
        };
        const layoutMode = layoutMap[e.key.toLowerCase()];
        if (layoutMode) {
          e.preventDefault();
          setLayoutMode(layoutMode);
          return;
        }
      }

      // Navigation shortcuts
      if (ctrlOrCmd && e.shiftKey) {
        switch (e.key) {
          case 'd':
            e.preventDefault();
            navigate('/dashboard');
            break;
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, activeTabId, openCommandPalette, closeCommandPalette, setLayoutMode, toggleTheme, closeTab, navigate]);
}
