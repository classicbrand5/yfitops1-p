// src/pages/BuildMonitor.tsx
// Real-time build monitor powered by Supabase Realtime.

import React, { useState, useRef, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useRealtimeBuilds, type RealtimeBuild } from '@/hooks/useRealtimeBuilds';
import { Loader2, Check, X, Clock, ChevronRight, RefreshCw, AlertCircle, Zap, ExternalLink, RotateCcw } from 'lucide-react';
// Lightweight helpers without date-fns
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatBuildDuration(seconds: number | null): string {
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// ── Status Badge ───────────────────────────────────────────
type BuildStatus = RealtimeBuild['status'];

function BuildStatusBadge({ status }: { status: BuildStatus }) {
  switch (status) {
    case 'running':
      return (
        <div className="flex items-center gap-1.5 badge-accent animate-pulse-glow" aria-label="Running">
          <Loader2 size={10} className="animate-spin" aria-hidden="true" />
          Running
        </div>
      );
    case 'success':
      return (
        <div
          className="flex items-center gap-1.5 badge-accent"
          style={{ color: 'var(--success)', background: 'rgba(0,245,160,0.08)', border: '1px solid rgba(0,245,160,0.2)' }}
          aria-label="Passed"
        >
          <Check size={10} aria-hidden="true" />
          Passed
        </div>
      );
    case 'failed':
      return (
        <div className="flex items-center gap-1.5 badge-danger" aria-label="Failed">
          <X size={10} aria-hidden="true" />
          Failed
        </div>
      );
    case 'queued':
      return (
        <div className="flex items-center gap-1.5 badge-muted" aria-label="Queued">
          <Clock size={10} aria-hidden="true" />
          Queued
        </div>
      );
    case 'cancelled':
      return (
        <div className="flex items-center gap-1.5 badge-muted" aria-label="Cancelled">
          <RotateCcw size={10} aria-hidden="true" />
          Cancelled
        </div>
      );
    default:
      return (
        <div className="badge-muted" aria-label={status}>{status}</div>
      );
  }
}


// ── Log Drawer ─────────────────────────────────────────────
interface BuildLogDrawerProps {
  build: RealtimeBuild | null;
  onClose: () => void;
}

function BuildLogDrawer({ build, onClose }: BuildLogDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!build) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 animate-fade-in"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 'var(--z-drawer)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="fixed right-0 top-0 bottom-0 animate-slide-right flex flex-col"
        style={{
          width: 'min(600px, 90vw)',
          zIndex: 'calc(var(--z-drawer) + 1)',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-default)',
          boxShadow: 'var(--shadow-lg)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`Build logs for #${build.commit_sha?.slice(0, 7) ?? 'unknown'}`}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div>
            <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              Build Logs
            </h2>
            <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
              {build.repo_name ?? 'Unknown repo'} · {build.branch}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {build.log_url && (
              <a
                href={build.log_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs"
                style={{ color: 'var(--accent-400)' }}
                aria-label="Open logs externally"
              >
                <ExternalLink size={12} /> Open
              </a>
            )}
            <button
              className="w-7 h-7 flex items-center justify-center rounded transition-all"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}
              onClick={onClose}
              aria-label="Close log drawer"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Build meta */}
        <div
          className="px-5 py-3 border-b flex-shrink-0 grid grid-cols-3 gap-4"
          style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}
        >
          <div>
            <p className="text-label-sm mb-1" style={{ color: 'var(--text-muted)' }}>Status</p>
            <BuildStatusBadge status={build.status} />
          </div>
          <div>
            <p className="text-label-sm mb-1" style={{ color: 'var(--text-muted)' }}>Duration</p>
            <p className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>
              {formatBuildDuration(build.duration_seconds)}
            </p>
          </div>
          <div>
            <p className="text-label-sm mb-1" style={{ color: 'var(--text-muted)' }}>Triggered</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {build.triggered_by}
            </p>
          </div>
        </div>

        {/* Commit */}
        <div
          className="px-5 py-3 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p className="text-label-sm mb-1" style={{ color: 'var(--text-muted)' }}>Commit</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-mono" style={{ color: 'var(--accent-400)' }}>
              {build.commit_sha?.slice(0, 7) ?? '—'}
            </span>
            {build.commit_message && ` · ${build.commit_message}`}
          </p>
        </div>

        {/* Log content */}
        <div className="flex-1 overflow-y-auto">
          {build.log_url ? (
            <div
              className="code-block m-4 text-xs"
              style={{ minHeight: 200 }}
            >
              <p style={{ color: 'var(--text-muted)' }}>
                {'// Log streaming from external URL'}<br />
                {'// Open the external link above to view full logs.'}
              </p>
              <p className="mt-4" style={{ color: 'var(--accent-400)' }}>
                $ Fetching from: <a href={build.log_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline' }}>{build.log_url}</a>
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center px-5">
              <AlertCircle size={24} style={{ color: 'var(--text-muted)' }} className="mb-3" />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No log URL available</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Logs are stored externally. Connect your CI provider to stream logs here.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Row Skeleton ───────────────────────────────────────────
function BuildRowSkeleton() {
  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      {[160, 80, 80, 100, 60, 60, 70, 40].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="animate-shimmer rounded h-3"
            style={{ width: w, background: 'var(--bg-overlay)' }}
          />
        </td>
      ))}
    </tr>
  );
}

