// src/components/features/RepoPickerModal.tsx
// Phase 1: Modal for picking and cloning a GitHub repo into the WebContainer.
// Opens when the user has a GitHub App installation and clicks the GitHub icon in Sidebar.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X, Search, Github, Lock, Star, GitBranch, Download, RefreshCw } from 'lucide-react';
import { supabase, isSupabaseReady } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { cloneRepoIntoWebContainer } from '@/lib/github';
import { getWebContainer } from '@/core/webcontainer/webcontainer';
import { buildFileTree } from '@/core/webcontainer/fs';

interface GitHubRepo {
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

interface RepoPickerModalProps {
  open: boolean;
  onClose: () => void;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Ruby: '#CC342D',
  Java: '#b07219',
  'C++': '#f34b7d',
  CSS: '#563d7c',
  HTML: '#e34c26',
};

export function RepoPickerModal({ open, onClose }: RepoPickerModalProps) {
  const { setFileTree, addNotification } = useAppStore();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [filtered, setFiltered] = useState<GitHubRepo[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [cloning, setCloning] = useState<number | null>(null); // repo.id being cloned
  const [cloneProgress, setCloneProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (open && !fetchedRef.current) {
      fetchedRef.current = true;
      void fetchRepos();
    }
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    const q = query.toLowerCase();
    setFiltered(
      q
        ? repos.filter(
            (r) =>
              r.name.toLowerCase().includes(q) ||
              (r.description ?? '').toLowerCase().includes(q) ||
              r.full_name.toLowerCase().includes(q),
          )
        : repos,
    );
  }, [query, repos]);

  async function fetchRepos() {
    setLoading(true);
    setError(null);
    try {
      if (!isSupabaseReady || !supabase) throw new Error('Supabase not configured');

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const res = await fetch(`${supabaseUrl}/functions/v1/github-repos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await res.json() as { repos?: GitHubRepo[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `Error ${res.status}`);

      const sortedRepos = (data.repos ?? []).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      setRepos(sortedRepos);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error('Failed to load repos', { description: msg.slice(0, 150) });
    } finally {
      setLoading(false);
    }
  }

  const handleClone = useCallback(
    async (repo: GitHubRepo) => {
      setCloning(repo.id);
      setCloneProgress('Starting clone…');
      try {
        if (!isSupabaseReady || !supabase) throw new Error('Supabase not configured');

        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) throw new Error('Not authenticated');

        // Get stored GitHub token from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('github_access_token')
          .single();

        if (!profile?.github_access_token) {
          throw new Error('GitHub token not found. Please reconnect GitHub.');
        }

        const container = await getWebContainer();
        const targetDir = `/workspace/${repo.name}`;

        await cloneRepoIntoWebContainer(
          container,
          repo.html_url,
          profile.github_access_token,
          targetDir,
          (progress) => {
            setCloneProgress(
              `${progress.phase ?? ''}${progress.loaded ? ` (${progress.loaded}/${progress.total ?? '?'})` : ''}`,
            );
          },
        );

        // Refresh file tree
        const tree = await buildFileTree('/');
        setFileTree(tree);

        addNotification({
          type: 'success',
          title: 'Repo cloned',
          message: `${repo.full_name} → ${targetDir}`,
        });

        toast.success(`Cloned ${repo.name}`, {
          description: `Files available at ${targetDir}`,
        });

        onClose();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error('Clone failed', { description: msg.slice(0, 200) });
      } finally {
        setCloning(null);
        setCloneProgress('');
      }
    },
    [setFileTree, addNotification, onClose],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Clone a GitHub repository"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col rounded-2xl w-full max-w-lg mx-4"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          maxHeight: '80vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2.5">
            <Github size={18} style={{ color: 'var(--accent-400)' }} />
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '0.02em' }}
            >
              Clone Repository
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              onClick={() => { fetchedRef.current = false; void fetchRepos(); }}
              aria-label="Refresh repositories"
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              onClick={onClose}
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div
          className="px-4 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search repositories…"
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition-all"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
              }}
            />
          </div>
        </div>

        {/* Repo list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--accent-400)' }}
              />
              <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                Loading repositories…
              </p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
              <p className="text-sm" style={{ color: 'var(--danger)', fontFamily: 'var(--font-body)' }}>
                {error}
              </p>
              <button
                className="px-4 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                style={{
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--border-accent)',
                  color: 'var(--accent-400)',
                  fontFamily: 'var(--font-body)',
                }}
                onClick={() => { fetchedRef.current = false; void fetchRepos(); }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16">
              <Github size={28} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                {query ? 'No repositories match your search' : 'No repositories found'}
              </p>
            </div>
          )}

          {!loading && !error && filtered.map((repo) => {
            const isCloning = cloning === repo.id;
            const langColor = repo.language ? (LANGUAGE_COLORS[repo.language] ?? 'var(--text-muted)') : null;

            return (
              <div
                key={repo.id}
                className="flex items-start gap-3 px-4 py-3.5 border-b transition-all"
                style={{
                  borderColor: 'var(--border-subtle)',
                  background: isCloning ? 'rgba(0,245,160,0.04)' : 'transparent',
                }}
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--accent-400)', fontFamily: 'var(--font-body)' }}
                    >
                      {repo.name}
                    </span>
                    {repo.private && (
                      <span
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs"
                        style={{
                          background: 'rgba(255,200,0,0.08)',
                          border: '1px solid rgba(255,200,0,0.2)',
                          color: 'var(--warning)',
                          fontFamily: 'var(--font-body)',
                        }}
                      >
                        <Lock size={9} /> Private
                      </span>
                    )}
                  </div>

                  {repo.description && (
                    <p
                      className="text-xs truncate mb-2"
                      style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
                    >
                      {repo.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3">
                    {langColor && repo.language && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: langColor }}
                        />
                        {repo.language}
                      </span>
                    )}
                    {repo.stargazers_count > 0 && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                        <Star size={9} />
                        {repo.stargazers_count}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                      <GitBranch size={9} />
                      {repo.default_branch}
                    </span>
                  </div>

                  {/* Clone progress */}
                  {isCloning && cloneProgress && (
                    <div className="mt-2">
                      <div
                        className="h-1 rounded-full overflow-hidden"
                        style={{ background: 'var(--bg-surface)' }}
                      >
                        <div
                          className="h-full rounded-full animate-pulse"
                          style={{
                            width: '60%',
                            background: 'linear-gradient(90deg, var(--accent-400), var(--violet-400))',
                          }}
                        />
                      </div>
                      <p
                        className="text-xs mt-1"
                        style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
                      >
                        {cloneProgress}
                      </p>
                    </div>
                  )}
                </div>

                {/* Clone button */}
                <button
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px]"
                  style={{
                    background: isCloning ? 'rgba(0,245,160,0.08)' : 'var(--accent-glow)',
                    border: '1px solid var(--border-accent)',
                    color: 'var(--accent-400)',
                    fontFamily: 'var(--font-body)',
                  }}
                  onClick={() => handleClone(repo)}
                  disabled={cloning !== null}
                  aria-label={`Clone ${repo.name}`}
                >
                  {isCloning ? (
                    <>
                      <div
                        className="w-3 h-3 rounded-full border border-t-transparent animate-spin"
                        style={{ borderColor: 'var(--accent-400)' }}
                      />
                      Cloning
                    </>
                  ) : (
                    <>
                      <Download size={11} />
                      Clone
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 border-t flex-shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
            {repos.length > 0
              ? `${repos.length} repositories accessible · Clones into /workspace/<repo-name>`
              : 'Install the yfitops-ai GitHub App to see your repositories'}
          </p>
        </div>
      </div>
    </div>
  );
}
