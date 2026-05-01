// src/components/features/FileExplorer/FileTreeNode.tsx
import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useFileSystem } from '@/hooks/useFileSystem';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { getFileIcon } from '@/types/dev.types';
import type { FileNode } from '@/types/dev.types';

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
}

export function FileTreeNode({ node, depth }: FileTreeNodeProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const {
    expandedFolders,
    toggleFolder,
    selectedFilePath,
    setSelectedFile,
    dirtyFiles,
    openTabs,
  } = useAppStore();
  const { openFileInEditor, deleteFile, createFile } = useFileSystem();

  const isExpanded = expandedFolders.includes(node.path);
  const isSelected = selectedFilePath === node.path;
  const isDirty = dirtyFiles.includes(node.path);
  const isOpen = openTabs.some((t) => t.path === node.path);

  const indentPx = depth * 12 + 8;

  function handleClick() {
    if (node.type === 'directory') {
      toggleFolder(node.path);
      setSelectedFile(node.path);
    } else {
      setSelectedFile(node.path);
      openFileInEditor(node.path);
    }
    setContextMenu(null);
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
    if (e.key === 'Escape') {
      setContextMenu(null);
    }
  }

  async function handleDelete() {
    if (window.confirm(`Delete "${node.name}"?`)) {
      await deleteFile(node.path);
    }
    setContextMenu(null);
  }

  async function handleNewFile() {
    const name = window.prompt('New file name:');
    if (!name?.trim()) { setContextMenu(null); return; }
    const newPath = `${node.path}/${name.trim()}`;
    await createFile(newPath);
    setContextMenu(null);
  }

  const fileIcon = getFileIcon(node.name);

  return (
    <>
      <div
        className="flex items-center gap-1.5 py-0.5 cursor-pointer rounded-sm transition-all group relative min-h-[26px]"
        style={{
          paddingLeft: indentPx,
          paddingRight: 8,
          background: isSelected ? 'rgba(0,245,160,0.06)' : 'transparent',
          borderLeft: isSelected ? '2px solid var(--accent-400)' : '2px solid transparent',
        }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        role={node.type === 'directory' ? 'treeitem' : 'treeitem'}
        aria-expanded={node.type === 'directory' ? isExpanded : undefined}
        aria-selected={isSelected}
        tabIndex={0}
        aria-label={`${node.type === 'directory' ? 'Folder' : 'File'}: ${node.name}`}
      >
        {/* Expand chevron for directories */}
        {node.type === 'directory' ? (
          <span className="flex-shrink-0" aria-hidden="true">
            {isExpanded
              ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
              : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />
            }
          </span>
        ) : (
          <span className="w-3 flex-shrink-0" aria-hidden="true" />
        )}

        {/* Icon */}
        <span className="flex-shrink-0 text-sm" aria-hidden="true">
          {node.type === 'directory'
            ? (isExpanded ? <FolderOpen size={13} style={{ color: '#FBBF24' }} /> : <Folder size={13} style={{ color: '#FBBF24' }} />)
            : <span style={{ fontSize: 12 }}>{fileIcon}</span>
          }
        </span>

        {/* Name */}
        <span
          className="text-xs flex-1 truncate"
          style={{
            color: isSelected ? 'var(--text-primary)' : isOpen ? 'var(--text-secondary)' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {node.name}
        </span>

        {/* Dirty indicator */}
        {isDirty && (
          <span
            className="flex-shrink-0 w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--accent-400)' }}
            aria-label="Unsaved changes"
          />
        )}
      </div>

      {/* Children */}
      {node.type === 'directory' && isExpanded && node.children && (
        <div role="group">
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} depth={depth + 1} />
          ))}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed glass rounded-lg py-1 z-50 animate-fade-in"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            minWidth: 180,
            boxShadow: 'var(--shadow-lg)',
          }}
          onMouseLeave={() => setContextMenu(null)}
          role="menu"
          aria-label="File context menu"
        >
          {node.type === 'directory' && (
            <button
              className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-all"
              style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
              onClick={handleNewFile}
              role="menuitem"
            >
              New File
            </button>
          )}
          <button
            className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-all"
            style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}
            onClick={() => { navigator.clipboard.writeText(node.path); setContextMenu(null); }}
            role="menuitem"
          >
            Copy Path
          </button>
          <div className="my-1" style={{ height: 1, background: 'var(--border-subtle)' }} role="separator" />
          <button
            className="w-full text-left px-3 py-2 text-xs hover:opacity-80 transition-all"
            style={{ color: 'var(--danger)', fontFamily: 'var(--font-body)' }}
            onClick={handleDelete}
            role="menuitem"
          >
            Delete
          </button>
        </div>
      )}
    </>
  );
}
