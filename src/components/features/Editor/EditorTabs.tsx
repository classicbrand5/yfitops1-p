// src/components/features/Editor/EditorTabs.tsx
import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { X } from 'lucide-react';
import { getFileIcon } from '@/types/dev.types';

export function EditorTabs() {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useAppStore();

  if (openTabs.length === 0) return null;

  return (
    <div
      className="flex items-center overflow-x-auto flex-shrink-0 border-b"
      style={{
        background: 'var(--bg-void)',
        borderColor: 'var(--border-subtle)',
        height: 36,
      }}
      role="tablist"
      aria-label="Open files"
    >
      {openTabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const icon = getFileIcon(tab.name);

        return (
          <div
            key={tab.id}
            className={`tab-item ${isActive ? 'active' : ''}`}
            style={{ maxWidth: 200 }}
            role="tab"
            aria-selected={isActive}
            aria-controls={`editor-panel-${tab.id}`}
          >
            <button
              className="flex items-center gap-1.5 flex-1 min-w-0 h-full bg-transparent border-none"
              style={{ color: 'inherit', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
              onClick={() => setActiveTab(tab.id)}
              aria-label={`Open ${tab.name}`}
            >
              <span className="flex-shrink-0" style={{ fontSize: 11 }} aria-hidden="true">{icon}</span>
              <span className="truncate text-xs">{tab.name}</span>
              {tab.isDirty && (
                <span
                  className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
                  style={{ background: 'var(--accent-400)' }}
                  aria-label="Unsaved changes"
                />
              )}
            </button>
            <button
              className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-sm ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100"
              style={{ color: 'var(--text-muted)' }}
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
              aria-label={`Close ${tab.name}`}
            >
              <X size={10} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
