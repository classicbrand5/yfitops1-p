// src/hooks/useFileSystem.ts
import { useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { readFile, writeFile, unlink, mkdir, buildFileTree } from '@/core/webcontainer/fs';
import { isWebContainerReady } from '@/core/webcontainer/webcontainer';
import { getLanguageFromPath } from '@/types/dev.types';
import { toast } from 'sonner';

export function useFileSystem() {
  const { setFileTree, openFile, markTabDirty, openTabs, activeTabId } = useAppStore();

  const refreshTree = useCallback(async () => {
    if (!isWebContainerReady()) return;
    try {
      const tree = await buildFileTree('/');
      setFileTree(tree);
    } catch (err) {
      console.error('[FS] buildFileTree error:', err);
    }
  }, [setFileTree]);

  const openFileInEditor = useCallback(async (path: string) => {
    const language = getLanguageFromPath(path);
    openFile(path, language);
  }, [openFile]);

  const saveFile = useCallback(async (path: string, content: string) => {
    if (!isWebContainerReady()) {
      toast.error('WebContainer not ready', { description: 'Cannot save file — workspace is not initialized.' });
      return;
    }
    await writeFile(path, content);
    // Mark tab clean
    const tab = openTabs.find((t) => t.path === path);
    if (tab) markTabDirty(tab.id, false);
    toast.success(`Saved ${path.split('/').pop()}`);
  }, [openTabs, markTabDirty]);

  const deleteFile = useCallback(async (path: string) => {
    if (!isWebContainerReady()) return;
    await unlink(path);
    await refreshTree();
    toast.success(`Deleted ${path.split('/').pop()}`);
  }, [refreshTree]);

  const createFile = useCallback(async (path: string, initialContent = '') => {
    if (!isWebContainerReady()) return;
    await writeFile(path, initialContent);
    await refreshTree();
    openFile(path, getLanguageFromPath(path));
    toast.success(`Created ${path.split('/').pop()}`);
  }, [refreshTree, openFile]);

  const createDir = useCallback(async (path: string) => {
    if (!isWebContainerReady()) return;
    await mkdir(path);
    await refreshTree();
    toast.success(`Created folder ${path.split('/').pop()}`);
  }, [refreshTree]);

  const readFileContent = useCallback(async (path: string): Promise<string> => {
    return readFile(path);
  }, []);

  return {
    refreshTree,
    openFileInEditor,
    saveFile,
    deleteFile,
    createFile,
    createDir,
    createDirectory: createDir,  // alias used by FileTreeNode context menu
    readFileContent,
    activeTabId,
  };
}
