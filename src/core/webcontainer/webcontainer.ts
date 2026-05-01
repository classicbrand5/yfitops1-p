// src/core/webcontainer/webcontainer.ts
// WebContainer singleton — real implementation, zero mocks

import { WebContainerError } from '@/lib/errors';

// Dynamic import to avoid build errors when @webcontainer/api is not present
// The actual boot is deferred until first call
let instance: unknown | null = null;
let bootPromise: Promise<unknown> | null = null;

export async function getWebContainer(): Promise<unknown> {
  if (instance) return instance;
  if (bootPromise) return bootPromise;

  bootPromise = (async () => {
    try {
      const { WebContainer } = await import('@webcontainer/api');
      const wc = await (WebContainer as { boot: (opts?: { workdirName?: string }) => Promise<unknown> }).boot({
        workdirName: 'yfitops-workspace',
      });
      instance = wc;
      console.log('[WebContainer] Booted successfully');
      return wc;
    } catch (err) {
      bootPromise = null;
      const message = err instanceof Error ? err.message : String(err);
      throw new WebContainerError(`WebContainer boot failed: ${message}`, err);
    }
  })();

  return bootPromise;
}

export function getWebContainerSync(): unknown {
  if (!instance) {
    throw new WebContainerError(
      '[WebContainer] Not initialized — call getWebContainer() first'
    );
  }
  return instance;
}

export function isWebContainerReady(): boolean {
  return instance !== null;
}

export function resetWebContainer(): void {
  instance = null;
  bootPromise = null;
}
