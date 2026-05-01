// src/components/layout/AppShell.tsx
import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { StatusBar } from './StatusBar';
import { CommandPalette } from '@/components/features/CommandPalette/CommandPalette';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAppStore } from '@/store/useAppStore';

interface AppShellProps {
  children: React.ReactNode;
  showSidebar?: boolean;
  showTopBar?: boolean;
  showStatusBar?: boolean;
}

export function AppShell({
  children,
  showSidebar = true,
  showTopBar = true,
  showStatusBar = true,
}: AppShellProps) {
  useKeyboardShortcuts();
  const { commandPaletteOpen } = useAppStore();

  return (
    <div className="bg-mesh min-h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Animated scan line overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div
          className="absolute w-full h-[1px] opacity-[0.015]"
          style={{
            background: 'linear-gradient(90deg, transparent, var(--accent-400), transparent)',
            animation: 'scan-line 8s linear infinite',
          }}
        />
      </div>

      {/* Mesh gradient blobs */}
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div
          className="absolute animate-drift-1"
          style={{
            top: '-10%',
            left: '-10%',
            width: '60%',
            height: '60%',
            background: 'radial-gradient(ellipse, rgba(0,245,160,0.04) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute animate-drift-2"
          style={{
            bottom: '-10%',
            right: '-10%',
            width: '50%',
            height: '60%',
            background: 'radial-gradient(ellipse, rgba(124,58,237,0.05) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col h-screen">
        {showTopBar && <TopBar />}

        <div className="flex flex-1 overflow-hidden">
          {showSidebar && <Sidebar />}

          <main className="flex-1 overflow-hidden relative">
            {children}
          </main>
        </div>

        {showStatusBar && <StatusBar />}
      </div>

      {commandPaletteOpen && <CommandPalette />}
    </div>
  );
}
