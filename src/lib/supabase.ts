// src/lib/supabase.ts
// Supabase client — requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

import { createClient } from '@supabase/supabase-js';
import { FunctionsHttpError } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing env vars — backend features will be unavailable. Connect your Supabase project to enable auth and data persistence.');
}

// Create client only when env vars are available
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export const isSupabaseReady = !!supabase;

// ── OTP + Password Auth helpers ────────────────────────────

/** Step 1 of signup: send OTP to email */
export async function sendOtp(email: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured — please connect your project');
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

/** Step 2 of signup: verify OTP, then set password + metadata */
export async function verifyOtpAndSetPassword(
  email: string,
  token: string,
  password: string,
  metadata: { full_name: string; role?: string }
) {
  if (!supabase) throw new Error('Supabase not configured — please connect your project');

  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (verifyError) throw verifyError;

  const { data, error: updateError } = await supabase.auth.updateUser({
    password,
    data: {
      full_name: metadata.full_name,
      role: metadata.role ?? 'developer',
      username: metadata.full_name,
    },
  });
  if (updateError) throw updateError;
  return data.user;
}

/** Login with email + password */
export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase not configured — please connect your project');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

/** Legacy — kept for compat */
export async function signInWithEmail(email: string, password: string) {
  return signInWithPassword(email, password);
}

/** Legacy — kept for compat */
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

/** Invoke a Supabase Edge Function with proper error extraction */
export async function invokeFunction<T = unknown>(
  name: string,
  body: Record<string, unknown>
): Promise<T> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const status = error.context?.status ?? 500;
        const text = await error.context?.text();
        msg = `[${status}] ${text || error.message || 'Unknown error'}`;
      } catch {
        msg = error.message || 'Failed to read response';
      }
    }
    throw new Error(msg);
  }
  return data as T;
}
