// src/pages/Auth.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmail, signUpWithEmail, signInWithGitHub, isSupabaseReady } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Eye, EyeOff, Zap, Github } from 'lucide-react';

type Tab = 'signin' | 'signup';

export default function AuthPage() {
  const navigate = useNavigate();
  const { mockSignIn } = useAuth();
  const [tab, setTab] = useState<Tab>('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '', role: 'developer', agreed: false,
  });

  function updateForm(field: keyof typeof form, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (tab === 'signup') {
      if (!form.fullName.trim()) { setError('Full name is required'); return; }
      if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
      if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
      if (!form.agreed) { setError('Please agree to the Terms of Service'); return; }
    }

    setIsLoading(true);

    try {
      if (isSupabaseReady) {
        if (tab === 'signup') {
          await signUpWithEmail(form.email, form.password, { full_name: form.fullName, role: form.role });
          toast.success('Account created! Check your email to confirm.');
        } else {
          await signInWithEmail(form.email, form.password);
          toast.success('Welcome back!');
          navigate('/workspace');
        }
      } else {
        // Mock auth for development
        mockSignIn(form.email, form.fullName || form.email.split('@')[0]);
        toast.success(tab === 'signup' ? 'Account created (demo mode)' : 'Signed in (demo mode)');
        navigate('/workspace');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGitHub() {
    if (!isSupabaseReady) {
      toast.error('GitHub OAuth requires Supabase — connect your project first');
      return;
    }
    await signInWithGitHub();
  }

  const featurePills = [
    { icon: '⚡', text: 'Real terminal — live bash execution' },
    { icon: '🤖', text: 'AI that writes code, not just suggestions' },
    { icon: '📊', text: 'Built-in engineering analytics' },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-void)' }}>
      {/* Left — Form (45%) */}
      <div className="flex-shrink-0 flex flex-col justify-center px-8 py-12 overflow-y-auto" style={{ width: '45%', minWidth: 320 }}>
        {/* Logo */}
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-glow)', border: '1px solid var(--border-accent)' }}>
            <Zap size={16} style={{ color: 'var(--accent-400)' }} />
          </div>
          <span className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>YFitOps</span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', width: 'fit-content' }}>
          {(['signin', 'signup'] as Tab[]).map((t) => (
            <button
              key={t}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                background: tab === t ? 'var(--bg-overlay)' : 'transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
                borderBottom: tab === t ? '2px solid var(--accent-400)' : '2px solid transparent',
              }}
              onClick={() => { setTab(t); setError(''); }}
              aria-pressed={tab === t}
            >
              {t === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg text-sm animate-fade-in" style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)', color: 'var(--danger)', fontFamily: 'var(--font-body)' }} role="alert">
            {error}
          </div>
        )}

        {!isSupabaseReady && (
          <div className="mb-4 px-4 py-3 rounded-lg text-xs" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: 'var(--warning)', fontFamily: 'var(--font-body)' }}>
            Demo mode — Supabase not connected. Auth is mocked locally.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {tab === 'signup' && (
            <div>
              <label htmlFor="fullName" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Full Name</label>
              <input id="fullName" type="text" value={form.fullName} onChange={(e) => updateForm('fullName', e.target.value)} className="input-dark" placeholder="Jane Smith" autoComplete="name" required />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Work Email</label>
            <input id="email" type="email" value={form.email} onChange={(e) => updateForm('email', e.target.value)} className="input-dark" placeholder="jane@company.com" autoComplete="email" required />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="password" className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Password</label>
              {tab === 'signin' && (
                <button type="button" className="text-xs" style={{ color: 'var(--accent-400)', fontFamily: 'var(--font-body)' }}>Forgot password?</button>
              )}
            </div>
            <div className="relative">
              <input id="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(e) => updateForm('password', e.target.value)} className="input-dark pr-10" placeholder="••••••••" autoComplete={tab === 'signup' ? 'new-password' : 'current-password'} required />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {tab === 'signup' && (
            <>
              <div>
                <label htmlFor="confirmPassword" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Confirm Password</label>
                <div className="relative">
                  <input id="confirmPassword" type={showPassword ? 'text' : 'password'} value={form.confirmPassword} onChange={(e) => updateForm('confirmPassword', e.target.value)} className="input-dark pr-10" placeholder="••••••••" autoComplete="new-password" required />
                </div>
              </div>

              <div>
                <label htmlFor="role" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>Role</label>
                <select id="role" value={form.role} onChange={(e) => updateForm('role', e.target.value)} className="input-dark" style={{ cursor: 'pointer' }}>
                  <option value="developer">Developer</option>
                  <option value="tech_lead">Tech Lead</option>
                  <option value="engineering_manager">Engineering Manager</option>
                </select>
              </div>

              <div className="flex items-start gap-2.5">
                <input type="checkbox" id="agreed" checked={form.agreed as boolean} onChange={(e) => updateForm('agreed', e.target.checked)} className="mt-0.5 accent-[#00F5A0]" required />
                <label htmlFor="agreed" className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                  I agree to the <span style={{ color: 'var(--accent-400)' }}>Terms of Service</span> and <span style={{ color: 'var(--accent-400)' }}>Privacy Policy</span>
                </label>
              </div>
            </>
          )}

          <button type="submit" disabled={isLoading} className="btn-accent w-full" style={{ opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-inverse)' }} aria-hidden="true" />
                {tab === 'signup' ? 'Creating account…' : 'Signing in…'}
              </span>
            ) : (tab === 'signup' ? 'Create Account' : 'Sign In')}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-subtle)' }} />
          </div>

          <button type="button" onClick={handleGitHub} className="btn-ghost w-full flex items-center justify-center gap-2">
            <Github size={15} aria-hidden="true" />
            Continue with GitHub
          </button>
        </form>
      </div>

      {/* Right — Visual panel (55%) */}
      <div className="flex-1 relative overflow-hidden hidden md:flex flex-col items-center justify-center p-12"
        style={{ background: 'linear-gradient(135deg, rgba(0,245,160,0.04) 0%, var(--bg-surface) 50%, rgba(124,58,237,0.06) 100%)', borderLeft: '1px solid var(--border-subtle)' }}>

        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(var(--border-default) 1px, transparent 1px), linear-gradient(90deg, var(--border-default) 1px, transparent 1px)', backgroundSize: '40px 40px' }} aria-hidden="true" />

        <div className="relative z-10 max-w-sm w-full">
          <h2 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
            "The IDE you've always wanted"
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
            Your autonomous engineering brain — code, run, ship, repeat.
          </p>

          <div className="space-y-3">
            {featurePills.map((pill, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-xl glass animate-slide-right"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <span className="text-lg flex-shrink-0" aria-hidden="true">{pill.icon}</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>{pill.text}</span>
              </div>
            ))}
          </div>

          {/* Mock code block */}
          <div className="mt-8 code-block">
            <div className="flex items-center gap-1.5 mb-3" aria-hidden="true">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--danger)' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--warning)' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--success)' }} />
              <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>auth.middleware.ts</span>
            </div>
            <pre className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
{`export async function authMiddleware(
  req: Request, res: Response, next: NextFunction
) {
  const token = req.headers.authorization
    ?.split(' ')[1];
  if (!token) return res.status(401)
    .json({ error: 'Missing token' });
  const payload = verify(token, SECRET);
  req.user = payload;
  next();
}`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
