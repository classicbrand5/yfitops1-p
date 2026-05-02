// src/pages/Analytics.tsx
// Engineering Analytics — real Supabase RPC data + graceful fallback

import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, Bot, GitBranch, BarChart3 } from 'lucide-react';

// ── Supabase RPC data hooks ───────────────────────────────────────────────────

interface BuildSuccessRow {
  week: string;
  success_rate: number;
  total: number;
}

interface AiUsageRow {
  day: string;
  request_count: number;
}

interface EventRow {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

function useBuildSuccessRate() {
  return useQuery({
    queryKey: ['build-success-rate'],
    queryFn: async (): Promise<BuildSuccessRow[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase.rpc('get_build_success_rate', { weeks: 12 });
      if (error) throw new Error(error.message);
      return (data as BuildSuccessRow[]) ?? [];
    },
    enabled: !!supabase,
    staleTime: 60_000,
    retry: 1,
  });
}

function useAiUsage() {
  return useQuery({
    queryKey: ['ai-usage'],
    queryFn: async (): Promise<AiUsageRow[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase.rpc('get_ai_usage', { days: 30 });
      if (error) throw new Error(error.message);
      return (data as AiUsageRow[]) ?? [];
    },
    enabled: !!supabase,
    staleTime: 60_000,
    retry: 1,
  });
}

function useRecentEvents() {
  const { user } = useAppStore();
  return useQuery({
    queryKey: ['analytics-events', user?.id],
    queryFn: async (): Promise<EventRow[]> => {
      if (!supabase || !user) return [];
      const { data, error } = await supabase
        .from('events')
        .select('event_type,payload,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return (data as EventRow[]) ?? [];
    },
    enabled: !!supabase && !!user,
    staleTime: 30_000,
  });
}

// ── Skeleton loaders ──────────────────────────────────────────────────────────
function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <div
      className="animate-shimmer rounded-lg"
      style={{ height, background: 'var(--bg-overlay)', width: '100%' }}
      aria-hidden="true"
    />
  );
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string | number; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="panel p-4 flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon size={18} style={{ color }} aria-hidden="true" />
      </div>
      <div>
        <p className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>{value}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{label}</p>
        {sub && <p className="text-xs" style={{ color }}>{sub}</p>}
      </div>
    </div>
  );
}

// ── Tooltip styles ────────────────────────────────────────────────────────────
const tooltipStyle = {
  contentStyle: {
    background: 'var(--bg-overlay)',
    border: '1px solid var(--border-default)',
    borderRadius: 8,
    fontFamily: 'var(--font-body)',
    fontSize: 12,
    color: 'var(--text-primary)',
  },
  itemStyle: { color: 'var(--text-secondary)' },
  cursor: { fill: 'rgba(0,245,160,0.05)' },
};

// ── Category breakdown from events ───────────────────────────────────────────
function getCategoryData(events: EventRow[]) {
  const counts: Record<string, number> = {};
  for (const e of events) {
    const type = e.event_type;
    counts[type] = (counts[type] ?? 0) + 1;
  }
  const colors: Record<string, string> = {
    ai_request: '#00F5A0',
    build_success: '#38BDF8',
    build_failed: '#FF4D6D',
    build_started: '#FBBF24',
    terminal_session: '#9B6EF5',
    repo_connected: '#E879F9',
  };
  const defaultColors = ['#00F5A0', '#9B6EF5', '#38BDF8', '#FBBF24', '#FF4D6D', '#E879F9'];
  let colorIdx = 0;
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)
    .map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value,
      color: colors[name] ?? defaultColors[colorIdx++ % defaultColors.length],
    }));
}

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <h2 className="font-display text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)', fontSize: 13, letterSpacing: '0.02em' }}>{title}</h2>
      {children}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-center">
      <BarChart3 size={24} style={{ color: 'var(--text-muted)' }} className="mb-2" />
      <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>{message}</p>
    </div>
  );
}

export default function Analytics() {
  const { data: buildData = [], isLoading: buildLoading } = useBuildSuccessRate();
  const { data: aiData = [], isLoading: aiLoading } = useAiUsage();
  const { data: events = [], isLoading: eventsLoading } = useRecentEvents();

  const categoryData = getCategoryData(events);

  const totalAiRequests = aiData.reduce((s, r) => s + (r.request_count ?? 0), 0);
  const avgBuildSuccess = buildData.length > 0
    ? Math.round(buildData.reduce((s, r) => s + (r.success_rate ?? 0), 0) / buildData.length)
    : null;

  return (
    <AppShell>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          {/* Header */}
          <div className="animate-fade-up">
            <h1 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Engineering Analytics</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Real metrics from your connected Supabase project</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up delay-100">
            <StatCard
              label="AI Requests (30d)"
              value={aiLoading ? '…' : totalAiRequests.toLocaleString()}
              icon={Bot}
              color="var(--violet-400)"
            />
            <StatCard
              label="Avg Build Success"
              value={buildLoading ? '…' : avgBuildSuccess !== null ? `${avgBuildSuccess}%` : 'N/A'}
              icon={TrendingUp}
              color="var(--accent-400)"
              sub={buildData.length > 0 ? `over ${buildData.length} weeks` : undefined}
            />
            <StatCard
              label="Event Categories"
              value={eventsLoading ? '…' : categoryData.length}
              icon={BarChart3}
              color="var(--info)"
            />
            <StatCard
              label="Total Events"
              value={eventsLoading ? '…' : events.length.toLocaleString()}
              icon={GitBranch}
              color="var(--warning)"
            />
          </div>

          {/* Build success rate */}
          <SectionCard title="Build Success Rate (Weekly %)">
            {buildLoading ? (
              <ChartSkeleton height={200} />
            ) : buildData.length === 0 ? (
              <EmptyChart message="No build data yet. Push to a connected repo to trigger builds." />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={buildData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="buildGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F5A0" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00F5A0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, 'Success Rate']} />
                  <Area type="monotone" dataKey="success_rate" name="Success Rate" stroke="#00F5A0" strokeWidth={2} fill="url(#buildGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </SectionCard>

          {/* AI usage + category breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="AI Requests — Last 30 Days">
              {aiLoading ? (
                <ChartSkeleton height={180} />
              ) : aiData.length === 0 ? (
                <EmptyChart message="No AI requests yet. Start a conversation in the workspace." />
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={aiData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [v, 'AI Requests']} />
                    <Bar dataKey="request_count" name="Requests" fill="#9B6EF5" radius={[2, 2, 0, 0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </SectionCard>

            <SectionCard title="Event Category Breakdown">
              {eventsLoading ? (
                <ChartSkeleton height={180} />
              ) : categoryData.length === 0 ? (
                <EmptyChart message="No events yet. Activity will appear after your first AI task." />
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {categoryData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        {...tooltipStyle}
                        formatter={(v: number, _name: string, props: { payload?: { name: string } }) => [v, props.payload?.name ?? '']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 flex-1">
                    {categoryData.map((c) => (
                      <div key={c.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} aria-hidden="true" />
                        <span className="text-xs truncate" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{c.name}</span>
                        <span className="ml-auto text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          {/* Top changed files placeholder */}
          <SectionCard title="Top Changed Files">
            <EmptyChart message="File change tracking will appear after agent activity. Requires the agent to write or edit files." />
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
