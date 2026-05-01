// src/pages/Auth.tsx — OTP + Password authentication, fully hardened against 429
//
// Hardening summary:
//   • sendingRef (useRef) prevents duplicate in-flight OTP requests on double-click
//   • resendRef   (useRef) prevents duplicate in-flight resends
//   • useOtpCooldown per email: startCooldown() called ONLY after successful request
//   • 429 detection → startCooldown(retryAfterSeconds) so resend stays blocked
//   • Cooldown gating on BOTH initial send and resend paths
//   • No useEffect auto-triggers OTP on mount/change
//   • "Back to email" resets OTP fields but does NOT re-submit
//   • All buttons disabled while in-flight or during cooldown

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  sendOtp,
  verifyOtpAndSetPassword,
  signInWithPassword,
  isSupabaseReady,
} from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { useAuth, mapSupabaseUser } from '@/hooks/useAuth';
import { useOtpCooldown } from '@/hooks/useOtpCooldown';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Zap,
  ArrowLeft,
  Mail,
  Lock,
  User,
  CheckCircle,
  Clock,
} from 'lucide-react';

type Tab = 'signin' | 'signup';
type SignupStep = 'email' | 'otp' | 'password';

// ── 429 / rate-limit classifier ─────────────────────────────
function classifyOtpError(err: unknown): { message: string; is429: boolean; retryAfterSeconds: number } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  const is429 =
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many') ||
    lower.includes('email rate limit exceeded') ||
    lower.includes('for security purposes');

  // Try to parse a numeric retry-after from the message
  const retryMatch = lower.match(/(\d+)\s*second/);
  const retryAfterSeconds = retryMatch ? parseInt(retryMatch[1], 10) : 60;

  const message = is429
    ? `Too many requests — please wait ${retryAfterSeconds}s before trying again.`
    : raw;

  return { message, is429, retryAfterSeconds };
}

