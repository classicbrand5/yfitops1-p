// src/core/webcontainer/fs.ts
// Real WebContainer filesystem API — all functions throw on failure

import { getWebContainerSync } from './webcontainer';
import { FilesystemError } from '@/lib/errors';
import type { FileNode } from '@/types/dev.types';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'build', '.cache', 'coverage', '.turbo']);
const MAX_DEPTH = 8;

type WC = {
  fs: {
    readFile(path: string, encoding: 'utf-8'): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    readdir(path: string, options?: { withFileTypes?: boolean }): Promise<Array<{ name: string; isFile(): boolean; isDirectory(): boolean }>>;
    rm(path: string, options?: { recursive?: boolean }): Promise<void>;
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  };
};

function getWC(): WC {
  return getWebContainerSync() as WC;
}

export async function readFile(path: string): Promise<string> {
  try {
    return await getWC().fs.readFile(path, 'utf-8');
  } catch (err) {
    throw new FilesystemError(`readFile failed for "${path}": ${err}`, path);
  }
}

export async function writeFile(path: string, content: string): Promise<void> {
  try {
    await getWC().fs.writeFile(path, content);
  } catch (err) {
    throw new FilesystemError(`writeFile failed for "${path}": ${err}`, path);
  }
}

export async function readdir(dirPath: string): Promise<Array<{ name: string; isFile(): boolean; isDirectory(): boolean }>> {
  try {
    return await getWC().fs.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    throw new FilesystemError(`readdir failed for "${dirPath}": ${err}`, dirPath);
  }
}

export async function unlink(path: string): Promise<void> {
  try {
    await getWC().fs.rm(path, { recursive: false });
  } catch (err) {
    throw new FilesystemError(`unlink failed for "${path}": ${err}`, path);
  }
}

export async function mkdir(path: string): Promise<void> {
  try {
    await getWC().fs.mkdir(path, { recursive: true });
  } catch (err) {
    throw new FilesystemError(`mkdir failed for "${path}": ${err}`, path);
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await getWC().fs.readFile(path, 'utf-8');
    return true;
  } catch {
    try {
      await getWC().fs.readdir(path);
      return true;
    } catch {
      return false;
    }
  }
}

export async function buildFileTree(rootPath = '/', depth = 0): Promise<FileNode[]> {
  if (depth >= MAX_DEPTH) return [];

  let entries: Array<{ name: string; isFile(): boolean; isDirectory(): boolean }>;
  try {
    entries = await readdir(rootPath);
  } catch {
    return [];
  }

  const nodes: FileNode[] = [];

  for (const entry of entries) {
    const name = entry.name;
    if (name.startsWith('.') && depth === 0 && SKIP_DIRS.has(name)) continue;
    if (SKIP_DIRS.has(name)) continue;

    const fullPath = rootPath === '/' ? `/${name}` : `${rootPath}/${name}`;

    if (entry.isDirectory()) {
      const children = await buildFileTree(fullPath, depth + 1);
      nodes.push({ path: fullPath, name, type: 'directory', children });
    } else if (entry.isFile()) {
      nodes.push({ path: fullPath, name, type: 'file' });
    }
  }

  // Sort: directories first, then files, each alphabetically
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}
