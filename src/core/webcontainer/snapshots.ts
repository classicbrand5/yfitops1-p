// src/core/webcontainer/snapshots.ts
// Save and restore complete WebContainer filesystem snapshots
// Stored in localStorage — max 5 snapshots (FIFO eviction)

import { buildFileTree, readFile, writeFile, mkdir } from '@/core/webcontainer/fs';
import { isWebContainerReady } from '@/core/webcontainer/webcontainer';
import type { FileNode } from '@/types/dev.types';

const STORAGE_KEY = 'yfitops-workspace-snapshots';
const MAX_SNAPSHOTS = 5;

export interface WorkspaceSnapshot {
  id: string;
  label: string;
  createdAt: string;
  files: Record<string, string>;
  fileCount: number;
}

function flattenTree(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) result.push(...flattenTree(node.children));
  }
  return result;
}

export async function captureSnapshot(label?: string): Promise<WorkspaceSnapshot> {
  if (!isWebContainerReady()) {
    throw new Error('WebContainer not ready');
  }

  const tree = await buildFileTree('/');
  const files: Record<string, string> = {};
  const allNodes = flattenTree(tree);

  for (const node of allNodes) {
    if (node.type === 'file') {
      try {
        files[node.path] = await readFile(node.path);
      } catch {
        // Skip unreadable files (binary, etc.)
      }
    }
  }

  const snapshot: WorkspaceSnapshot = {
    id: crypto.randomUUID(),
    label: label ?? `Snapshot ${new Date().toLocaleTimeString()}`,
    createdAt: new Date().toISOString(),
    files,
    fileCount: Object.keys(files).length,
  };

  return snapshot;
}

export async function restoreSnapshot(snapshot: WorkspaceSnapshot): Promise<void> {
  if (!isWebContainerReady()) {
    throw new Error('WebContainer not ready');
  }

  for (const [path, content] of Object.entries(snapshot.files)) {
    // Ensure parent directories exist
    const segments = path.split('/').filter(Boolean);
    segments.pop();
    if (segments.length > 0) {
      let current = '';
      for (const seg of segments) {
        current += '/' + seg;
        try { await mkdir(current); } catch { /* exists */ }
      }
    }
    await writeFile(path, content);
  }
}

export function saveSnapshotToStorage(snapshot: WorkspaceSnapshot): void {
  const all = getSnapshotsFromStorage();
  all.unshift(snapshot); // newest first
  const trimmed = all.slice(0, MAX_SNAPSHOTS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function getSnapshotsFromStorage(): WorkspaceSnapshot[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkspaceSnapshot[]) : [];
  } catch {
    return [];
  }
}

export function deleteSnapshotFromStorage(id: string): void {
  const all = getSnapshotsFromStorage().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
