// src/pages/Analytics.tsx
import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const commitData = Array.from({ length: 24 }, (_, i) => ({
  week: `W${i + 1}`, added: Math.floor(Math.random() * 3000) + 500, deleted: Math.floor(Math.random() * 1000) + 100,
}));

const buildData = Array.from({ length: 12 }, (_, i) => ({
  month: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],
  rate: Math.floor(Math.random() * 20) + 75,
  avg: (Math.random() * 5 + 3).toFixed(1),
}));

const aiData = Array.from({ length: 30 }, (_, i) => ({
  day: `${i + 1}`, requests: Math.floor(Math.random() * 150) + 20,
}));

const categoryData = [
  { name: 'Code Gen', value: 45, color: '#00F5A0' },
  { name: 'Bug Fix', value: 30, color: '#9B6EF5' },
  { name: 'Refactor', value: 15, color: '#38BDF8' },
  { name: 'Deploy', value: 10, color: '#FBBF24' },
];

const sessionData = Array.from({ length: 14 }, (_, i) => ({
  day: `${i + 1}`, sessions: Math.floor(Math.random() * 40) + 5,
}));

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-5">
      <h2 className="font-display text-sm font-semibold mb-5" style={{ color: 'var(--text-primary)', fontSize: 13, letterSpacing: '0.02em' }}>{title}</h2>
      {children}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: 'var(--bg-overlay)', border: '1px solid var(--border-default)', borderRadius: 8, fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--text-primary)' },
  itemStyle: { color: 'var(--text-secondary)' },
  cursor: { fill: 'rgba(0,245,160,0.05)' },
};

export default function Analytics() {
  return (
    <AppShell>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
          <div className="animate-fade-up">
            <h1 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Engineering Analytics</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Live metrics across code, builds, AI usage, and terminal activity</p>
          </div>

          {/* Code Activity */}
          <SectionCard title="Code Activity — Lines Added vs Deleted (Weekly)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={commitData.slice(-16)} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="week" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="added" name="Lines Added" fill="#00F5A0" radius={[2,2,0,0]} opacity={0.8} />
                <Bar dataKey="deleted" name="Lines Deleted" fill="#FF4D6D" radius={[2,2,0,0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Build stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="Build Success Rate (%)">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={buildData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <defs>
                    <linearGradient id="buildGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00F5A0" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00F5A0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[60, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, 'Success Rate']} />
                  <Area type="monotone" dataKey="rate" stroke="#00F5A0" strokeWidth={2} fill="url(#buildGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </SectionCard>

            <SectionCard title="AI Task Category Breakdown">
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={3} dataKey="value">
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, 'Share']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {categoryData.map((c) => (
                    <div key={c.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} aria-hidden="true" />
                      <span className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{c.name}</span>
                      <span className="ml-auto text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{c.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          </div>

          {/* AI Usage */}
          <SectionCard title="AI Requests — Last 30 Days">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={aiData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="aiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9B6EF5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#9B6EF5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [v, 'AI Requests']} />
                <Area type="monotone" dataKey="requests" stroke="#9B6EF5" strokeWidth={2} fill="url(#aiGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </SectionCard>

          {/* Terminal usage */}
          <SectionCard title="Terminal Sessions — Last 14 Days">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={sessionData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [v, 'Sessions']} />
                <Bar dataKey="sessions" fill="#38BDF8" radius={[2,2,0,0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