// ── Main page ──────────────────────────────────────────────
export default function BuildMonitor() {
  const [filter, setFilter] = useState<'all' | BuildStatus>('all');
  const [selectedBuild, setSelectedBuild] = useState<RealtimeBuild | null>(null);
  const { builds, isLoading, refetch } = useRealtimeBuilds();
  const [refreshing, setRefreshing] = useState(false);

  const filtered = filter === 'all' ? builds : builds.filter((b) => b.status === filter);

  async function handleRefresh() {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 600);
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8 animate-fade-up">
            <div>
              <h1 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                Build Monitor
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Real-time CI/CD pipeline visibility
                {builds.length > 0 && (
                  <span className="ml-2 font-mono" style={{ color: 'var(--accent-400)' }}>
                    {builds.length} build{builds.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Live indicator */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                style={{ background: 'rgba(0,245,160,0.06)', border: '1px solid rgba(0,245,160,0.18)', color: 'var(--success)' }}
                aria-live="polite"
              >
                <span className="status-dot-green animate-pulse-glow" style={{ width: 6, height: 6 }} aria-hidden="true" />
                Live
              </div>

              <button
                className="flex items-center gap-1.5 btn-ghost px-3 py-1.5 text-xs"
                style={{ minHeight: 36, fontSize: 12 }}
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="Refresh builds"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                Refresh
              </button>

              {/* Filter buttons */}
              <div className="flex items-center gap-1">
                {(['all', 'running', 'success', 'failed', 'queued'] as const).map((f) => (
                  <button
                    key={f}
                    className="px-3 py-1.5 rounded-lg text-xs capitalize transition-all"
                    style={{
                      background: filter === f ? 'var(--bg-overlay)' : 'transparent',
                      border: `1px solid ${filter === f ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                      color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                      minHeight: 32,
                    }}
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Build table */}
          <div className="panel overflow-hidden animate-fade-up delay-100">
            <div className="overflow-x-auto">
              <table className="w-full" role="table" aria-label="Build history">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    {['Build', 'Status', 'Repo', 'Branch', 'Duration', 'Trigger', 'Time', ''].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-label-sm"
                        style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? [0, 1, 2, 3, 4].map((i) => <BuildRowSkeleton key={i} />)
                    : filtered.map((build, i) => (
                        <tr
                          key={build.id}
                          className="transition-all animate-fade-up"
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            background: build._flash
                              ? 'rgba(0,245,160,0.04)'
                              : build.status === 'failed'
                              ? 'rgba(255,77,109,0.02)'
                              : 'transparent',
                            transition: 'background 0.4s ease',
                            animationDelay: `${Math.min(i, 10) * 50}ms`,
                          }}
                          role="row"
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                              #{build.commit_sha?.slice(0, 7) ?? '—'}
                            </span>
                            {build.commit_message && (
                              <p className="text-xs truncate max-w-[200px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {build.commit_message}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <BuildStatusBadge status={build.status} />
                          </td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
                            {build.repo_name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)', maxWidth: 120 }}>
                            <span className="block truncate">{build.branch}</span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                            {formatBuildDuration(build.duration_seconds)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="badge-muted">{build.triggered_by}</span>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                            {timeAgo(build.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              className="flex items-center gap-1 text-xs transition-all hover:opacity-80 min-h-[36px] px-2"
                              style={{ color: 'var(--accent-400)' }}
                              onClick={() => setSelectedBuild(build)}
                              aria-label={`View logs for build ${build.commit_sha?.slice(0, 7) ?? ''}`}
                            >
                              Logs <ChevronRight size={11} aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Empty state */}
            {!isLoading && filtered.length === 0 && (
              <div className="px-4 py-16 text-center">
                {filter !== 'all' ? (
                  <>
                    <Zap size={24} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-3" />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      No {filter} builds
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Try a different filter
                    </p>
                  </>
                ) : (
                  <>
                    <Zap size={24} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-3" />
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      No builds yet
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Push to a connected repository to trigger a build
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Build log drawer */}
      {selectedBuild && (
        <BuildLogDrawer build={selectedBuild} onClose={() => setSelectedBuild(null)} />
      )}
    </AppShell>
  );
}
