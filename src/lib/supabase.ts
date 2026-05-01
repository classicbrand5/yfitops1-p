// src/lib/supabase.ts
// Supabase client — requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing env vars — backend features will be unavailable. Connect your Supabase project to enable auth and data persistence.');
}

// Create client only when env vars are available
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isSupabaseReady = !!supabase;

// Auth helpers — all throw if Supabase not configured
export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Supabase not configured — please connect your project');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string, metadata: Record<string, string>) {
  if (!supabase) throw new Error('Supabase not configured — please connect your project');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
  if (error) throw error;
  return data;
}

export async function signInWithGitHub() {
  if (!supabase) throw new Error('Supabase not configured — please connect your project');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: `${window.location.origin}/workspace` },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
