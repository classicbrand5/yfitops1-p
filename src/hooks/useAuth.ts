// src/hooks/useAuth.ts
// Supabase OTP + Password auth hook — follows spec double-safety pattern

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import { supabase, isSupabaseReady, signOut } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { AuthUser } from '@/store/useAppStore';
import { toast } from 'sonner';

/** Maps a Supabase User → our AuthUser. MUST be synchronous — no async/await. */
function mapSupabaseUser(u: User): AuthUser {
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
    role:
      (u.user_metadata?.['role'] as string | undefined) ?? 'developer',
    plan: 'starter',
    githubUsername:
      (u.user_metadata?.['preferred_username'] as string | undefined) ??
      (u.user_metadata?.['user_name'] as string | undefined),
  };
}

export function useAuth() {
  const { user, isAuthLoading, setUser, setAuthLoading } = useAppStore();

  useEffect(() => {
    if (!isSupabaseReady || !supabase) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    // Safety #1: restore existing session (handles page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) setUser(mapSupabaseUser(session.user));
      else setUser(null);
      setAuthLoading(false);
    });

    // Safety #2: listen to all auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(mapSupabaseUser(session.user));
        setAuthLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setAuthLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(mapSupabaseUser(session.user));
      } else if (event === 'USER_UPDATED' && session?.user) {
        setUser(mapSupabaseUser(session.user));
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setUser, setAuthLoading]);

  async function logout() {
    try {
      await signOut();
    } catch (err) {
      console.error('[useAuth] signOut error:', err);
      // Force local sign-out even if network fails
      setUser(null);
    }
  }

  return {
    user,
    isAuthLoading,
    isSupabaseReady,
    logout,
    // Keep for compat with TopBar etc.
    mockSignOut: () => setUser(null),
    mapSupabaseUser,
  };
}
