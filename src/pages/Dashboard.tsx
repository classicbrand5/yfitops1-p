// src/pages/Dashboard.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { useAppStore } from '@/store/useAppStore';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import { Zap, GitBranch, Bot, TerminalSquare, BarChart3, FolderOpen, FileEdit, GitPullRequest, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCard {
  label: string;
  value: string;
  trend: string;
  positive: boolean;
  icon: React.ElementType;
  sparkData: number[];
  color: string;
}

const STAT_CARDS: StatCard[] = [
  { label: 'Connected Repos', value: '47', trend: '↑ 12% vs last month', positive: true, icon: GitBranch, sparkData: [20,28,25,35,30,40,42,47], color: 'var(--accent-400)' },
  { label: 'AI Tasks Today', value: '184', trend: '↑ 38% vs yesterday', positive: true, icon: Bot, sparkData: [90,110,95,130,115,150,168,184], color: 'var(--violet-400)' },
  { label: 'Builds This Month', value: '342', trend: '↓ 5% vs last month', positive: false, icon: Zap, sparkData: [360,348,355,340,352,338,345,342], color: 'var(--warning)' },
  { label: 'Terminal Sessions', value: '1,240', trend: '↑ 22% vs last week', positive: true, icon: TerminalSquare, sparkData: [800,900,950,1000,1050,1100,1180,1240], color: 'var(--info)' },
];

interface QuickAction {
  icon: React.ElementType;
  label: string;
  desc: string;
  prompt?: string;
  href: string;
  color: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { icon: Zap, label: 'Generate Code', desc: 'Write new components', href: '/workspace', color: 'var(--accent-400)', prompt: 'Generate a new React component' },
  { icon: FolderOpen, label: 'Analyse Repo', desc: 'Deep-dive any repo', href: '/workspace', color: 'var(--violet-400)', prompt: 'Analyse the current repository structure' },
  { icon: FileEdit, label: 'Write Docs', desc: 'Auto-generate docs', href: '/workspace', color: 'var(--info)', prompt: 'Write documentation for this codebase' },
  { icon: GitPullRequest, label: 'Open PR', desc: 'Create a pull request', href: '/workspace', color: 'var(--warning)', prompt: 'Create a pull request for the current branch' },
  { icon: BarChart3, label: 'View Insights', desc: 'Engineering analytics', href: '/analytics', color: '#E879F9' },
  { icon: Bot, label: 'Open Chat', desc: 'Talk to the AI agent', href: '/workspace', color: 'var(--accent-400)' },
];

interface ActivityItem {
  icon: string;
  text: string;
  sub: string;
  time: string;
  color: string;
}

const ACTIVITY: ActivityItem[] = [
  { icon: '✓', text: 'Build #342 passed', sub: 'feature/login', time: '2m ago', color: 'var(--success)' },
  { icon: '✗', text: 'Build #341 failed', sub: 'main', time: '8m ago', color: 'var(--danger)' },
  { icon: '🤖', text: 'AI generated auth.ts', sub: 'workspace', time: '15m ago', color: 'var(--accent-400)' },
  { icon: '💻', text: 'Terminal: npm install', sub: 'workspace', time: '22m ago', color: 'var(--info)' },
  { icon: '⬆', text: 'PR #89 opened', sub: 'feature/login', time: '1h ago', color: 'var(--violet-400)' },
  { icon: '✓', text: 'Build #340 passed', sub: 'develop', time: '2h ago', color: 'var(--success)' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, addNotification } = useAppStore();
  const [visibleStats, setVisibleStats] = useState(false);

  useEffect(() => {
    setTimeout(() => setVisibleStats(true), 100);
  }, []);

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="mb-8 animate-fade-up">
            <h1 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
              {getGreeting()}, {user?.fullName?.split(' ')[0] ?? 'Engineer'} 👋
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
              Here's what's happening across your engineering stack
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {STAT_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="panel p-4 animate-fade-up"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{card.label}</span>
                    <Icon size={14} style={{ color: card.color }} aria-hidden="true" />
                  </div>
                  <div className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                    {visibleStats ? card.value : '—'}
                  </div>
                  <div className="flex items-center gap-1 mb-3">
                    {card.positive ? <TrendingUp size={11} style={{ color: 'var(--success)' }} aria-hidden="true" /> : <TrendingDown size={11} style={{ color: 'var(--danger)' }} aria-hidden="true" />}
                    <span className="text-xs" style={{ color: card.positive ? 'var(--success)' : 'var(--danger)', fontFamily: 'var(--font-body)' }}>{card.trend}</span>
                  </div>
                  <ResponsiveContainer width="100%" height={36}>
                    <AreaChart data={card.sparkData.map((v, j) => ({ v, j }))} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
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
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{action.label}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{action.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Activity feed */}
            <div className="panel p-5 animate-fade-up delay-300">
              <h2 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)', fontSize: 13 }}>Activity</h2>
              <div className="space-y-3" role="feed" aria-label="Recent activity">
                {ACTIVITY.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 animate-fade-up" style={{ animationDelay: `${i * 60}ms` }} role="article">
                    <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs mt-0.5" style={{ background: `${item.color}15`, color: item.color }} aria-hidden="true">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{item.text}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.sub} · {item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
