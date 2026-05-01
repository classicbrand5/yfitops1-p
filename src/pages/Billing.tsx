// src/pages/Billing.tsx
import React from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAppStore } from '@/store/useAppStore';
import { ExternalLink, Download } from 'lucide-react';

const INVOICES = [
  { date: 'Jun 1, 2025', amount: '$79.00', status: 'Paid' },
  { date: 'May 1, 2025', amount: '$79.00', status: 'Paid' },
  { date: 'Apr 1, 2025', amount: '$79.00', status: 'Paid' },
  { date: 'Mar 1, 2025', amount: '$79.00', status: 'Paid' },
];

interface UsageBarProps {
  label: string;
  used: number;
  total: number | string;
  color?: string;
}

function UsageBar({ label, used, total, color = '#00F5A0' }: UsageBarProps) {
  const isUnlimited = total === 'Unlimited';
  const pct = isUnlimited ? 0 : (used / (total as number)) * 100;
  const isHigh = pct > 85;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{label}</span>
        <span className="text-xs font-mono" style={{ color: isHigh ? 'var(--warning)' : 'var(--text-muted)' }}>
          {used} / {isUnlimited ? '∞' : total}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-overlay)' }} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${label}: ${pct.toFixed(0)}% used`}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: isHigh ? 'var(--warning)' : color }}
          />
        </div>
      )}
    </div>
  );
}

export default function Billing() {
  const { user } = useAppStore();

  return (
    <AppShell>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <div className="animate-fade-up">
            <h1 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Billing</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Manage your subscription and payment history</p>
          </div>

          {/* Current plan card */}
          <div className="panel p-6 animate-fade-up delay-100">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '0.06em' }}>
                    {(user?.plan ?? 'starter').toUpperCase()} PLAN
                  </span>
                  <span className="badge-accent">Active</span>
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                  $79/month · Renews July 1, 2025
                </p>
              </div>
              <button
                className="btn-ghost text-sm py-2 px-4 flex items-center gap-1.5"
                style={{ minHeight: 36 }}
                aria-label="Manage subscription in Stripe portal"
              >
                <ExternalLink size={12} aria-hidden="true" />
                Manage
              </button>
            </div>

            <div className="space-y-4">
              <UsageBar label="AI Requests" used={800} total={1000} />
              <UsageBar label="Connected Repos" used={12} total="Unlimited" />
              <UsageBar label="Terminal Sessions" used={23} total="Unlimited" />
            </div>
          </div>

          {/* Invoice history */}
          <div className="panel p-5 animate-fade-up delay-200">
            <h2 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)', fontSize: 13 }}>Invoice History</h2>
            <table className="w-full" role="table" aria-label="Invoice history">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Date', 'Amount', 'Status', ''].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-label-sm" style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {INVOICES.map((inv, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }} role="row">
                    <td className="px-3 py-3 text-sm" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{inv.date}</td>
                    <td className="px-3 py-3 text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{inv.amount}</td>
                    <td className="px-3 py-3"><span className="badge-accent">✓ {inv.status}</span></td>
                    <td className="px-3 py-3">
                      <button className="flex items-center gap-1 text-xs min-h-[36px] px-2 transition-all hover:opacity-80" style={{ color: 'var(--accent-400)' }} aria-label={`Download invoice from ${inv.date}`}>
                        <Download size={11} aria-hidden="true" /> PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Upgrade CTA */}
          <div className="glass-accent rounded-xl p-6 animate-fade-up delay-300">
            <h3 className="font-display text-sm font-semibold mb-2" style={{ color: 'var(--accent-400)' }}>Upgrade to Team</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
              Get unlimited seats, a dedicated Slack channel, and priority support for $199/month.
            </p>
            <button className="btn-accent" style={{ fontSize: 13 }} aria-label="Upgrade to Team plan">
              Upgrade to Team →
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
