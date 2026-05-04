// src/pages/GitHubCallback.tsx
// Phase 1: GitHub App OAuth callback page
// Route: /auth/github/callback?installation_id=XXX&code=YYY
// Exchanges the code for a user access token via the github-oauth edge function,
// saves it to the profile, then redirects to /workspace.

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase, isSupabaseReady } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';
import { Zap, Github, CheckCircle, AlertCircle } from 'lucide-react';

type Status = 'loading' | 'success' | 'error';

export default function GitHubCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, setUser } = useAppStore();

  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const ranRef = useRef(false);

  useEffect(() => {
    // Prevent StrictMode double-fire
    if (ranRef.current) return;
    ranRef.current = true;

    const code = searchParams.get('code');
    const installationId = searchParams.get('installation_id');

    if (!code || !installationId) {
      setStatus('error');
      setErrorMsg('Missing code or installation_id in the callback URL. Please try the installation again.');
      return;
    }

    void exchangeToken(code, Number(installationId));
  }, []);

  async function exchangeToken(code: string, installationId: number) {
    try {
      if (!isSupabaseReady || !supabase) {
        throw new Error('Supabase not configured');
      }

      // Ensure user is authenticated
      const { data: sessionData } = await supabase.auth.getSession();
      let accessToken = sessionData?.session?.access_token;

      if (!accessToken) {
        // Try to refresh
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData?.session) {
          // Not logged in — redirect to auth and come back after login
          toast.info('Please sign in first, then install the GitHub App again.');
          navigate('/auth');
          return;
        }
        accessToken = refreshData.session.access_token;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      console.log('[GitHubCallback] Exchanging code for token, installation_id=', installationId);

      const res = await fetch(`${supabaseUrl}/functions/v1/github-oauth`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, installation_id: installationId }),
      });

      const data = await res.json() as {
        token?: string;
        installation_id?: number;
        github_username?: string;
        error?: string;
      };

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `OAuth error (${res.status})`);
      }

      // Update the local user state with github_username if available
      if (data.github_username && user) {
        setUser({ ...user, githubUsername: data.github_username });
      }

      setStatus('success');
      toast.success('GitHub connected!', {
        description: data.github_username
          ? `Logged in as @${data.github_username}`
          : 'Your GitHub App installation is active.',
        duration: 4000,
      });

      // Brief delay so the success state is visible, then redirect
      setTimeout(() => {
        navigate('/workspace', { replace: true });
      }, 1500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[GitHubCallback] Error:', msg);
      setStatus('error');
      setErrorMsg(msg);
      toast.error('GitHub connection failed', { description: msg.slice(0, 200) });
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-void)' }}
    >
      {/* Card */}
      <div
        className="flex flex-col items-center gap-6 px-10 py-12 rounded-2xl max-w-sm w-full text-center"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-default)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--accent-glow)', border: '1px solid var(--border-accent)' }}
        >
          <Zap size={22} style={{ color: 'var(--accent-400)' }} />
        </div>

        {/* Status icon */}
        {status === 'loading' && (
          <>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center animate-pulse"
              style={{ background: 'rgba(0,245,160,0.08)', border: '1px solid rgba(0,245,160,0.2)' }}
            >
              <Github size={28} style={{ color: 'var(--accent-400)' }} />
            </div>
            <div>
              <h1
                className="text-lg font-semibold mb-1"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
              >
                Connecting GitHub
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                Exchanging authorization code…
              </p>
            </div>
            {/* Spinner */}
            <div
              className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
              style={{ borderColor: 'var(--accent-400)' }}
            />
          </>
        )}

        {status === 'success' && (
          <>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,245,160,0.10)', border: '1px solid rgba(0,245,160,0.3)' }}
            >
              <CheckCircle size={28} style={{ color: 'var(--accent-400)' }} />
            </div>
            <div>
              <h1
                className="text-lg font-semibold mb-1"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
              >
                GitHub Connected
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                Redirecting to workspace…
              </p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,77,109,0.10)', border: '1px solid rgba(255,77,109,0.3)' }}
            >
              <AlertCircle size={28} style={{ color: 'var(--danger)' }} />
            </div>
            <div>
              <h1
                className="text-lg font-semibold mb-1"
                style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}
              >
                Connection Failed
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                {errorMsg || 'An unexpected error occurred.'}
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full">
              <button
                className="w-full py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                style={{
                  background: 'var(--accent-glow)',
                  border: '1px solid var(--border-accent)',
                  color: 'var(--accent-400)',
                  fontFamily: 'var(--font-body)',
                }}
                onClick={() => {
                  window.open('https://github.com/apps/yfitops-ai/installations/new', '_blank');
                }}
              >
                Try Again
              </button>
              <button
                className="w-full py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-body)',
                }}
                onClick={() => navigate('/workspace')}
              >
                Go to Workspace
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
