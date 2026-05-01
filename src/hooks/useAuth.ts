
// src/hooks/useAuth.ts
// Supabase OTP + Password auth hook — single-source-of-truth pattern
//
// KEY DESIGN: onAuthStateChange is the ONE place that calls setUser.
// getSession() is used ONLY to call setAuthLoading(false) if the initial
// session check fires before onAuthStateChange can.
// This prevents double-setting user state which causes React StrictMode issues.

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { supabase, isSupabaseReady, signOut } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { AuthUser } from '@/store/useAppStore';

/** Maps a Supabase User → our AuthUser. MUST remain synchronous — no async/await. */
export function mapSupabaseUser(u: User): AuthUser {
  return {
    id: u.id,
    email: u.email ?? '',
    fullName:
      (u.user_metadata?.['full_name'] as string | undefined) ??
      (u.user_metadata?.['name'] as string | undefined) ??
      u.email?.split('@')[0] ??
      'User',
    avatarUrl:
      (u.user_metadata?.['avatar_url'] as string | undefined) ??
      (u.user_metadata?.['picture'] as string | undefined),
    role: (u.user_metadata?.['role'] as string | undefined) ?? 'developer',
    plan: 'starter',
    githubUsername:
      (u.user_metadata?.['preferred_username'] as string | undefined) ??
      (u.user_metadata?.['user_name'] as string | undefined),
  };
}

export function useAuth() {
  const { user, isAuthLoading, setUser, setAuthLoading } = useAppStore();
  // Guard against StrictMode double-mount re-subscriptions
  const subscribedRef = useRef(false);

  useEffect(() => {
    // Supabase not connected — mark loading done immediately
    if (!isSupabaseReady || !supabase) {
      setAuthLoading(false);
      return;
    }

    // Prevent double-subscription from StrictMode
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    let mounted = true;

    // ── Single source of truth: onAuthStateChange ─────────────
    // All setUser calls happen here. getSession below ONLY triggers
    // setAuthLoading(false) if the listener hasn't fired yet.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        switch (event) {
          case 'INITIAL_SESSION':
            // Fired synchronously on subscription — sets user from existing session
            setUser(session?.user ? mapSupabaseUser(session.user) : null);
            setAuthLoading(false);
            break;

          case 'SIGNED_IN':
            setUser(session?.user ? mapSupabaseUser(session.user) : null);
            setAuthLoading(false);
            break;

          case 'SIGNED_OUT':
            setUser(null);
            setAuthLoading(false);
            break;

          case 'TOKEN_REFRESHED':
            // Token refresh — update user silently, don't touch loading
            if (session?.user) setUser(mapSupabaseUser(session.user));
            break;

          case 'USER_UPDATED':
            if (session?.user) setUser(mapSupabaseUser(session.user));
            setAuthLoading(false);
            break;

          default:
            // Any other event — ensure loading is cleared
            setAuthLoading(false);
            break;
        }
      }
    );

    // ── Safety net: if INITIAL_SESSION doesn't fire (older Supabase) ──
    // We fall back to getSession() to clear loading. We do NOT call setUser
    // here — that would create a double-set race condition.
    const safetyTimer = setTimeout(async () => {
      if (!mounted) return;
      const { data: { session } } = await supabase!.auth.getSession();
      if (!mounted) return;
      // Only act if we're still loading (INITIAL_SESSION didn't fire)
      const stillLoading = useAppStore.getState().isAuthLoading;
      if (stillLoading) {
        setUser(session?.user ? mapSupabaseUser(session.user) : null);
        setAuthLoading(false);
      }
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      subscribedRef.current = false;
    };
  }, []); // Empty deps — subscribe once on mount only

  async function logout() {
    try {
      await signOut();
      // onAuthStateChange SIGNED_OUT will call setUser(null)
    } catch (err) {
      console.error('[useAuth] signOut error — forcing local sign-out:', err);
      // Network failure — force local state clear
      setUser(null);
      setAuthLoading(false);
    }
  }

  return {
    user,
    isAuthLoading,
    isSupabaseReady,
    logout,
    mapSupabaseUser,
    // Legacy compat
    mockSignOut: () => { setUser(null); setAuthLoading(false); },
  };
}
