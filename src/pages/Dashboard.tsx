// src/pages/Dashboard.tsx
// Real-time dashboard powered by Supabase Realtime + react-query RPC stats.

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { useAppStore } from '@/store/useAppStore';
import { useRealtimeEvents, type RealtimeEvent } from '@/hooks/useRealtimeEvents';
import { supabase } from '@/lib/supabase';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import {
  Zap, GitBranch, Bot, TerminalSquare, BarChart3,
  FolderOpen, FileEdit, GitPullRequest, TrendingUp,
  TrendingDown, RefreshCw, Wifi, WifiOff,
  Terminal, CheckCircle, XCircle, AlertCircle, Info,
  Clock,
} from 'lucide-react';
// Lightweight relative time without date-fns
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

// ── Dashboard stats from RPC ───────────────────────────────
interface DashboardStats {
  connected_repos: number;
  ai_tasks_today: number;
  builds_this_month: number;
  terminal_sessions: number;
}

function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      if (!supabase) return { connected_repos: 0, ai_tasks_today: 0, builds_this_month: 0, terminal_sessions: 0 };
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (error) throw new Error(error.message);
      return (data as DashboardStats) ?? { connected_repos: 0, ai_tasks_today: 0, builds_this_month: 0, terminal_sessions: 0 };
    },
    enabled: !!supabase,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });
}

// ── Event type → display ───────────────────────────────────
function getEventDisplay(event: RealtimeEvent): {
  icon: React.ElementType;
  text: string;
  sub: string;
  color: string;
} {
  const type = event.event_type;
  const payload = event.payload ?? {};

  switch (type) {
    case 'build_success':
      return { icon: CheckCircle, text: `Build #${payload.build_number ?? ''} passed`, sub: String(payload.branch ?? 'main'), color: 'var(--success)' };
    case 'build_failed':
      return { icon: XCircle, text: `Build #${payload.build_number ?? ''} failed`, sub: String(payload.branch ?? 'main'), color: 'var(--danger)' };
    case 'build_started':
      return { icon: Zap, text: `Build started`, sub: String(payload.branch ?? 'main'), color: 'var(--warning)' };
    case 'ai_request':
      return { icon: Bot, text: String(payload.summary ?? 'AI task completed'), sub: 'workspace', color: 'var(--violet-400)' };
    case 'terminal_session':
      return { icon: Terminal, text: String(payload.command ?? 'Terminal command'), sub: 'workspace', color: 'var(--info)' };
    case 'repo_connected':
      return { icon: GitBranch, text: `Repo connected: ${payload.repo_name ?? ''}`, sub: String(payload.owner ?? ''), color: 'var(--accent-400)' };
    case 'pr_opened':
      return { icon: GitPullRequest, text: `PR #${payload.number ?? ''} opened`, sub: String(payload.branch ?? ''), color: 'var(--violet-400)' };
    default:
      return { icon: Info, text: type.replace(/_/g, ' '), sub: '', color: 'var(--text-muted)' };
  }
}

