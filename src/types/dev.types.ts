// src/types/dev.types.ts
// Development environment and workspace types

export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  size?: number;
  lastModified?: number;
}

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  isDirty: boolean;
  language: string;
  cursorLine?: number;
  cursorCol?: number;
}

export type ProcessStatus = 'running' | 'exited' | 'killed' | 'errored';

export interface TerminalSession {
  id: string;
  title: string;
  isRunning: boolean;
  exitCode?: number;
  pid?: number;
  output: string[];
  cwd: string;
  createdAt: number;
}

export interface ProcessRecord {
  id: string;
  command: string;
  status: ProcessStatus;
  exitCode?: number;
  startedAt: number;
  endedAt?: number;
  output: string[];
}

export type LayoutMode =
  | 'editor-only'
  | 'split-horizontal'
  | 'split-vertical'
  | 'terminal-only'
  | 'chat-only'
  | 'ide-full';

export type PanelId = 'chat' | 'editor' | 'terminal' | 'explorer' | 'builds' | 'analytics';

export interface BuildRecord {
  id: string;
  repoId: string;
  repoName: string;
  branch: string;
  commitSha?: string;
  commitMessage?: string;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  startedAt?: number;
  finishedAt?: number;
  durationSeconds?: number;
  triggeredBy: string;
  logUrl?: string;
}

export interface ConnectedRepo {
  id: string;
  owner: string;
  name: string;
  url?: string;
  description?: string;
  language?: string;
  stars: number;
  defaultBranch: string;
  isPrivate: boolean;
  lastSyncedAt?: number;
}

export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
}

export type FileLanguage =
  | 'typescript'
  | 'javascript'
  | 'json'
  | 'css'
  | 'html'
  | 'markdown'
  | 'python'
  | 'rust'
  | 'go'
  | 'shell'
  | 'plaintext';

export function getLanguageFromPath(path: string): FileLanguage {
  const ext = path.split('.').pop()?.toLowerCase();
  const map: Record<string, FileLanguage> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    json: 'json',
    css: 'css',
    scss: 'css',
    html: 'html',
    htm: 'html',
    md: 'markdown',
    mdx: 'markdown',
    py: 'python',
    rs: 'rust',
    go: 'go',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
  };
  return map[ext ?? ''] ?? 'plaintext';
}

export function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: '📘',
    tsx: '⚛️',
    js: '📙',
    jsx: '⚛️',
    json: '📋',
    css: '🎨',
    scss: '🎨',
    html: '🌐',
    md: '📄',
    sh: '💻',
    bash: '💻',
    rs: '🦀',
    go: '🐹',
    py: '🐍',
    gitignore: '🚫',
    env: '🔒',
  };
  return map[ext ?? ''] ?? '📄';
}
