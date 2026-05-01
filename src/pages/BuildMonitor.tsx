// src/pages/BuildMonitor.tsx
import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Loader2, Check, X, Clock, ChevronRight } from 'lucide-react';

interface Build {
  id: string;
  number: number;
  branch: string;
  commit: string;
  status: 'running' | 'success' | 'failed' | 'queued';
  duration: string;
  repo: string;
  trigger: string;
  time: string;
}

const MOCK_BUILDS: Build[] = [
  { id: '1', number: 343, branch: 'feature/auth-v2', commit: 'feat: add JWT refresh tokens', status: 'running', duration: '3m 12s', repo: 'yfitops-api', trigger: 'push', time: '2m ago' },
  { id: '2', number: 342, branch: 'feature/login', commit: 'fix: handle OAuth callback errors', status: 'success', duration: '12m 04s', repo: 'yfitops-web', trigger: 'push', time: '15m ago' },
  { id: '3', number: 341, branch: 'hotfix/payments', commit: 'fix: stripe webhook signature', status: 'failed', duration: '2m 18s', repo: 'yfitops-api', trigger: 'push', time: '32m ago' },
  { id: '4', number: 340, branch: 'main', commit: 'chore: update dependencies', status: 'success', duration: '8m 55s', repo: 'yfitops-web', trigger: 'schedule', time: '1h ago' },
  { id: '5', number: 339, branch: 'feature/analytics', commit: 'feat: add session tracking', status: 'success', duration: '6m 22s', repo: 'yfitops-api', trigger: 'push', time: '2h ago' },
  { id: '6', number: 338, branch: 'develop', commit: 'refactor: extract auth middleware', status: 'success', duration: '9m 11s', repo: 'yfitops-web', trigger: 'PR', time: '3h ago' },
  { id: '7', number: 337, branch: 'feature/terminal', commit: 'feat: WebContainer integration', status: 'failed', duration: '1m 45s', repo: 'yfitops-web', trigger: 'push', time: '4h ago' },
];

function StatusBadge({ status }: { status: Build['status'] }) {
  switch (status) {
    case 'running':
      return (
        <div className="flex items-center gap-1.5 badge-accent" aria-label="Running">
          <Loader2 size={10} className="animate-spin" aria-hidden="true" />
          Running
        </div>
      );
    case 'success':
      return (
        <div className="flex items-center gap-1.5 badge-accent" style={{ color: 'var(--success)', background: 'rgba(0,245,160,0.1)', border: '1px solid rgba(0,245,160,0.2)' }} aria-label="Passed">
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
  }
}

export default function BuildMonitor() {
  const [filter, setFilter] = useState<'all' | Build['status']>('all');
  const filtered = filter === 'all' ? MOCK_BUILDS : MOCK_BUILDS.filter((b) => b.status === filter);

  return (
    <AppShell>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8 animate-fade-up">
            <div>
              <h1 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Build Monitor</h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Real-time CI/CD pipeline visibility</p>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              {(['all', 'running', 'success', 'failed'] as const).map((f) => (
                <button
                  key={f}
                  className="px-3 py-1.5 rounded-lg text-xs capitalize transition-all"
                  style={{
                    background: filter === f ? 'var(--bg-overlay)' : 'transparent',
                    border: `1px solid ${filter === f ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                    color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontFamily: 'var(--font-body)',
                  }}
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Build table */}
          <div className="panel overflow-hidden animate-fade-up delay-100">
            <table className="w-full" role="table" aria-label="Build history">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Build', 'Status', 'Repo', 'Branch', 'Duration', 'Trigger', 'Time', ''].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-label-sm" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((build, i) => (
                  <tr
                    key={build.id}
                    className="transition-all animate-fade-up"
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: build.status === 'failed' ? 'rgba(255,77,109,0.02)' : 'transparent',
                      animationDelay: `${i * 60}ms`,
                    }}
                    role="row"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs" style={{ color: 'var(--text-primary)' }}>#{build.number}</span>
                      <p className="text-xs truncate max-w-[180px]" style={{ color: 'var(--text-muted)', marginTop: 2 }}>{build.commit}</p>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={build.status} /></td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{build.repo}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{build.branch}</td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{build.duration}</td>
                    <td className="px-4 py-3"><span className="badge-muted">{build.trigger}</span></td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{build.time}</td>
                    <td className="px-4 py-3">
                      <button className="flex items-center gap-1 text-xs transition-all hover:opacity-80 min-h-[36px] px-2" style={{ color: 'var(--accent-400)' }} aria-label={`View logs for build #${build.number}`}>
                        Logs <ChevronRight size={11} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div className="px-4 py-12 text-center">
                <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>No builds match the selected filter</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
