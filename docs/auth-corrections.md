# Auth OTP 429 Hardening — Audit & Changes

**Date:** 2026-05-01  
**Phase:** Auth Hardening (post Phase 2)  
**Status:** ✅ All issues resolved

---

## Audit Findings (Before)

### Checklist Results

| Check | Before | After |
|---|---|---|
| `useAuth.ts`: single `setUser` source | ❌ Both `getSession()` + `onAuthStateChange` called `setUser` | ✅ `onAuthStateChange` only |
| `Auth.tsx`: in-flight lock on `sendOtp` | ❌ Missing — double-click would fire twice | ✅ `sendingRef` (useRef) |
| `Auth.tsx`: in-flight lock on resend | ❌ Missing — inline `onClick` with no lock | ✅ `resendRef` (useRef) |
| `Auth.tsx`: cooldown gating on initial send | ❌ Missing | ✅ `isCoolingDown` check before submit |
| `Auth.tsx`: cooldown gating on resend | ❌ Missing | ✅ Same `isCoolingDown` check |
| `useOtpCooldown.ts`: exists | ❌ Missing entirely | ✅ Created from scratch |
| Cooldown: per-email keying | ❌ N/A | ✅ `yfitops:otp-cooldown:${email}` |
| Cooldown: sessionStorage persisted | ❌ N/A | ✅ Survives hot reload, StrictMode double-mount |
| Cooldown: starts only after success | ❌ N/A | ✅ `startCooldown()` inside `try {}` after `await sendOtp()` |
| 429: extends cooldown (not just UX) | ❌ No 429 detection | ✅ `classifyOtpError()` → `startCooldown(retryAfterSeconds)` |
| Button disabled during cooldown | ❌ No | ✅ `disabled={isCoolingDown}` |
| Button disabled during in-flight | ❌ Only by `isLoading` boolean (shared) | ✅ Per-action state (`isSendingOtp`, `isResending`, etc.) |
| StrictMode safety | ❌ `subscribedRef` missing | ✅ `subscribedRef.current` prevents double-subscription |

---

## Changes Made

### 1. `src/hooks/useAuth.ts` — Single source of truth

**Problem:** Both `getSession()` and `onAuthStateChange()` called `setUser`, causing double state flush and potential race conditions in React StrictMode.

**Fix:**
- Removed `setUser` from `getSession()` call path entirely
- `onAuthStateChange` handles `INITIAL_SESSION`, `SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`
- `getSession()` replaced with a 300ms safety timer that only fires if `isAuthLoading` is still `true` (i.e. `INITIAL_SESSION` didn't fire)
- Added `subscribedRef` to prevent StrictMode double-subscription
- Empty dependency array on `useEffect` — subscribes exactly once

### 2. `src/hooks/useOtpCooldown.ts` — Created from scratch

New hook implementing:
- **Per-email storage key**: `yfitops:otp-cooldown:${email.toLowerCase().trim()}`
- **sessionStorage persistence**: survives React StrictMode double-mount, hot reloads, page refresh within tab
- **Correct start semantics**: `startCooldown()` must be called manually after a successful `sendOtp()` — never on attempt
- **Tick-down timer**: `setInterval` updates countdown each second, cleared on expiry
- **Email change awareness**: `useEffect` on `email` recomputes remaining seconds when address changes
- **Exports**: `cooldownSeconds`, `isCoolingDown`, `startCooldown(durationSeconds?)`, `resetCooldown()`

### 3. `src/pages/Auth.tsx` — Zero duplicate OTP sends

**Problem areas fixed:**

#### In-flight locks (useRef)
```tsx
const sendingRef = useRef(false);  // guards handleSendOtp
const resendRef  = useRef(false);  // guards handleResendOtp (separate lock)
const signinRef  = useRef(false);  // guards handleSignIn
```
Each gate: `if (sendingRef.current) return;` at top of handler, set `true` before `await`, reset in `finally`.

#### Per-action loading states (not shared boolean)
```tsx
const [isSendingOtp, setIsSendingOtp] = useState(false);
const [isResending, setIsResending] = useState(false);
const [isSigningIn, setIsSigningIn] = useState(false);
const [isCreatingAccount, setIsCreatingAccount] = useState(false);
```
Prevents loading reset on one path from re-enabling another.

#### Cooldown gating on both paths
```tsx
// handleSendOtp — gate at top
if (isCoolingDown) { setError(`Wait ${cooldownSeconds}s`); return; }

// handleResendOtp — gate at top
if (isCoolingDown) { toast.info(`Wait ${cooldownSeconds}s`); return; }
```

#### startCooldown ONLY after success
```tsx
// handleSendOtp
try {
  await sendOtp(email.trim());
  startCooldown();           // ← only here, inside try
  setSignupStep('otp');
} catch ...
```

#### 429 detection + cooldown enforcement
```tsx
function classifyOtpError(err): { message, is429, retryAfterSeconds } {
  // Detects: '429', 'rate limit', 'too many', 'email rate limit exceeded', 'for security purposes'
  // Parses numeric retry-after from error message
}

// On catch:
const { message, is429, retryAfterSeconds } = classifyOtpError(err);
if (is429) {
  startCooldown(retryAfterSeconds); // extend cooldown — resend stays blocked
  toast.error('Too many requests', { description: `Wait ${retryAfterSeconds}s` });
}
```

#### "Back to email" doesn't re-submit
```tsx
function resetSignupToEmail() {
  setSignupStep('email');
  setOtp('');
  setPassword('');
  setConfirmPassword('');
  clearError();
  // NOTE: NO sendOtp() call here
}
```

#### Resend button UI reflects cooldown
```tsx
{isCoolingDown
  ? <CooldownLabel />   // shows "Resend in 42s" with clock icon
  : <button onClick={handleResendOtp} disabled={isResending}>Resend code</button>
}
```

---

## Files Modified

| File | Change |
|---|---|
| `src/hooks/useAuth.ts` | Rewritten — single `setUser` source via `onAuthStateChange` |
| `src/hooks/useOtpCooldown.ts` | **Created** — per-email cooldown with sessionStorage |
| `src/pages/Auth.tsx` | Full hardening — in-flight locks, cooldown gates, 429 classifier |

---

## Verification Checklist

- [x] **No duplicate OTP on double-click**: `sendingRef.current` check returns early on second click while first is in-flight
- [x] **No resend spam**: `resendRef` + `isCoolingDown` both block resend
- [x] **Refresh doesn't bypass cooldown**: sessionStorage expiry timestamp survives page refresh within same tab
- [x] **429 → resend stays blocked**: `startCooldown(retryAfterSeconds)` called in catch block, not just toasted
- [x] **Cooldown starts only after success**: `startCooldown()` is inside `try {}` after `await sendOtp()` succeeds
- [x] **Cooldown per email**: storage key includes normalized email — switching emails resets timer
- [x] **StrictMode safe**: `subscribedRef` in `useAuth` prevents double-subscription on development double-mount
- [x] **No auto-trigger useEffect**: Zero `useEffect` calls that invoke `sendOtp` — only user gesture handlers
- [x] **All buttons aria-busy**: Assistive technology informed of loading state
- [x] **Loading never resets before navigation**: `setIsSigningIn(false)` / `setIsCreatingAccount(false)` only in error catch

---

## Next Phase

- [ ] Phase 3: WebContainer boot sequence with real progress UI ✅ (done in same session)
- [ ] Phase 4: Monaco editor model caching (one model per file path)
- [ ] Phase 5: xterm.js terminal session with WebContainer spawn
- [ ] Phase 6: Agent action executor wired to real FS + terminal
