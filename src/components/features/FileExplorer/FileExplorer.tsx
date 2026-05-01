// src/components/features/FileExplorer/FileExplorer.tsx
import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useFileSystem } from '@/hooks/useFileSystem';
import { FileTreeNode } from './FileTreeNode';
import { FilePlus, FolderPlus, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';

export function FileExplorer() {
  const { fileTree, workspaceReady, workspaceError } = useAppStore();
  const { refreshTree, createFile, createDir } = useFileSystem();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    setIsRefreshing(true);
    await refreshTree();
    setIsRefreshing(false);
  }

  async function handleNewFile() {
    const name = window.prompt('New file name (e.g. index.ts):');
    if (!name?.trim()) return;
    await createFile(`/${name.trim()}`);
  }

  async function handleNewFolder() {
    const name = window.prompt('New folder name:');
    if (!name?.trim()) return;
    await createDir(`/${name.trim()}`);
  }

  function filterTree(nodes: typeof fileTree, q: string): typeof fileTree {
    if (!q) return nodes;
    const lower = q.toLowerCase();
    return nodes.reduce<typeof fileTree>((acc, node) => {
      if (node.type === 'directory' && node.children) {
        const filtered = filterTree(node.children, q);
        if (filtered.length > 0) acc.push({ ...node, children: filtered });
      } else if (node.name.toLowerCase().includes(lower)) {
        acc.push(node);
      }
      return acc;
    }, []);
  }

  const displayTree = filterTree(fileTree, searchQuery);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--bg-void)', borderRight: '1px solid var(--border-subtle)' }}
      role="region"
      aria-label="File Explorer"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <span className="text-label-sm" style={{ color: 'var(--text-muted)' }}>Explorer</span>
        <div className="flex items-center gap-1">
          <button
            className="p-1.5 rounded transition-all hover:opacity-80 min-w-[28px] min-h-[28px] flex items-center justify-center"
            style={{ color: 'var(--text-muted)' }}
            onClick={handleNewFile}
            aria-label="New file"
            title="New file"
          >
            <FilePlus size={13} />
          </button>
          <button
            className="p-1.5 rounded transition-all hover:opacity-80 min-w-[28px] min-h-[28px] flex items-center justify-center"
            style={{ color: 'var(--text-muted)' }}
            onClick={handleNewFolder}
            aria-label="New folder"
            title="New folder"
          >
            <FolderPlus size={13} />
          </button>
          <button
            className={`p-1.5 rounded transition-all hover:opacity-80 min-w-[28px] min-h-[28px] flex items-center justify-center ${isRefreshing ? 'animate-spin-slow' : ''}`}
            style={{ color: 'var(--text-muted)' }}
            onClick={handleRefresh}
            aria-label="Refresh file tree"
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md" style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)' }}>
          <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} aria-hidden="true" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files…"
            className="flex-1 bg-transparent outline-none text-xs"
            style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)', caretColor: 'var(--accent-400)' }}
            aria-label="Search files"
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1" role="tree" aria-label="File tree">
        {!workspaceReady && !workspaceError && (
          <div className="px-4 py-8 text-center">
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3" style={{ borderColor: 'var(--accent-400)' }} aria-hidden="true" />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Initializing workspace…</p>
          </div>
        )}

        {workspaceError && (
          <div className="px-4 py-6">
            <div className="rounded-lg p-3" style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)' }}>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--danger)' }}>Workspace Error</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{workspaceError}</p>
            </div>
          </div>
        )}

        {workspaceReady && displayTree.length === 0 && (
          <div className="px-4 py-8 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {searchQuery ? 'No files match your search' : 'Empty workspace — create a file to get started'}
            </p>
            {!searchQuery && (
              <button
                className="mt-3 text-xs"
                style={{ color: 'var(--accent-400)' }}
                onClick={handleNewFile}
              >
                + New File
              </button>
            )}
          </div>
        )}

        {workspaceReady && displayTree.map((node) => (
          <FileTreeNode key={node.path} node={node} depth={0} />
        ))}
      </div>
    </div>
  );
}
