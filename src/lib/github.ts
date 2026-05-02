// src/lib/github.ts
// GitHub REST API integration via raw fetch (no Octokit dep needed)
// Uses the user's github_access_token stored in the profiles table.

import { supabase } from '@/lib/supabase';

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
