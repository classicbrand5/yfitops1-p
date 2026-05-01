// src/hooks/useOtpCooldown.ts
// Per-email OTP cooldown — persisted in sessionStorage to survive React StrictMode
// double-mounts and hot reloads, but clears on tab close.

import { useState, useEffect, useCallback, useRef } from 'react';

const COOLDOWN_SECONDS = 60;
const BASE_KEY = 'yfitops:otp-cooldown';

function storageKey(email: string): string {
  // key is per-email so switching addresses resets correctly
  return `${BASE_KEY}:${email.toLowerCase().trim()}`;
}

function readExpiry(email: string): number | null {
  try {
    const raw = sessionStorage.getItem(storageKey(email));
    if (!raw) return null;
    const val = parseInt(raw, 10);
    return isNaN(val) ? null : val;
  } catch {
    return null;
  }
}

function writeExpiry(email: string, expiresAt: number): void {
  try {
    sessionStorage.setItem(storageKey(email), String(expiresAt));
  } catch {
    // Storage quota — silently continue, cooldown won't persist
  }
}

function clearExpiry(email: string): void {
  try {
    sessionStorage.removeItem(storageKey(email));
  } catch { /* noop */ }
}

function getRemainingSeconds(email: string): number {
  const expiry = readExpiry(email);
  if (!expiry) return 0;
  const remaining = Math.ceil((expiry - Date.now()) / 1000);
  return remaining > 0 ? remaining : 0;
}

interface UseOtpCooldownReturn {
  /** Seconds remaining in cooldown. 0 = cooldown expired, action is allowed. */
  cooldownSeconds: number;
  /** Whether the cooldown is currently active (i.e. resend is blocked). */
  isCoolingDown: boolean;
  /**
   * Call this ONLY after a successful OTP send (not on attempt).
   * Optionally pass a custom duration to override the default 60s.
   */
  startCooldown: (durationSeconds?: number) => void;
  /** Call on successful OTP verification to clear the cooldown. */
  resetCooldown: () => void;
}

/**
 * Manages OTP resend cooldown per email address.
 *
 * Usage:
 *   const { cooldownSeconds, isCoolingDown, startCooldown, resetCooldown } = useOtpCooldown(email);
 *
 *   // After successful sendOtp():
 *   startCooldown();
 *
 *   // On 429 response — extends the cooldown:
 *   startCooldown(retryAfterSeconds ?? 60);
 *
 *   // After OTP verified:
 *   resetCooldown();
 */
export function useOtpCooldown(email: string): UseOtpCooldownReturn {
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(() =>
    getRemainingSeconds(email)
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recalculate when email changes
  useEffect(() => {
    setCooldownSeconds(getRemainingSeconds(email));
  }, [email]);

  // Tick down the timer
  useEffect(() => {
    if (cooldownSeconds <= 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      const remaining = getRemainingSeconds(email);
      setCooldownSeconds(remaining);
      if (remaining <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [cooldownSeconds, email]);

  const startCooldown = useCallback((durationSeconds: number = COOLDOWN_SECONDS) => {
    const expiresAt = Date.now() + durationSeconds * 1000;
    writeExpiry(email, expiresAt);
    const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
    setCooldownSeconds(remaining);
  }, [email]);

  const resetCooldown = useCallback(() => {
    clearExpiry(email);
    setCooldownSeconds(0);
  }, [email]);

  return {
    cooldownSeconds,
    isCoolingDown: cooldownSeconds > 0,
    startCooldown,
    resetCooldown,
  };
}
