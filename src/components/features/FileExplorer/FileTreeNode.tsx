// src/components/features/FileExplorer/FileTreeNode.tsx
// File tree node with heatmap dots, enhanced context menu, and ConfirmModal for delete
import React, { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useFileSystem } from '@/hooks/useFileSystem';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FilePlus, FolderPlus, Pencil, Copy, Trash2, Terminal } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { getFileIcon } from '@/types/dev.types';
import { toast } from 'sonner';
import type { FileNode } from '@/types/dev.types';

interface FileTreeNodeProps {
  node: FileNode;
  depth: number;
  // Agent-modified paths passed from parent for heatmap
  agentModifiedPaths?: Set<string>;
}

export function FileTreeNode({ node, depth, agentModifiedPaths }: FileTreeNodeProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);

  const {
    expandedFolders,
    toggleFolder,
    selectedFilePath,
    setSelectedFile,
    dirtyFiles,
    openTabs,
    activeTerminalId,
    appendTerminalOutput,
  } = useAppStore();
  const { openFileInEditor, deleteFile, createFile, createDirectory } = useFileSystem();

  const isExpanded = expandedFolders.includes(node.path);
  const isSelected = selectedFilePath === node.path;
  const isDirty = dirtyFiles.includes(node.path);
  const isOpen = openTabs.some((t) => t.path === node.path);
  const isAgentModified = agentModifiedPaths?.has(node.path) ?? false;

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

  function closeMenu() {
    setContextMenu(null);
  }

  async function handleNewFile() {
    const name = window.prompt('New file name:');
    if (!name?.trim()) { closeMenu(); return; }
    const newPath = node.type === 'directory' ? `${node.path}/${name.trim()}` : `${node.path.split('/').slice(0, -1).join('/')}/${name.trim()}`;
    await createFile(newPath);
    closeMenu();
  }

  async function handleNewFolder() {
    const name = window.prompt('New folder name:');
    if (!name?.trim()) { closeMenu(); return; }
    const newPath = node.type === 'directory' ? `${node.path}/${name.trim()}` : `${node.path.split('/').slice(0, -1).join('/')}/${name.trim()}`;
    if (createDirectory) {
      await createDirectory(newPath);
    }
    closeMenu();
  }

  function handleCopyPath() {
    navigator.clipboard.writeText(node.path);
    toast.success('Path copied', { description: node.path });
    closeMenu();
  }

  function handleRename() {
    setRenaming(true);
    setRenameValue(node.name);
    closeMenu();
  }

  function handleRenameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      setRenaming(false);
      toast.info('Rename via agent: ask AI to rename this file');
    }
    if (e.key === 'Escape') {
      setRenaming(false);
      setRenameValue(node.name);
    }
  }

  function handleOpenInTerminal() {
    if (activeTerminalId) {
      const dir = node.type === 'directory' ? node.path : node.path.split('/').slice(0, -1).join('/');
      appendTerminalOutput(activeTerminalId, `cd ${dir}\n`);
    }
    closeMenu();
  }

  async function handleDeleteConfirmed() {
    setConfirmDelete(false);
    await deleteFile(node.path);
  }

  const fileIcon = getFileIcon(node.name);

  return (
    <>
      {/* Confirm delete modal */}
      <ConfirmModal
        open={confirmDelete}
        title={`Delete "${node.name}"?`}
        description={`This will permanently delete ${node.type === 'directory' ? 'this folder and all its contents' : 'this file'}. This action cannot be undone.`}
        detail={node.path}
        isDestructive
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setConfirmDelete(false)}
      />

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
        role="treeitem"
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

        {/* Name or rename input */}
        {renaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={() => setRenaming(false)}
            autoFocus
            className="flex-1 text-xs bg-transparent border-b outline-none"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', borderColor: 'var(--accent-400)' }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-xs flex-1 truncate"
            style={{
              color: isSelected ? 'var(--text-primary)' : isOpen ? 'var(--text-secondary)' : 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            {node.name}
          </span>
        )}

        {/* File heatmap dots */}
        <span className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true">
          {isDirty && <span className="file-dot file-dot-amber" title="Unsaved changes" />}
          {isOpen && !isDirty && <span className="file-dot file-dot-violet" title="Open in editor" />}
          {isAgentModified && <span className="file-dot file-dot-mint" title="Modified by agent" />}
        </span>

        {/* Dirty indicator (always visible) */}
        {isDirty && (
          <span
            className="flex-shrink-0 w-1.5 h-1.5 rounded-full ml-1"
            style={{ background: 'var(--accent-400)' }}
            aria-label="Unsaved changes"
          />
        )}
      </div>

      {/* Children */}
      {node.type === 'directory' && isExpanded && node.children && (
        <div role="group">
          {node.children.map((child) => (
            <FileTreeNode key={child.path} node={child} depth={depth + 1} agentModifiedPaths={agentModifiedPaths} />
          ))}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <>
          {/* Invisible overlay to catch outside clicks */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 49 }}
            onClick={closeMenu}
            onContextMenu={(e) => { e.preventDefault(); closeMenu(); }}
          />
          <div
            className="fixed glass rounded-lg py-1 z-50 animate-fade-in"
            style={{
              left: Math.min(contextMenu.x, window.innerWidth - 200),
              top: Math.min(contextMenu.y, window.innerHeight - 220),
              minWidth: 180,
              boxShadow: 'var(--shadow-lg)',
            }}
            role="menu"
            aria-label="File context menu"
          >
            <button className="context-menu-item" onClick={handleNewFile} role="menuitem">
              <FilePlus size={11} aria-hidden="true" /> New File
            </button>
            <button className="context-menu-item" onClick={handleNewFolder} role="menuitem">
              <FolderPlus size={11} aria-hidden="true" /> New Folder
            </button>
            <div className="my-1" style={{ height: 1, background: 'var(--border-subtle)' }} role="separator" />
            <button className="context-menu-item" onClick={handleRename} role="menuitem">
              <Pencil size={11} aria-hidden="true" /> Rename
            </button>
            <button className="context-menu-item" onClick={handleCopyPath} role="menuitem">
              <Copy size={11} aria-hidden="true" /> Copy Path
            </button>
            {activeTerminalId && (
              <button className="context-menu-item" onClick={handleOpenInTerminal} role="menuitem">
                <Terminal size={11} aria-hidden="true" /> Open in Terminal
              </button>
            )}
            <div className="my-1" style={{ height: 1, background: 'var(--border-subtle)' }} role="separator" />
            <button
              className="context-menu-item"
              style={{ color: 'var(--danger)' }}
              onClick={() => { setConfirmDelete(true); closeMenu(); }}
              role="menuitem"
            >
              <Trash2 size={11} aria-hidden="true" /> Delete
            </button>
          </div>
        </>
      )}
    </>
  );
}
