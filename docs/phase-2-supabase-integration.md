# Phase 2 — Supabase Backend Integration

**Status:** ✅ Complete  
**Date:** 2026-05-01

---

## What Was Built

### Authentication (OTP + Password)

Following the spec and OnSpace implementation constraints:

1. **`src/lib/supabase.ts`** — Updated with PKCE flow + new helpers:
   - `sendOtp(email)` — Step 1: sends 6-digit code via Supabase `signInWithOtp`
   - `verifyOtpAndSetPassword(email, token, password, metadata)` — Step 2: verifies OTP, sets password + user metadata
   - `signInWithPassword(email, password)` — Login
   - `invokeFunction<T>(name, body)` — Generic edge function invoker with `FunctionsHttpError` extraction

2. **`src/hooks/useAuth.ts`** — Fully rewritten with double-safety pattern:
   - Safety #1: `supabase.auth.getSession()` (handles page refresh)
   - Safety #2: `supabase.auth.onAuthStateChange()` (handles all events)
   - `mapSupabaseUser()` is synchronous — no async/await
   - `mounted` flag prevents state updates after unmount

3. **`src/pages/Auth.tsx`** — OTP 3-step signup flow:
   - Step 1: Email + Name + Role + Terms agreement → sends OTP
   - Step 2: 6-digit OTP input with resend option
   - Step 3: Password + confirm with strength indicator
   - Sign-in: Email + Password (single form)
   - `setLoading(false)` only called on error, never before navigation

4. **`src/App.tsx`** — Route guard system:
   - `<ProtectedRoute>` — redirects unauthenticated users to `/auth`
   - `<PublicRoute>` — redirects authenticated users from `/auth` to `/workspace`
   - `<AuthBootstrap>` — single `useAuth()` mount at root level

### AI Agent Edge Function

**`supabase/functions/agent-inference/index.ts`** — Production-ready:
- Uses `ONSPACE_AI_API_KEY` + `ONSPACE_AI_BASE_URL` (already configured secrets)
- Model: `google/gemini-2.5-flash-preview`
- Validates structured JSON response schema
- Logs `ai_request` event to `events` table via service role
- Full CORS handling (OPTIONS always first)
- User auth via JWT from Authorization header
- Expert mode injects draft/critique instructions
- Workspace context injected into system prompt

### AI Agent Hook

**`src/hooks/useAIAgent.ts`** — Updated to use `supabase.functions.invoke()`:
- Uses `supabase.functions.invoke('agent-inference', { body })` instead of raw `fetch`
- Extracts real error messages from `FunctionsHttpError.context`

---

## Database Schema

Already provisioned (confirmed in Supabase):
- `profiles` — with handle_new_user trigger
- `ai_conversations` + `ai_messages` — with message_count increment trigger  
- `connected_repos`, `builds`, `terminal_sessions`, `events`
- All tables have RLS enabled with appropriate policies

---

## Environment Variables

| Variable | Location | Status |
|---|---|---|
| `VITE_SUPABASE_URL` | `.env` | ✅ Auto-configured |
| `VITE_SUPABASE_ANON_KEY` | `.env` | ✅ Auto-configured |
| `ONSPACE_AI_API_KEY` | Edge Function secrets | ✅ Configured |
| `ONSPACE_AI_BASE_URL` | Edge Function secrets | ✅ Configured |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function secrets | ✅ Auto-injected |

---

## Next Phases

- [ ] Phase 3: WebContainer boot + real file explorer
- [ ] Phase 4: Monaco editor with FS sync
- [ ] Phase 5: xterm.js terminal + WebContainer spawn
- [ ] Phase 6: Agent action execution (FS + terminal)
- [ ] Phase 7: Command palette + keyboard shortcuts
- [ ] Phase 8: Dashboard Realtime subscriptions
- [ ] Phase 9: Build Monitor Realtime
- [ ] Phase 10: Analytics charts from Supabase RPC
