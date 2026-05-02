
/**
 * ARCHITECTURAL CONTRACT — window.__yfitops_container
 * ─────────────────────────────────────────────────────
 * AgentChat lives deep in the component tree and needs the WebContainer
 * instance to execute actions. Prop-drilling this through WorkspacePage
 * would require a React Context wrapper that restructures the entire layout.
 *
 * Solution: useWebContainer sets this global after boot. AgentChat polls
 * it every 500ms until available, stores in containerRef.
 *
 * DO NOT remove or replace without a full Context refactor plan.
 * Polling stops as soon as the reference is acquired (clearInterval).
 */
// Phase 3: real boot with progress states + seed files
import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { getWebContainer, isWebContainerReady } from '@/core/webcontainer/webcontainer';
import { buildFileTree, writeFile, exists } from '@/core/webcontainer/fs';
import { toast } from 'sonner';

export type WebContainerStatus = 'idle' | 'booting' | 'seeding' | 'ready' | 'error';

interface BootProgress {
  step: string;
  percent: number;
}

// ── Seed files written on first boot ──────────────────────────
const SEED_FILES: Record<string, string> = {
  '/package.json': JSON.stringify({
    name: 'yfitops-workspace',
    version: '0.0.1',
    private: true,
    scripts: {
      dev: 'node server.js',
      test: 'echo "No tests configured yet"',
      build: 'echo "No build configured yet"',
    },
    dependencies: {},
    devDependencies: {},
  }, null, 2),
  '/README.md': `# YFitOps Workspace

Welcome to your **YFitOps AI Agent** workspace.

## Getting Started

Ask the AI agent anything — it can:
- Write and edit files in this workspace
- Run terminal commands
- Search your codebase
- Propose and apply code changes

## Tips

- Use \`Ctrl+Enter\` to send a message to the AI
- Use \`Ctrl+K\` to open the command palette
- Right-click files in the explorer for context menu actions
`,
  '/src/index.ts': `// Your workspace entry point
// The AI agent will help you build from here.

console.log("YFitOps workspace ready");
`,
  '/.gitignore': `node_modules/
dist/
build/
.next/
.turbo/
*.local
.env
.env.local
`,
};

export function useWebContainer() {
  const [status, setStatus] = useState<WebContainerStatus>(
    isWebContainerReady() ? 'ready' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<BootProgress>({ step: '', percent: 0 });
  const bootedRef = useRef(false);
  const { setWorkspaceReady, setFileTree, addNotification } = useAppStore();

  const boot = useCallback(async () => {
    if (bootedRef.current || isWebContainerReady()) {
      // Already booted — just refresh tree
      if (isWebContainerReady()) {
        const tree = await buildFileTree('/');
        setFileTree(tree);
        setStatus('ready');
        setWorkspaceReady(true);
      }
      return;
    }
    bootedRef.current = true;
    setStatus('booting');
    setError(null);

    try {
      // Step 1: Boot WebContainer
      setProgress({ step: 'Starting WebContainer runtime…', percent: 10 });
      await getWebContainer();

      setProgress({ step: 'Runtime ready — checking workspace…', percent: 40 });

      // Step 2: Seed files if this is a fresh workspace
      setStatus('seeding');
      setProgress({ step: 'Setting up workspace files…', percent: 60 });

      const hasPackageJson = await exists('/package.json');
      if (!hasPackageJson) {
        // Fresh workspace — ensure directories exist before writing files
        const wc = await getWebContainer();
        const wcWithFs = wc as { fs: { mkdir(path: string, opts?: { recursive?: boolean }): Promise<void> } };
        for (const dir of ['/src', '/public']) {
          try {
            await wcWithFs.fs.mkdir(dir, { recursive: true });
          } catch {
            // Directory may already exist — ignore
          }
        }

        // Write seed files
        for (const [path, content] of Object.entries(SEED_FILES)) {
          await writeFile(path, content);
        }
        setProgress({ step: 'Workspace initialized…', percent: 80 });
      }

      // Step 3: Build initial file tree
      setProgress({ step: 'Scanning file system…', percent: 90 });
      const tree = await buildFileTree('/');
      setFileTree(tree);

      setProgress({ step: 'Ready', percent: 100 });
      setStatus('ready');
      setWorkspaceReady(true);

      addNotification({
        type: 'success',
        title: 'Workspace ready',
        message: 'WebContainer booted and file system is available.',
      });

      console.log('[WebContainer] Fully initialized');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[WebContainer] Boot error:', err);
      setStatus('error');
      setError(msg);
      setWorkspaceReady(false, msg);
      bootedRef.current = false; // allow retry

      // Don't throw — show error in UI + toast
      toast.error('WebContainer failed to start', {
        description: msg.slice(0, 120),
        action: { label: 'Retry', onClick: () => void boot() },
        duration: 10_000,
      });
    }
  }, [setWorkspaceReady, setFileTree, addNotification]);

  const refreshFileTree = useCallback(async () => {
    if (!isWebContainerReady()) return;
    try {
      const tree = await buildFileTree('/');
      setFileTree(tree);
    } catch (err) {
      console.error('[FS] buildFileTree error:', err);
    }
  }, [setFileTree]);

  // Auto-boot on workspace page
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.location.pathname.includes('/workspace') &&
      !bootedRef.current &&
      !isWebContainerReady()
    ) {
      void boot();
    }
  }, [boot]);

  return { status, error, progress, boot, refreshFileTree };
}
