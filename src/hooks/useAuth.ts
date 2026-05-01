// src/hooks/useAuth.ts
import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { supabase, isSupabaseReady } from '@/lib/supabase';
import type { AuthUser } from '@/store/useAppStore';

export function useAuth() {
  const { user, isAuthLoading, setUser, setAuthLoading } = useAppStore();

  useEffect(() => {
    if (!isSupabaseReady || !supabase) {
      // No Supabase — use mock user for development
      const mockUser = localStorage.getItem('yfitops-mock-user');
      if (mockUser) {
        try {
          setUser(JSON.parse(mockUser) as AuthUser);
        } catch {
          localStorage.removeItem('yfitops-mock-user');
        }
      }
      setAuthLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        setUser({
          id: u.id,
          email: u.email ?? '',
          fullName: (u.user_metadata?.['full_name'] as string | undefined) ?? u.email?.split('@')[0] ?? 'User',
          avatarUrl: u.user_metadata?.['avatar_url'] as string | undefined,
          role: (u.user_metadata?.['role'] as string | undefined) ?? 'developer',
          plan: 'starter',
          githubUsername: u.user_metadata?.['preferred_username'] as string | undefined,
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = session.user;
        setUser({
          id: u.id,
          email: u.email ?? '',
          fullName: (u.user_metadata?.['full_name'] as string | undefined) ?? u.email?.split('@')[0] ?? 'User',
          avatarUrl: u.user_metadata?.['avatar_url'] as string | undefined,
          role: (u.user_metadata?.['role'] as string | undefined) ?? 'developer',
          plan: 'starter',
          githubUsername: u.user_metadata?.['preferred_username'] as string | undefined,
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, setAuthLoading]);

  function mockSignIn(email: string, name: string) {
    const mockUser: AuthUser = {
      id: `mock-${Date.now()}`,
      email,
      fullName: name,
      role: 'developer',
      plan: 'starter',
    };
    localStorage.setItem('yfitops-mock-user', JSON.stringify(mockUser));
    setUser(mockUser);
  }

  function mockSignOut() {
    localStorage.removeItem('yfitops-mock-user');
    setUser(null);
  }

  return { user, isAuthLoading, mockSignIn, mockSignOut, isSupabaseReady };
}