export default function AuthPage() {
  const navigate = useNavigate();
  const { setUser } = useAppStore();
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('signin');
  const [signupStep, setSignupStep] = useState<SignupStep>('email');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Per-action loading states (separate to avoid single boolean race)
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const [error, setError] = useState('');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('developer');
  const [otp, setOtp] = useState('');
  const [agreed, setAgreed] = useState(false);

  // ── In-flight locks — prevent double-click / duplicate requests ──
  const sendingRef  = useRef(false); // guards handleSendOtp
  const resendRef   = useRef(false); // guards handleResendOtp
  const signinRef   = useRef(false); // guards handleSignIn

  // ── Per-email cooldown (sessionStorage-persisted) ──────────
  const {
    cooldownSeconds,
    isCoolingDown,
    startCooldown,
    resetCooldown,
  } = useOtpCooldown(email);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) navigate('/workspace', { replace: true });
  }, [user, navigate]);

  function clearError() { setError(''); }

  function resetSignupToEmail() {
    setSignupStep('email');
    setOtp('');
    setPassword('');
    setConfirmPassword('');
    clearError();
    // NOTE: intentionally does NOT call sendOtp — just resets UI
  }

  // ── SIGN IN ────────────────────────────────────────────────
  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    if (!email.trim()) { setError('Email is required'); return; }
    if (!password)      { setError('Password is required'); return; }
    if (signinRef.current) return; // in-flight lock

    signinRef.current = true;
    setIsSigningIn(true);

    try {
      const supabaseUser = await signInWithPassword(email.trim(), password);
      setUser(mapSupabaseUser(supabaseUser!));
      toast.success('Welcome back!');
      navigate('/workspace');
      // Do NOT reset loading before navigation
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
      setIsSigningIn(false);
      signinRef.current = false;
    }
  }

  // ── SIGN UP Step 1: Send OTP ────────────────────────────────
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    clearError();

    // Validation gates
    if (!fullName.trim()) { setError('Full name is required'); return; }
    if (!email.trim())    { setError('Email is required'); return; }
    if (!agreed)          { setError('Please agree to the Terms of Service'); return; }

    // Cooldown gate — block if still within wait window
    if (isCoolingDown) {
      setError(`Please wait ${cooldownSeconds}s before requesting another code.`);
      return;
    }

    // In-flight lock — block duplicate click
    if (sendingRef.current) return;
    sendingRef.current = true;
    setIsSendingOtp(true);

    try {
      await sendOtp(email.trim());
      // startCooldown ONLY on success
      startCooldown();
      toast.success(`Verification code sent to ${email}`);
      setSignupStep('otp');
    } catch (err) {
      const { message, is429, retryAfterSeconds } = classifyOtpError(err);
      setError(message);
      if (is429) {
        // Enforce cooldown so immediate retry is impossible
        startCooldown(retryAfterSeconds);
        toast.error('Too many requests', { description: `Wait ${retryAfterSeconds}s before trying again.` });
      } else {
        toast.error('Failed to send OTP', { description: message });
      }
    } finally {
      setIsSendingOtp(false);
      sendingRef.current = false;
    }
  }

  // ── SIGN UP Step 2: Verify OTP (just advance step, no API call) ──
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    if (isVerifyingOtp) return;
    if (otp.trim().length < 4) {
      setError('Enter the 6-digit code from your email');
      return;
    }
    // Advance to password step — actual verification happens in handleSetPassword
    setIsVerifyingOtp(true);
    setSignupStep('password');
    clearError();
    setIsVerifyingOtp(false);
  }

  // ── Resend OTP — same cooldown + lock as initial send ──────
  async function handleResendOtp() {
    // Cooldown gate
    if (isCoolingDown) {
      toast.info(`Please wait ${cooldownSeconds}s before resending.`);
      return;
    }

    // In-flight lock
    if (resendRef.current) return;
    resendRef.current = true;
    setIsResending(true);

    try {
      await sendOtp(email.trim());
      // startCooldown ONLY on success
      startCooldown();
      toast.success('New code sent — check your inbox');
    } catch (err) {
      const { message, is429, retryAfterSeconds } = classifyOtpError(err);
      if (is429) {
        startCooldown(retryAfterSeconds); // enforce wait so resend stays blocked
        toast.error('Too many requests', { description: `Wait ${retryAfterSeconds}s before trying again.` });
      } else {
        toast.error('Failed to resend', { description: message });
      }
    } finally {
      setIsResending(false);
      resendRef.current = false;
    }
  }

  // ── SIGN UP Step 3: Set Password + complete registration ───
  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    if (password.length < 8)        { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (isCreatingAccount)            return;

    setIsCreatingAccount(true);

    try {
      const supabaseUser = await verifyOtpAndSetPassword(
        email.trim(),
        otp.trim(),
        password,
        { full_name: fullName.trim(), role },
      );
      resetCooldown(); // OTP verified — clear cooldown
      setUser(mapSupabaseUser(supabaseUser!));
      toast.success('Account created — welcome to YFitOps!');
      navigate('/workspace');
      // Do NOT reset loading — navigation handles it
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setError(msg);

      // OTP expired or invalid → send back to OTP entry with resend option
      if (msg.toLowerCase().includes('expired') || msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('token')) {
        setSignupStep('otp');
        setOtp('');
        toast.error('Code expired — request a new one', {
          action: { label: 'Resend', onClick: handleResendOtp },
        });
      }
      setIsCreatingAccount(false);
    }
    // Do NOT reset on success
  }

  // ── Feature pills (right panel) ────────────────────────────
  const featurePills = [
    { icon: '⚡', text: 'Real terminal — live bash execution' },
    { icon: '🤖', text: 'AI that writes code, not just suggestions' },
    { icon: '📊', text: 'Built-in engineering analytics' },
  ];

  // ── Step dot for signup progress ───────────────────────────
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
        {done ? <CheckCircle size={12} aria-hidden="true" /> : stepIdx + 1}
      </div>
    );
  }

  // ── Cooldown display label ──────────────────────────────────
  function CooldownLabel() {
    if (!isCoolingDown) return null;
    return (
      <span
        className="flex items-center gap-1 text-xs"
        style={{ color: 'var(--warning)' }}
        aria-live="polite"
        aria-label={`Resend available in ${cooldownSeconds} seconds`}
      >
        <Clock size={11} aria-hidden="true" />
        Resend in {cooldownSeconds}s
      </span>
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

        {/* ════════════════════════════════════════════════════
            SIGN IN
        ════════════════════════════════════════════════════ */}
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
                  disabled={isSigningIn}
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
                  onClick={() => toast.info('Password reset', { description: 'Use the Forgot Password flow via your Supabase dashboard.' })}
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
                  disabled={isSigningIn}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8"
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
              disabled={isSigningIn || !isSupabaseReady}
              className="btn-accent w-full"
              style={{ opacity: isSigningIn || !isSupabaseReady ? 0.7 : 1 }}
              aria-busy={isSigningIn}
            >
              {isSigningIn ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-inverse)' }} aria-hidden="true" />
                  Signing in…
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        )}

        {/* ════════════════════════════════════════════════════
            SIGN UP — Step 1: Email + Name
        ════════════════════════════════════════════════════ */}
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
                  disabled={isSendingOtp}
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
                  disabled={isSendingOtp}
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
                disabled={isSendingOtp}
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
                disabled={isSendingOtp}
              />
              <label htmlFor="signup-agreed" className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                I agree to the{' '}
                <span style={{ color: 'var(--accent-400)' }}>Terms of Service</span>
                {' '}and{' '}
                <span style={{ color: 'var(--accent-400)' }}>Privacy Policy</span>
              </label>
            </div>

            {/* Cooldown indicator on step 1 (if user went back after a send) */}
            {isCoolingDown && (
              <div className="flex items-center justify-center">
                <CooldownLabel />
              </div>
            )}

            <button
              type="submit"
              disabled={isSendingOtp || isCoolingDown || !isSupabaseReady}
              className="btn-accent w-full"
              style={{ opacity: isSendingOtp || isCoolingDown || !isSupabaseReady ? 0.7 : 1 }}
              aria-busy={isSendingOtp}
              aria-disabled={isCoolingDown}
            >
              {isSendingOtp ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-inverse)' }} aria-hidden="true" />
                  Sending…
                </span>
              ) : isCoolingDown ? (
                <span className="flex items-center justify-center gap-2">
                  <Clock size={14} aria-hidden="true" />
                  Wait {cooldownSeconds}s
                </span>
              ) : 'Send Verification Code →'}
            </button>
          </form>
        )}

        {/* ════════════════════════════════════════════════════
            SIGN UP — Step 2: OTP Verification
        ════════════════════════════════════════════════════ */}
        {tab === 'signup' && signupStep === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4 animate-fade-up" noValidate>
            {/* Progress steps */}
            <div className="flex items-center gap-2 mb-2" aria-label="Registration progress">
              <StepDot step="email" current={signupStep} />
              <div className="flex-1 h-px" style={{ background: 'var(--accent-400)' }} />
              <StepDot step="otp" current={signupStep} />
              <div className="flex-1 h-px" style={{ background: 'var(--border-default)' }} />
              <StepDot step="password" current={signupStep} />
            </div>

            <div className="text-center py-2">
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                Check your inbox
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                6-digit code sent to{' '}
                <strong style={{ color: 'var(--text-secondary)' }}>{email}</strong>
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
                disabled={isVerifyingOtp}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={otp.length < 4 || isVerifyingOtp}
              className="btn-accent w-full"
              style={{ opacity: otp.length < 4 || isVerifyingOtp ? 0.6 : 1 }}
              aria-busy={isVerifyingOtp}
            >
              Verify Code →
            </button>

            {/* Back + Resend row */}
            <div className="flex items-center justify-between text-xs" style={{ fontFamily: 'var(--font-body)' }}>
              <button
                type="button"
                className="hover:opacity-80 transition-all flex items-center gap-1"
                style={{ color: 'var(--text-muted)' }}
                onClick={resetSignupToEmail}
                disabled={isResending}
              >
                <ArrowLeft size={11} aria-hidden="true" />
                Back
              </button>

              <div className="flex items-center gap-2">
                {isCoolingDown
                  ? <CooldownLabel />
                  : (
                    <button
                      type="button"
                      className="hover:opacity-80 transition-all"
                      style={{ color: isResending ? 'var(--text-muted)' : 'var(--accent-400)' }}
                      onClick={handleResendOtp}
                      disabled={isResending || isCoolingDown}
                      aria-busy={isResending}
                    >
                      {isResending ? (
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 border border-t-transparent rounded-full animate-spin inline-block" aria-hidden="true" />
                          Sending…
                        </span>
                      ) : 'Resend code'}
                    </button>
                  )
                }
              </div>
            </div>
          </form>
        )}

        {/* ════════════════════════════════════════════════════
            SIGN UP — Step 3: Set Password
        ════════════════════════════════════════════════════ */}
        {tab === 'signup' && signupStep === 'password' && (
          <form onSubmit={handleSetPassword} className="space-y-4 animate-fade-up" noValidate>
            {/* Progress steps */}
            <div className="flex items-center gap-2 mb-2" aria-label="Registration progress">
              <StepDot step="email" current={signupStep} />
              <div className="flex-1 h-px" style={{ background: 'var(--accent-400)' }} />
              <StepDot step="otp" current={signupStep} />
              <div className="flex-1 h-px" style={{ background: 'var(--accent-400)' }} />
              <StepDot step="password" current={signupStep} />
            </div>

            <div className="text-center py-2">
              <div
                className="inline-flex items-center justify-center w-10 h-10 rounded-full mb-2"
                style={{ background: 'rgba(0,245,160,0.12)', border: '1px solid rgba(0,245,160,0.2)' }}
              >
                <CheckCircle size={20} style={{ color: 'var(--accent-400)' }} aria-hidden="true" />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                Email verified — set your password
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
                  disabled={isCreatingAccount}
                  autoFocus
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {/* Strength meter */}
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
                  disabled={isCreatingAccount}
                  style={{ borderColor: confirmPassword && confirmPassword !== password ? 'var(--danger)' : undefined }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8"
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
              disabled={isCreatingAccount || password.length < 8}
              className="btn-accent w-full"
              style={{ opacity: isCreatingAccount || password.length < 8 ? 0.7 : 1 }}
              aria-busy={isCreatingAccount}
            >
              {isCreatingAccount ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-inverse)' }} aria-hidden="true" />
                  Creating account…
                </span>
              ) : 'Create Account'}
            </button>

            <div className="text-center">
              <button
                type="button"
                className="text-xs hover:opacity-80 transition-all flex items-center gap-1 mx-auto"
                style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}
                onClick={() => { setSignupStep('otp'); clearError(); }}
                disabled={isCreatingAccount}
              >
                <ArrowLeft size={11} aria-hidden="true" />
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

        {/* Gradient blobs */}
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