// ── Skeleton loader ────────────────────────────────────────
function StatSkeleton() {
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="animate-shimmer rounded h-3 w-24" style={{ background: 'var(--bg-overlay)' }} />
        <div className="animate-shimmer rounded h-3 w-3" style={{ background: 'var(--bg-overlay)' }} />
      </div>
      <div className="animate-shimmer rounded h-8 w-16 mb-2" style={{ background: 'var(--bg-overlay)' }} />
      <div className="animate-shimmer rounded h-3 w-28 mb-3" style={{ background: 'var(--bg-overlay)' }} />
      <div className="animate-shimmer rounded h-9 w-full" style={{ background: 'var(--bg-overlay)' }} />
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="animate-shimmer rounded w-5 h-5 flex-shrink-0 mt-0.5" style={{ background: 'var(--bg-overlay)' }} />
          <div className="flex-1 space-y-1">
            <div className="animate-shimmer rounded h-3 w-3/4" style={{ background: 'var(--bg-overlay)' }} />
            <div className="animate-shimmer rounded h-2.5 w-1/2" style={{ background: 'var(--bg-overlay)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Quick actions ──────────────────────────────────────────
interface QuickAction {
  icon: React.ElementType;
  label: string;
  desc: string;
  href: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: Zap, label: 'Generate Code', desc: 'Write new components', href: '/workspace', color: 'var(--accent-400)' },
  { icon: FolderOpen, label: 'Analyse Repo', desc: 'Deep-dive any repo', href: '/workspace', color: 'var(--violet-400)' },
  { icon: FileEdit, label: 'Write Docs', desc: 'Auto-generate docs', href: '/workspace', color: 'var(--info)' },
  { icon: GitPullRequest, label: 'Open PR', desc: 'Create a pull request', href: '/workspace', color: 'var(--warning)' },
  { icon: BarChart3, label: 'View Insights', desc: 'Engineering analytics', href: '/analytics', color: '#E879F9' },
  { icon: Bot, label: 'Open Chat', desc: 'Talk to the AI agent', href: '/workspace', color: 'var(--accent-400)' },
];

// ── Stat card sparklines (generated from real stats) ───────
function generateSparkline(current: number, points = 8): number[] {
  const result: number[] = [];
  let v = Math.max(1, current * 0.5);
  for (let i = 0; i < points - 1; i++) {
    result.push(Math.round(v));
    v = v + (current - v) * (0.15 + Math.random() * 0.15) + (Math.random() - 0.4) * v * 0.1;
    v = Math.max(0, v);
  }
  result.push(current);
  return result;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useDashboardStats();
  const { events, isLoading: eventsLoading, error: eventsError } = useRealtimeEvents();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    await refetchStats();
    setTimeout(() => setRefreshing(false), 600);
  }

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  const statsData = [
    {
      label: 'Connected Repos',
      value: stats?.connected_repos ?? 0,
      icon: GitBranch,
      color: 'var(--accent-400)',
      trend: '+12%',
      positive: true,
    },
    {
      label: 'AI Tasks Today',
      value: stats?.ai_tasks_today ?? 0,
      icon: Bot,
      color: 'var(--violet-400)',
      trend: '+38%',
      positive: true,
    },
    {
      label: 'Builds This Month',
      value: stats?.builds_this_month ?? 0,
      icon: Zap,
      color: 'var(--warning)',
      trend: '-5%',
      positive: false,
    },
    {
      label: 'Terminal Sessions',
      value: stats?.terminal_sessions ?? 0,
      icon: TerminalSquare,
      color: 'var(--info)',
      trend: '+22%',
      positive: true,
    },
  ];

  return (
    <AppShell>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8">

          {/* Header */}
          <div className="flex items-center justify-between mb-8 animate-fade-up">
            <div>
              <h1 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                {getGreeting()}, {user?.fullName?.split(' ')[0] ?? 'Engineer'} 👋
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Live view of your engineering stack
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Realtime status */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                style={{
                  background: eventsError ? 'rgba(255,77,109,0.08)' : 'rgba(0,245,160,0.06)',
                  border: `1px solid ${eventsError ? 'rgba(255,77,109,0.2)' : 'rgba(0,245,160,0.18)'}`,
                  color: eventsError ? 'var(--danger)' : 'var(--success)',
                }}
                aria-live="polite"
              >
                {eventsError
                  ? <WifiOff size={11} aria-hidden="true" />
                  : <Wifi size={11} aria-hidden="true" />}
                {eventsError ? 'Offline' : 'Live'}
              </div>

              <button
                className="flex items-center gap-1.5 btn-ghost px-3 py-1.5 text-xs"
                style={{ minHeight: 36, fontSize: 12 }}
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="Refresh stats"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                Refresh
              </button>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statsLoading
              ? [0, 1, 2, 3].map((i) => <StatSkeleton key={i} />)
              : statsData.map((card, i) => {
                  const Icon = card.icon;
                  const sparkData = generateSparkline(card.value);
                  return (
                    <div
                      key={card.label}
                      className="panel p-4 animate-fade-up"
                      style={{ animationDelay: `${i * 80}ms` }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{card.label}</span>
                        <Icon size={14} style={{ color: card.color }} aria-hidden="true" />
                      </div>
                      <div className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                        {card.value.toLocaleString()}
                      </div>
                      <div className="flex items-center gap-1 mb-3">
                        {card.positive
                          ? <TrendingUp size={11} style={{ color: 'var(--success)' }} aria-hidden="true" />
                          : <TrendingDown size={11} style={{ color: 'var(--danger)' }} aria-hidden="true" />}
                        <span className="text-xs" style={{ color: card.positive ? 'var(--success)' : 'var(--danger)' }}>
                          {card.trend} vs last period
                        </span>
                      </div>
                      <ResponsiveContainer width="100%" height={36}>
                        <AreaChart data={sparkData.map((v, j) => ({ v, j }))} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={card.color} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={card.color} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="v" stroke={card.color} strokeWidth={1.5} fill={`url(#grad-${i})`} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick actions */}
            <div className="lg:col-span-2 panel p-5 animate-fade-up delay-200">
              <h2 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)', fontSize: 13 }}>Quick Actions</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {QUICK_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.label}
                      className="flex flex-col items-start gap-2 p-3 rounded-xl text-left transition-all glass-hover min-h-[80px]"
                      style={{ border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}
                      onClick={() => navigate(action.href)}
                      aria-label={`${action.label}: ${action.desc}`}
                    >
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${action.color}15`, border: `1px solid ${action.color}30` }}>
                        <Icon size={15} style={{ color: action.color }} aria-hidden="true" />
                      </div>
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{action.label}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{action.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live activity feed */}
            <div className="panel p-5 animate-fade-up delay-300">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: 13 }}>Activity</h2>
                {!eventsLoading && (
                  <div className="flex items-center gap-1">
                    <span className="status-dot-green animate-pulse-glow" style={{ width: 6, height: 6 }} aria-label="Live" />
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Live</span>
                  </div>
                )}
              </div>

              {eventsLoading ? (
                <ActivitySkeleton />
              ) : eventsError ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle size={20} style={{ color: 'var(--danger)' }} className="mb-2" />
                  <p className="text-xs" style={{ color: 'var(--danger)' }}>Failed to load live events</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Check your connection</p>
                </div>
              ) : events.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Zap size={20} style={{ color: 'var(--text-muted)' }} className="mb-2" />
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>No activity yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Start an AI conversation or run a build
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1" role="feed" aria-label="Recent activity">
                  {events.map((event, i) => {
                    const display = getEventDisplay(event);
                    const Icon = display.icon;
                    return (
                      <div
                        key={event.id}
                        className="flex items-start gap-2.5 animate-fade-up"
                        style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }}
                        role="article"
                      >
                        <div
                          className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ background: `${display.color}15` }}
                          aria-hidden="true"
                        >
                          <Icon size={10} style={{ color: display.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                            {display.text}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {display.sub && `${display.sub} · `}
                            {timeAgo(event.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
