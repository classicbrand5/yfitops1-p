// src/pages/Billing.tsx
// Billing page — real plan/usage from profiles + Stripe upgrade flow

import React, { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ExternalLink, Zap, Loader2, Check, AlertCircle } from 'lucide-react';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ── Profile billing data ──────────────────────────────────────────────────────
interface BillingProfile {
  plan: string;
  plan_expires_at: string | null;
  ai_requests_used: number;
  ai_requests_limit: number;
  stripe_customer_id: string | null;
}

function useBillingProfile() {
  const { user } = useAppStore();
  return useQuery({
    queryKey: ['billing-profile', user?.id],
    queryFn: async (): Promise<BillingProfile | null> => {
      if (!supabase || !user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('plan,plan_expires_at,ai_requests_used,ai_requests_limit,stripe_customer_id')
        .eq('id', user.id)
        .single();
      if (error) throw new Error(error.message);
      return data as BillingProfile;
    },
    enabled: !!supabase && !!user,
    staleTime: 30_000,
  });
}

// ── Usage bar ─────────────────────────────────────────────────────────────────
interface UsageBarProps {
  label: string;
  used: number;
  total: number | string;
  color?: string;
}

function UsageBar({ label, used, total, color = '#00F5A0' }: UsageBarProps) {
  const isUnlimited = total === 'Unlimited' || total === 0;
  const pct = isUnlimited ? 0 : Math.min(100, (used / (total as number)) * 100);
  const isHigh = pct > 85;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{label}</span>
        <span className="text-xs font-mono" style={{ color: isHigh ? 'var(--warning)' : 'var(--text-muted)' }}>
          {used.toLocaleString()} / {isUnlimited ? '∞' : (total as number).toLocaleString()}
        </span>
      </div>
      {!isUnlimited && (
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'var(--bg-overlay)' }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${pct.toFixed(0)}% used`}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: isHigh ? 'var(--warning)' : color }}
          />
        </div>
      )}
    </div>
  );
}

// ── Plan definitions ──────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'Free',
    period: '',
    features: ['500 AI requests/month', '5 connected repos', 'Community support'],
    color: 'var(--text-muted)',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    period: '/month',
    features: ['5,000 AI requests/month', 'Unlimited repos', 'Priority support', 'Full-auto agent mode'],
    color: 'var(--accent-400)',
    recommended: true,
    priceId: 'price_pro_monthly', // Replace with your real Stripe price ID
  },
  {
    id: 'team',
    name: 'Team',
    price: '$199',
    period: '/month',
    features: ['Unlimited AI requests', 'Team management', 'Dedicated support', 'Custom integrations'],
    color: 'var(--violet-400)',
    priceId: 'price_team_monthly',
  },
];

export default function Billing() {
  const { user } = useAppStore();
  const { data: profile, isLoading } = useBillingProfile();
  const [upgrading, setUpgrading] = useState<string | null>(null);

  const currentPlan = profile?.plan ?? 'starter';

  async function handleUpgrade(priceId: string, planId: string) {
    if (!supabase) {
      toast.error('Supabase not configured');
      return;
    }

    setUpgrading(planId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await error.context?.text(); } catch { /* ignore */ }
        }
        // If edge function doesn't exist yet, show friendly error
        if (msg.includes('404') || msg.includes('not found') || msg.includes('Function not found')) {
          toast.error('Stripe not configured', {
            description: 'The create-checkout edge function is not deployed yet. Set STRIPE_SECRET_KEY and deploy the function.',
            duration: 8000,
          });
          return;
        }
        throw new Error(msg);
      }

      const { url } = data as { url: string };
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error('Upgrade failed', { description: msg });
    } finally {
      setUpgrading(null);
    }
  }

  return (
    <AppShell>
      <div className="h-full overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
          <div className="animate-fade-up">
            <h1 className="font-display text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Billing</h1>
            <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>Manage your subscription and usage</p>
          </div>

          {/* Current plan + usage */}
          <div className="panel p-6 animate-fade-up delay-100">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '0.06em' }}>
                    {currentPlan.toUpperCase()} PLAN
                  </span>
                  <span className="badge-accent">Active</span>
                </div>
                {profile?.plan_expires_at && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                    Renews {new Date(profile.plan_expires_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              {profile?.stripe_customer_id && (
                <button
                  className="btn-ghost text-sm py-2 px-4 flex items-center gap-1.5"
                  style={{ minHeight: 36 }}
                  aria-label="Manage subscription in Stripe portal"
                  onClick={() => toast.info('Open Stripe Customer Portal via your dashboard')}
                >
                  <ExternalLink size={12} aria-hidden="true" />
                  Manage
                </button>
              )}
            </div>

            <div className="space-y-4">
              {isLoading ? (
                <>
                  <div className="animate-shimmer rounded h-3 w-full" style={{ background: 'var(--bg-overlay)' }} />
                  <div className="animate-shimmer rounded h-3 w-3/4" style={{ background: 'var(--bg-overlay)' }} />
                </>
              ) : (
                <>
                  <UsageBar
                    label="AI Requests"
                    used={profile?.ai_requests_used ?? 0}
                    total={profile?.ai_requests_limit ?? 500}
                    color="var(--accent-400)"
                  />
                  <UsageBar
                    label="Connected Repos"
                    used={0}
                    total="Unlimited"
                  />
                  <UsageBar
                    label="Terminal Sessions"
                    used={0}
                    total="Unlimited"
                  />
                </>
              )}
            </div>
          </div>

          {/* Plans grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-up delay-200">
            {PLANS.map((plan) => {
              const isCurrent = currentPlan === plan.id;
              const isUpgradingThis = upgrading === plan.id;

              return (
                <div
                  key={plan.id}
                  className="panel p-5 flex flex-col"
                  style={{
                    border: plan.recommended ? `1px solid ${plan.color}40` : '1px solid var(--border-subtle)',
                    background: plan.recommended ? `${plan.color}06` : 'var(--bg-surface)',
                  }}
                >
                  {plan.recommended && (
                    <div className="text-xs font-medium mb-2" style={{ color: plan.color }}>✦ Recommended</div>
                  )}
                  <h3 className="font-display text-base font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>{plan.name}</h3>
                  <div className="flex items-baseline gap-0.5 mb-3">
                    <span className="font-display text-2xl font-bold" style={{ color: plan.color }}>{plan.price}</span>
                    {plan.period && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{plan.period}</span>}
                  </div>

                  <ul className="space-y-1.5 mb-4 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                        <Check size={10} style={{ color: plan.color, flexShrink: 0 }} aria-hidden="true" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <div
                      className="w-full py-2 rounded-lg text-center text-xs font-medium"
                      style={{ background: 'var(--bg-overlay)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
                    >
                      Current Plan
                    </div>
                  ) : plan.priceId ? (
                    <button
                      className="w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2"
                      style={{
                        background: plan.recommended ? plan.color : 'transparent',
                        color: plan.recommended ? 'var(--text-inverse)' : plan.color,
                        border: `1px solid ${plan.color}`,
                        minHeight: 40,
                      }}
                      onClick={() => handleUpgrade(plan.priceId!, plan.id)}
                      disabled={!!upgrading}
                      aria-label={`Upgrade to ${plan.name}`}
                    >
                      {isUpgradingThis ? (
                        <><Loader2 size={12} className="animate-spin" /> Processing…</>
                      ) : (
                        <><Zap size={12} /> Upgrade to {plan.name}</>
                      )}
                    </button>
                  ) : (
                    <button
                      className="w-full py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{ color: plan.color, border: `1px solid ${plan.color}`, minHeight: 40 }}
                      onClick={() => toast.info('Contact us at contact@yfitops.com for team pricing')}
                    >
                      Contact Sales
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stripe info banner */}
          {!supabase && (
            <div
              className="flex items-start gap-3 p-4 rounded-lg animate-fade-up delay-300"
              style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
              role="alert"
            >
              <AlertCircle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--warning)' }}>Stripe not configured</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                  Deploy the <code className="font-mono">create-checkout</code> edge function with <code className="font-mono">STRIPE_SECRET_KEY</code> to enable payments.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
