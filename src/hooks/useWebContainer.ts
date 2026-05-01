// src/hooks/useWebContainer.ts
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getWebContainer, isWebContainerReady } from '@/core/webcontainer/webcontainer';
import { buildFileTree } from '@/core/webcontainer/fs';

export type WebContainerStatus = 'idle' | 'booting' | 'ready' | 'error';

export function useWebContainer() {
  const [status, setStatus] = useState<WebContainerStatus>(
    isWebContainerReady() ? 'ready' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const bootedRef = useRef(false);
  const { setWorkspaceReady, setFileTree } = useAppStore();

  async function boot() {
    if (bootedRef.current || isWebContainerReady()) return;
    bootedRef.current = true;
    setStatus('booting');

    try {
      await getWebContainer();
      setStatus('ready');
      setWorkspaceReady(true);

      // Initial file tree scan
      const tree = await buildFileTree('/');
      setFileTree(tree);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('error');
      setError(msg);
      setWorkspaceReady(false, msg);
      console.error('[WebContainer] Boot error:', err);
    }
  }

  async function refreshFileTree() {
    if (!isWebContainerReady()) return;
    const tree = await buildFileTree('/');
    setFileTree(tree);
  }

  useEffect(() => {
    // Auto-boot when hook is first used in workspace
    if (typeof window !== 'undefined' && window.location.pathname.includes('/workspace')) {
      void boot();
    }
  }, []);

  return { status, error, boot, refreshFileTree };
}
