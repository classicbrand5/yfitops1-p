// src/pages/Landing.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import heroImage from '@/assets/hero-ide.jpg';

const STATS = [
  { value: '2,400+', label: 'Developers' },
  { value: '10M+', label: 'Commands Run' },
  { value: '99.9%', label: 'Uptime' },
  { value: '<2s', label: 'Avg AI Response' },
];

const FEATURES = [
  { title: 'Real Terminal', desc: 'Bash execution in a real WebContainer sandbox. Not a fake prompt.', icon: '💻', span: 'col-span-5' },
  { title: 'AI Code Generation', desc: 'The agent reads your files, writes production TypeScript, and applies diffs — no copy-paste.', icon: '🤖', span: 'col-span-7' },
  { title: 'GitHub Integration', desc: 'Connect repos, open PRs, view diffs.', icon: '⬆', span: 'col-span-4' },
  { title: 'Build Monitor', desc: 'Real-time CI/CD pipeline visibility.', icon: '📊', span: 'col-span-4' },
  { title: 'Engineering Analytics', desc: 'Commit frequency, build rates, AI usage.', icon: '📈', span: 'col-span-4' },
];

const PRICING = [
  { name: 'Starter', price: '$29', period: '/mo', repos: '3', ai: '500/mo', terminal: '50/mo', users: '1', support: 'Community', highlight: false },
  { name: 'Pro', price: '$79', period: '/mo', repos: 'Unlimited', ai: 'Unlimited', terminal: 'Unlimited', users: '3', support: 'Priority Email', highlight: true },
  { name: 'Team', price: '$199', period: '/mo', repos: 'Unlimited', ai: 'Unlimited', terminal: 'Unlimited', users: '10', support: 'Dedicated Slack', highlight: false },
];

const DEMO_CODE = `// YFitOps Agent writing auth middleware
import { Request, Response, NextFunction } from 'express';
import { verify } from 'jsonwebtoken';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing token' });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verify(token, process.env.JWT_SECRET!);
  req.user = payload as AuthPayload;
  next();
}`;

