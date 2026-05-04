// src/lib/github.ts
// GitHub REST API integration via raw fetch (no Octokit dep needed)
// Uses the user's github_access_token stored in the profiles table.
// Phase 1: added cloneRepoIntoWebContainer via isomorphic-git + WebContainer FS adapter.

import { supabase } from '@/lib/supabase';
import type { WebContainer } from '@webcontainer/api';

const GITHUB_API = 'https://api.github.com';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  default_branch: string;
  private: boolean;
  updated_at: string;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  public_repos: number;
}

export interface GitHubPR {
  html_url: string;
  number: number;
  title: string;
}

// ── Token management ──────────────────────────────────────────────────────────

/** Fetch the user's stored GitHub access token from Supabase profiles table */
export async function getGitHubToken(): Promise<string> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .select('github_access_token')
    .eq('id', user.id)
    .single();

  if (error) throw new Error(`Failed to load profile: ${error.message}`);
  if (!data?.github_access_token) {
    throw new Error('GitHub not connected. Please add your GitHub Personal Access Token in Settings.');
  }

  return data.github_access_token;
}

/** Save a GitHub token to the user's profile */
export async function saveGitHubToken(token: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Quick validation — try to get the GitHub user
  const ghUser = await getAuthenticatedGitHubUser(token);

  const { error } = await supabase
    .from('profiles')
    .update({
      github_access_token: token,
      github_username: ghUser.login,
    })
    .eq('id', user.id);

  if (error) throw new Error(`Failed to save token: ${error.message}`);
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function githubFetch<T>(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${GITHUB_API}${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`GitHub API ${res.status}: ${body.message ?? res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ── Public API functions ──────────────────────────────────────────────────────

/** Validate token and return authenticated GitHub user */
export async function getAuthenticatedGitHubUser(token: string): Promise<GitHubUser> {
  return githubFetch<GitHubUser>('/user', token);
}

/** List all repos for the authenticated user (up to 100) */
export async function listUserRepos(token?: string): Promise<GitHubRepo[]> {
  const t = token ?? (await getGitHubToken());
  return githubFetch<GitHubRepo[]>(
    '/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator',
    t
  );
}

/** Save selected repos to the connected_repos table */
export async function connectReposToSupabase(repos: GitHubRepo[]): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const rows = repos.map((r) => ({
    user_id: user.id,
    repo_owner: r.owner.login,
    repo_name: r.name,
    repo_url: r.html_url,
    description: r.description ?? '',
    language: r.language ?? '',
    stars: r.stargazers_count,
    default_branch: r.default_branch,
    is_private: r.private,
    github_repo_id: r.id,
    last_synced_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('connected_repos')
    .upsert(rows, { onConflict: 'user_id,repo_owner,repo_name', ignoreDuplicates: false });

  if (error) throw new Error(`Failed to connect repos: ${error.message}`);
}

// ── WebContainer FS Adapter for isomorphic-git ─────────────────────────────
// Maps isomorphic-git's fs interface to the WebContainer FileSystem API.
// isomorphic-git calls these via the `fs` option in git.clone().

function makeWcFsAdapter(container: WebContainer) {
  const fs = container.fs as unknown as {
    readFile(path: string, opts?: { encoding?: string }): Promise<string | Uint8Array>;
    writeFile(path: string, data: string | Uint8Array, opts?: unknown): Promise<void>;
    rm(path: string, opts?: { recursive?: boolean }): Promise<void>;
    readdir(path: string, opts?: { withFileTypes?: boolean }): Promise<string[]>;
    mkdir(path: string, opts?: { recursive?: boolean }): Promise<void>;
    stat(path: string): Promise<{ type: string; size: number; mtimeMs: number }>;
  };

  return {
    promises: {
      readFile: (p: string, opts?: { encoding?: BufferEncoding }) =>
        opts?.encoding
          ? fs.readFile(p, { encoding: opts.encoding }) as Promise<string>
          : fs.readFile(p) as Promise<Uint8Array>,
      writeFile: (p: string, d: string | Uint8Array, _opts?: unknown) => fs.writeFile(p, d),
      unlink: (p: string) => fs.rm(p),
      readdir: (p: string, _opts?: unknown) => fs.readdir(p),
      mkdir: (p: string, _opts?: unknown) => fs.mkdir(p, { recursive: true }),
      rmdir: (p: string) => fs.rm(p, { recursive: true }),
      stat: async (p: string) => {
        const s = await fs.stat(p);
        const isDir = s.type === 'directory';
        return {
          isFile: () => !isDir,
          isDirectory: () => isDir,
          isSymbolicLink: () => false,
          size: s.size,
          mtimeMs: s.mtimeMs,
          mode: isDir ? 0o40755 : 0o100644,
          uid: 1000,
          gid: 1000,
        };
      },
      lstat: async (p: string) => {
        const s = await fs.stat(p);
        const isDir = s.type === 'directory';
        return {
          isFile: () => !isDir,
          isDirectory: () => isDir,
          isSymbolicLink: () => false,
          size: s.size,
          mtimeMs: s.mtimeMs,
          mode: isDir ? 0o40755 : 0o100644,
          uid: 1000,
          gid: 1000,
        };
      },
      symlink: async () => {},
      readlink: async (p: string) => p,
      chmod: async () => {},
    },
  };
}

export interface CloneProgress {
  phase?: string;
  loaded?: number;
  total?: number;
  lengthComputable?: boolean;
}

/**
 * Phase 1: Clone a GitHub repo into the WebContainer filesystem using isomorphic-git.
 * Uses a depth-1 shallow clone with a single branch for speed.
 * @param container - Booted WebContainer instance
 * @param repoUrl   - HTTPS URL of the repo (e.g. https://github.com/owner/repo)
 * @param token     - GitHub user access token (for private repos)
 * @param targetDir - Destination directory inside WebContainer (e.g. /workspace/my-repo)
 * @param onProgress - Optional callback for progress updates
 */
export async function cloneRepoIntoWebContainer(
  container: WebContainer,
  repoUrl: string,
  token: string,
  targetDir = '/workspace',
  onProgress?: (progress: CloneProgress) => void,
): Promise<void> {
  // Dynamically import isomorphic-git to avoid bundling it unless needed.
  // The package auto-installs via depcheck if not present.
  const git = await import('isomorphic-git');
  const http = await import('isomorphic-git/http/web');

  const wcFs = makeWcFsAdapter(container);

  // Ensure the target directory exists
  try {
    await container.fs.mkdir(targetDir, { recursive: true } as Parameters<typeof container.fs.mkdir>[1]);
  } catch {
    // Directory may already exist
  }

  console.log(`[git clone] Cloning ${repoUrl} → ${targetDir}`);

  await git.clone({
    fs: wcFs,
    http: http.default ?? http,
    dir: targetDir,
    url: repoUrl,
    onAuth: () => ({ username: token, password: '' }),
    depth: 1,
    singleBranch: true,
    onProgress: (event: CloneProgress) => {
      console.log('[git clone]', event.phase, event.loaded, '/', event.total);
      onProgress?.(event);
    },
    onMessage: (msg: string) => console.log('[git clone msg]', msg),
  });

  console.log(`[git clone] Done → ${targetDir}`);
}

/** Create a pull request */
export async function createPullRequest(
  owner: string,
  repo: string,
  title: string,
  head: string,
  base: string,
  body?: string
): Promise<GitHubPR> {
  const token = await getGitHubToken();
  return githubFetch<GitHubPR>(
    `/repos/${owner}/${repo}/pulls`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({ title, head, base, body: body ?? '', draft: false }),
    }
  );
}
