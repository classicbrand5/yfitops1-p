// src/pages/Auth.tsx — OTP + Password authentication (spec-compliant)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  sendOtp,
  verifyOtpAndSetPassword,
  signInWithPassword,
  isSupabaseReady,
} from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Eye, EyeOff, Zap, ArrowLeft, Mail, Lock, User, CheckCircle } from 'lucide-react';

type Tab = 'signin' | 'signup';
type SignupStep = 'email' | 'otp' | 'password';

export default function AuthPage() {
  const navigate = useNavigate();
  const { setAuthLoading } = useAppStore();
  const { user, mapSupabaseUser } = useAuth();
  const { setUser } = useAppStore();

  const [tab, setTab] = useState<Tab>('signin');
  const [signupStep, setSignupStep] = useState<SignupStep>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Shared fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('developer');
  const [otp, setOtp] = useState('');
  const [agreed, setAgreed] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) navigate('/workspace', { replace: true });
  }, [user, navigate]);

  function clearError() { setError(''); }

  // ── Sign In ────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    if (!email.trim()) { setError('Email is required'); return; }
    if (!password) { setError('Password is required'); return; }

    setIsLoading(true);
    try {
      const supabaseUser = await signInWithPassword(email.trim(), password);
      setUser(mapSupabaseUser(supabaseUser!));
      toast.success('Welcome back!');
      navigate('/workspace');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setIsLoading(false);
    }
    // Do NOT reset loading on success — navigation handles it
  }

  // ── Sign Up: Step 1 — Send OTP ─────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    if (!fullName.trim()) { setError('Full name is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    if (!agreed) { setError('Please agree to the Terms of Service'); return; }

    setIsLoading(true);
    try {
      await sendOtp(email.trim());
      toast.success(`OTP sent to ${email} — check your inbox`);
      setSignupStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Sign Up: Step 2 — Verify OTP ──────────────────────────
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    if (otp.trim().length < 4) { setError('Enter the 6-digit code from your email'); return; }
    setSignupStep('password');
    clearError();
  }

  // ── Sign Up: Step 3 — Set Password ────────────────────────
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }

    setIsLoading(true);
    try {
      const supabaseUser = await verifyOtpAndSetPassword(email.trim(), otp.trim(), password, {
        full_name: fullName.trim(),
        role,
      });
      setUser(mapSupabaseUser(supabaseUser!));
      toast.success('Account created — welcome to YFitOps!');
      navigate('/workspace');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
      // If OTP expired, send back to start
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid')) {
        setSignupStep('otp');
        toast.error('OTP expired — request a new one', { action: { label: 'Resend', onClick: () => { setSignupStep('email'); setOtp(''); } } });
      }
      setIsLoading(false);
    }
    // Do NOT reset loading on success
  }

  const featurePills = [
    { icon: '⚡', text: 'Real terminal — live bash execution' },
    { icon: '🤖', text: 'AI that writes code, not just suggestions' },
    { icon: '📊', text: 'Built-in engineering analytics' },
  ];

  // ── Step progress indicator for signup ────────────────────
  function StepDot({ step, current }: { step: SignupStep; current: SignupStep }) {
    const steps: SignupStep[] = ['email', 'otp', 'password'];
    const stepIdx = steps.indexOf(step);
    const currIdx = steps.indexOf(current);
    const done = stepIdx < currIdx;
    const active = stepIdx === currIdx;
    return (
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all"
        style={{
          background: done ? 'var(--success)' : active ? 'var(--accent-400)' : 'var(--bg-elevated)',
          border: `1px solid ${done ? 'var(--success)' : active ? 'var(--accent-400)' : 'var(--border-default)'}`,
          color: done || active ? 'var(--text-inverse)' : 'var(--text-muted)',
        }}
        aria-label={`Step ${stepIdx + 1}: ${step}${done ? ' (complete)' : active ? ' (current)' : ''}`}
      >
        {done ? <CheckCircle size={12} /> : stepIdx + 1}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-void)' }}>
      {/* ── Left: Form (45%) ── */}
      <div
        className="flex-shrink-0 flex flex-col justify-center px-8 py-12 overflow-y-auto"
        style={{ width: '45%', minWidth: 320 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mb-10">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--accent-glow)', border: '1px solid var(--border-accent)' }}
          >
            <Zap size={16} style={{ color: 'var(--accent-400)' }} aria-hidden="true" />
          </div>
          <span className="font-display text-sm font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
            YFitOps
          </span>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 mb-8 p-1 rounded-lg"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', width: 'fit-content' }}
          role="tablist"
          aria-label="Authentication mode"
        >
          {(['signin', 'signup'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className="px-4 py-2 rounded-md text-sm font-medium transition-all"
              style={{
                background: tab === t ? 'var(--bg-overlay)' : 'transparent',
                color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                fontFamily: 'var(--font-body)',
                borderBottom: tab === t ? '2px solid var(--accent-400)' : '2px solid transparent',
              }}
              onClick={() => {
                setTab(t);
                setSignupStep('email');
                setError('');
                setOtp('');
                setPassword('');
                setConfirmPassword('');
              }}
            >
              {t === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* No Supabase warning */}
        {!isSupabaseReady && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-xs"
            style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', color: 'var(--warning)', fontFamily: 'var(--font-body)' }}
            role="alert"
          >
            ⚠ Supabase not connected — authentication is unavailable.
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm animate-fade-in"
            style={{ background: 'rgba(255,77,109,0.08)', border: '1px solid rgba(255,77,109,0.2)', color: 'var(--danger)', fontFamily: 'var(--font-body)' }}
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        {/* ── SIGN IN form ── */}
        {tab === 'signin' && (
          <form onSubmit={handleSignIn} className="space-y-4" noValidate>
            <div>
              <label htmlFor="signin-email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                Work Email
              </label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                <input
                  id="signin-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  className="input-dark pl-9"
                  placeholder="jane@company.com"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="signin-password" className="block text-xs font-medium" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs hover:opacity-80 transition-all"
                  style={{ color: 'var(--accent-400)', fontFamily: 'var(--font-body)' }}
                  onClick={() => toast.info('Password reset — check your email', { description: 'Use the "Forgot password?" link in your Supabase dashboard or contact support.' })}
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                <input
                  id="signin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  className="input-dark pl-9 pr-10"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isSupabaseReady}
              className="btn-accent w-full"
              style={{ opacity: isLoading || !isSupabaseReady ? 0.7 : 1 }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-inverse)' }} aria-hidden="true" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        )}

        {/* ── SIGN UP — Step 1: Email + Name ── */}
        {tab === 'signup' && signupStep === 'email' && (
          <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
            <div>
              <label htmlFor="signup-name" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                Full Name
              </label>
              <div className="relative">
                <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                <input
                  id="signup-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => { setFullName(e.target.value); clearError(); }}
                  className="input-dark pl-9"
                  placeholder="Jane Smith"
                  autoComplete="name"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                Work Email
              </label>
              <div className="relative">
                <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearError(); }}
                  className="input-dark pl-9"
                  placeholder="jane@company.com"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="signup-role" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                Role
              </label>
              <select
                id="signup-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="input-dark"
                style={{ cursor: 'pointer' }}
                disabled={isLoading}
              >
                <option value="developer">Developer</option>
                <option value="tech_lead">Tech Lead</option>
                <option value="engineering_manager">Engineering Manager</option>
              </select>
            </div>

            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="signup-agreed"
                checked={agreed}
                onChange={(e) => { setAgreed(e.target.checked); clearError(); }}
                className="mt-0.5"
                style={{ accentColor: 'var(--accent-400)' }}
                required
                disabled={isLoading}
              />
              <label htmlFor="signup-agreed" className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                I agree to the{' '}
                <span style={{ color: 'var(--accent-400)' }}>Terms of Service</span>
                {' '}and{' '}
                <span style={{ color: 'var(--accent-400)' }}>Privacy Policy</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isSupabaseReady}
              className="btn-accent w-full"
              style={{ opacity: isLoading || !isSupabaseReady ? 0.7 : 1 }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-inverse)' }} aria-hidden="true" />
                  Sending OTP…
                </span>
              ) : 'Send Verification Code →'}
            </button>
          </form>
        )}

        {/* ── SIGN UP — Step 2: OTP verification ── */}
        {tab === 'signup' && signupStep === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-up" noValidate>
            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-2">
              <StepDot step="email" current={signupStep} />
              <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
              <StepDot step="otp" current={signupStep} />
              <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
              <StepDot step="password" current={signupStep} />
            </div>

            <div className="text-center py-2">
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                Check your inbox
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                We sent a 6-digit code to <strong style={{ color: 'var(--text-secondary)' }}>{email}</strong>
              </p>
            </div>

            <div>
              <label htmlFor="otp-input" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                Verification Code
              </label>
              <input
                id="otp-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); clearError(); }}
                className="input-dark text-center text-lg tracking-widest"
                placeholder="000000"
                autoComplete="one-time-code"
                required
                disabled={isLoading}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={otp.length < 4}
              className="btn-accent w-full"
              style={{ opacity: otp.length < 4 ? 0.6 : 1 }}
            >
              Verify Code →
            </button>

            <div className="text-center">
              <button
                type="button"
                className="text-xs hover:opacity-80 transition-all"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
                onClick={() => { setSignupStep('email'); setOtp(''); clearError(); }}
              >
                <ArrowLeft size={11} className="inline mr-1" aria-hidden="true" />
                Back
              </button>
              <span className="mx-2" style={{ color: 'var(--border-default)' }}>·</span>
              <button
                type="button"
                className="text-xs hover:opacity-80 transition-all"
                style={{ color: 'var(--accent-400)', fontFamily: 'var(--font-body)' }}
                onClick={async () => {
                  try {
                    await sendOtp(email);
                    toast.success('New code sent');
                  } catch {
                    toast.error('Failed to resend — try again in a moment');
                  }
                }}
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        {/* ── SIGN UP — Step 3: Set Password ── */}
        {tab === 'signup' && signupStep === 'password' && (
          <form onSubmit={handleSetPassword} className="space-y-4 animate-fade-up" noValidate>
            {/* Step indicators */}
            <div className="flex items-center gap-2 mb-2">
              <StepDot step="email" current={signupStep} />
              <div className="flex-1 h-px" style={{ background: 'var(--accent-400)' }} />
              <StepDot step="otp" current={signupStep} />
              <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
              <StepDot step="password" current={signupStep} />
            </div>

            <div className="text-center py-2">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-2" style={{ background: 'rgba(0,245,160,0.12)', border: '1px solid rgba(0,245,160,0.2)' }}>
                <CheckCircle size={20} style={{ color: 'var(--accent-400)' }} aria-hidden="true" />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                Email verified! Set your password
              </p>
            </div>

            <div>
              <label htmlFor="new-password" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                Password
              </label>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearError(); }}
                  className="input-dark pl-9 pr-10"
                  placeholder="min 8 characters"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  disabled={isLoading}
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {password && (
                <div className="mt-1.5 flex gap-1" aria-label={`Password strength: ${password.length >= 12 ? 'strong' : password.length >= 8 ? 'medium' : 'weak'}`}>
                  {[1, 2, 3].map((lvl) => (
                    <div
                      key={lvl}
                      className="flex-1 h-1 rounded-full transition-all"
                      style={{
                        background: password.length >= lvl * 4
                          ? lvl === 1 ? 'var(--danger)' : lvl === 2 ? 'var(--warning)' : 'var(--success)'
                          : 'var(--border-default)',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                Confirm Password
              </label>
              <div className="relative">
                <Lock size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
                <input
                  id="confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); clearError(); }}
                  className="input-dark pl-9 pr-10"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  style={{ borderColor: confirmPassword && confirmPassword !== password ? 'var(--danger)' : undefined }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                >
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || password.length < 8}
              className="btn-accent w-full"
              style={{ opacity: isLoading || password.length < 8 ? 0.7 : 1 }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-inverse)' }} aria-hidden="true" />
                  Creating account…
                </span>
              ) : 'Create Account'}
            </button>

            <div className="text-center">
              <button
                type="button"
                className="text-xs hover:opacity-80 transition-all"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
                onClick={() => { setSignupStep('otp'); clearError(); }}
              >
                <ArrowLeft size={11} className="inline mr-1" aria-hidden="true" />
                Back to verification
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── Right: Visual panel (55%) ── */}
      <div
        className="flex-1 relative overflow-hidden hidden md:flex flex-col items-center justify-center p-12"
        style={{
          background: 'linear-gradient(135deg, rgba(0,245,160,0.04) 0%, var(--bg-surface) 50%, rgba(124,58,237,0.06) 100%)',
          borderLeft: '1px solid var(--border-subtle)',
        }}
      >
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: 'linear-gradient(var(--border-default) 1px, transparent 1px), linear-gradient(90deg, var(--border-default) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          aria-hidden="true"
        />

        {/* Blobs */}
        <div className="absolute" style={{ top: '-20%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(ellipse, rgba(0,245,160,0.05) 0%, transparent 70%)' }} aria-hidden="true" />
        <div className="absolute" style={{ bottom: '-20%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(ellipse, rgba(124,58,237,0.06) 0%, transparent 70%)' }} aria-hidden="true" />

        <div className="relative z-10 max-w-sm w-full">
          <h2 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>
            "The IDE you've always wanted"
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
            Your autonomous engineering brain — code, run, ship, repeat.
          </p>

          <div className="space-y-3 mb-8">
            {featurePills.map((pill, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3 rounded-xl glass animate-slide-right"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <span className="text-lg flex-shrink-0" aria-hidden="true">{pill.icon}</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
                  {pill.text}
                </span>
              </div>
            ))}
          </div>

          {/* Mock code block */}
          <div className="code-block">
            <div className="flex items-center gap-1.5 mb-3" aria-hidden="true">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--danger)' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--warning)' }} />
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--success)' }} />
              <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>auth.middleware.ts</span>
            </div>
            <pre className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
{`export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.headers
    .authorization?.split(' ')[1];
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