export default function Landing() {
  const navigate = useNavigate();
  const [typedCode, setTypedCode] = useState('');
  const [annual, setAnnual] = useState(true);
  const codeIdx = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (codeIdx.current < DEMO_CODE.length) {
        setTypedCode(DEMO_CODE.slice(0, codeIdx.current + 1));
        codeIdx.current++;
      } else {
        clearInterval(interval);
      }
    }, 18);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: 'var(--bg-void)', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', minHeight: '100vh' }}>
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 lg:px-12 py-4 border-b sticky top-0 z-20" style={{ borderColor: 'var(--border-subtle)', background: 'rgba(6,6,9,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,245,160,0.12)', border: '1px solid rgba(0,245,160,0.25)' }}>
            <span style={{ color: 'var(--accent-400)', fontSize: 14 }}>⚡</span>
          </div>
          <span className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>YFitOps</span>
        </div>
        <div className="hidden md:flex items-center gap-6 text-sm" style={{ color: 'var(--text-muted)' }}>
          <a href="#features" className="hover:opacity-80 transition-all">Features</a>
          <a href="#pricing" className="hover:opacity-80 transition-all">Pricing</a>
          <a href="#demo" className="hover:opacity-80 transition-all">Demo</a>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-ghost py-2 px-4 text-sm" style={{ minHeight: 36 }} onClick={() => navigate('/auth')}>Sign In</button>
          <button className="btn-accent py-2 px-4 text-sm" style={{ minHeight: 36 }} onClick={() => navigate('/auth')}>Start Free</button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col lg:flex-row items-center min-h-[92vh] px-6 lg:px-12 py-20 overflow-hidden gap-12">
        {/* Animated mesh blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute animate-drift-1" style={{ top: '-20%', left: '-10%', width: '70%', height: '70%', background: 'radial-gradient(ellipse, rgba(0,245,160,0.05) 0%, transparent 70%)' }} />
          <div className="absolute animate-drift-2" style={{ bottom: '-20%', right: '-10%', width: '60%', height: '60%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.06) 0%, transparent 70%)' }} />
          {/* Scan line */}
          <div className="absolute w-full h-px opacity-[0.015] animate-scan-line" style={{ background: 'linear-gradient(90deg, transparent, var(--accent-400), transparent)' }} />
        </div>

        {/* Left content */}
        <div className="flex-1 relative z-10 max-w-xl">
          <div className="flex items-center gap-2 mb-6 animate-fade-up">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,245,160,0.08)', border: '1px solid rgba(0,245,160,0.2)' }}>
              <span className="w-2 h-2 rounded-full animate-pulse-glow" style={{ background: 'var(--accent-400)' }} aria-hidden="true" />
              <span className="text-xs font-medium" style={{ color: 'var(--accent-400)', fontFamily: 'var(--font-body)' }}>Powered by Claude + Gemini</span>
            </div>
          </div>

          <h1 className="font-display font-bold mb-6 animate-fade-up delay-100" style={{ fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.1, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
            Ship Faster With an AI That{' '}
            <span className="glow-text" style={{ color: 'var(--accent-400)' }}>Actually Codes</span>
          </h1>

          <p className="text-lg mb-8 animate-fade-up delay-200" style={{ color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 480 }}>
            YFitOps connects to your GitHub repos, writes real code, runs real terminal commands, and opens PRs — while you focus on what matters.
          </p>

          <div className="flex flex-wrap gap-3 mb-8 animate-fade-up delay-300">
            <button className="btn-accent" onClick={() => navigate('/auth')} style={{ fontSize: 15 }}>
              Start Free — No Card Needed
            </button>
            <button className="btn-ghost" onClick={() => navigate('/workspace')}>
              Watch 90-Second Demo →
            </button>
          </div>

          <p className="text-xs animate-fade-up delay-400" style={{ color: 'var(--text-muted)' }}>
            Trusted by 2,400+ engineering teams
          </p>
        </div>

        {/* Right — IDE mockup */}
        <div className="flex-1 relative z-10 max-w-xl w-full animate-fade-up delay-300">
          <div className="glass rounded-xl overflow-hidden animate-float" style={{ boxShadow: 'var(--shadow-lg), var(--shadow-accent)' }}>
            {/* Window bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <div className="w-3 h-3 rounded-full" style={{ background: 'var(--danger)' }} aria-hidden="true" />
              <div className="w-3 h-3 rounded-full" style={{ background: 'var(--warning)' }} aria-hidden="true" />
              <div className="w-3 h-3 rounded-full" style={{ background: 'var(--success)' }} aria-hidden="true" />
              <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>YFitOps Workspace</span>
              <span className="ml-auto badge-accent">● Live</span>
            </div>

            {/* Code area */}
            <div className="p-4" style={{ background: 'var(--bg-base)', minHeight: 200 }}>
              <pre className="text-xs overflow-hidden" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.7, margin: 0 }}>
                {typedCode}
                <span className="animate-terminal-cursor" style={{ color: 'var(--accent-400)' }} aria-hidden="true">▌</span>
              </pre>
            </div>

            {/* Terminal */}
            <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-void)' }}>
              <p className="text-xs mb-1" style={{ color: 'var(--accent-400)', fontFamily: 'var(--font-mono)' }}>$ npm run build</p>
              <p className="text-xs" style={{ color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>✓ Build completed in 4.2s — 42 modules bundled</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="px-6 lg:px-12 py-8 border-y" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }} aria-label="Product statistics">
        <div className="max-w-4xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {STATS.map((stat) => (
            <div key={stat.label}>
              <div className="font-display text-3xl font-bold glow-text mb-1" style={{ color: 'var(--accent-400)' }}>{stat.value}</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features bento */}
      <section id="features" className="px-6 lg:px-12 py-20" aria-labelledby="features-heading">
        <div className="max-w-6xl mx-auto">
          <h2 id="features-heading" className="font-display text-3xl font-bold text-center mb-12" style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
            Everything you need to ship faster
          </h2>
          <div className="grid grid-cols-12 gap-4">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`${f.span} glass rounded-xl p-5 glass-hover transition-all group`}
                style={{ border: '1px solid var(--border-subtle)' }}
              >
                <div className="text-2xl mb-3" aria-hidden="true">{f.icon}</div>
                <h3 className="font-display text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)', fontSize: 14 }}>{f.title}</h3>
                <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Hero image */}
      <section className="px-6 lg:px-12 py-12" id="demo">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl overflow-hidden" style={{ boxShadow: 'var(--shadow-lg), var(--shadow-accent)', border: '1px solid var(--border-accent)' }}>
            <img src={heroImage} alt="YFitOps AI Agent IDE — real terminal, Monaco editor, and AI chat in one browser tab" className="w-full object-cover" style={{ maxHeight: 480, objectPosition: 'center top' }} loading="lazy" />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 lg:px-12 py-20" aria-labelledby="pricing-heading">
        <div className="max-w-5xl mx-auto">
          <h2 id="pricing-heading" className="font-display text-3xl font-bold text-center mb-4" style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
            Simple, transparent pricing
          </h2>
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Monthly</span>
            <button
              className="w-10 h-6 rounded-full transition-all relative"
              style={{ background: annual ? 'var(--accent-400)' : 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
              onClick={() => setAnnual(!annual)}
              role="switch"
              aria-checked={annual}
              aria-label="Toggle annual billing"
            >
              <span className="absolute top-0.5 transition-all w-5 h-5 rounded-full" style={{ background: 'white', left: annual ? 'calc(100% - 22px)' : 2 }} />
            </button>
            <span className="text-sm" style={{ color: annual ? 'var(--accent-400)' : 'var(--text-muted)' }}>Annual <span className="badge-accent ml-1">20% off</span></span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-xl p-6 relative ${tier.highlight ? 'glass-accent' : 'panel'}`}
                style={tier.highlight ? { boxShadow: 'var(--shadow-accent)' } : {}}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge-violet px-3 py-1">Most Popular</span>
                  </div>
                )}
                <h3 className="font-display text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{tier.name}</h3>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="font-display text-4xl font-bold" style={{ color: tier.highlight ? 'var(--accent-400)' : 'var(--text-primary)' }}>
                    {annual ? tier.price : (parseInt(tier.price.replace('$', '')) * 1.25).toFixed(0).replace(/^/, '$')}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>/mo</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {[['Repos', tier.repos], ['AI Requests', tier.ai], ['Terminal', tier.terminal], ['Users', tier.users], ['Support', tier.support]].map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between text-xs">
                      <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                      <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{v}</span>
                    </li>
                  ))}
                </ul>
                <button
                  className={tier.highlight ? 'btn-accent w-full' : 'btn-ghost w-full'}
                  onClick={() => navigate('/auth')}
                  aria-label={`Get started with ${tier.name} plan`}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 lg:px-12 py-12 border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-void)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start justify-between gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg" aria-hidden="true">⚡</span>
              <span className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>YFitOps AI Agent</span>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)', maxWidth: 220 }}>Your autonomous engineering brain — code, run, ship, repeat.</p>
          </div>
          <div className="flex flex-wrap gap-8 text-xs" style={{ color: 'var(--text-muted)' }}>
            <div>
              <p className="font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Product</p>
              <div className="space-y-1.5"><p>Features</p><p>Pricing</p><p>Changelog</p><p>Roadmap</p></div>
            </div>
            <div>
              <p className="font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Legal</p>
              <div className="space-y-1.5"><p>Privacy</p><p>Terms</p><p>Security</p></div>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t text-center" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>© {new Date().getFullYear()} YFitOps. Built for engineers who ship.</p>
        </div>
      </footer>
    </div>
  );
}
