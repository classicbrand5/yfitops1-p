# Phase 11/12/13 — Final Polish, GitHub, Analytics, Stripe, Agent Autonomy

**Date:** Phase 11-13 combined  
**Status:** ✅ Complete

---

## What Was Built

### 1. xterm Terminal — CDN Import Kept (With Fix)

The GitHub-committed `TerminalPanel.tsx` had a conflicting static import line:
```ts
import { Terminal } from '@xterm/xterm'; // was wrong — package not installed
```

**Resolution:** Removed the conflicting static import. The CDN dynamic import (`esm.sh`) is the correct approach since `@xterm/xterm` is not in `package-lock.json`. The CDN imports work because:
- `esm.sh` serves with correct CORS headers
- The app runs in a cross-origin isolated context (COOP/COEP headers in `public/_headers`)
- Dynamic imports avoid build-time dependency resolution

**Additional terminal features added:**
- `history: string[]` per session — newest last, capped at 100
- `historyIdx: number` — -1 = not navigating
- `lineBuffer: string` — per-session (was local variable before, now part of session object)
- Arrow Up (`\x1b[A`) navigates older commands, clears line with `\x1b[2K\r`
- Arrow Down (`\x1b[B`) navigates newer commands or resets to empty
- History entry added only if different from last entry
- Navigation works even when a process is running (but Enter only submits when no process active)
- Danger warning overlay tracks typed command live

---

### 2. Agent Executor — Auto-Execute Based on Autonomy

**File:** `src/hooks/useAIAgent.ts`

Added a `useEffect` that watches `messages` for new assistant messages with pending actions:

```ts
useEffect(() => {
  if (isThinking) return;
  for (const msg of allMessages) {
    if (msg.role !== 'assistant') continue;
    if (!msg.actions?.some(a => a.status === 'pending')) continue;
    if (autoExecutedRef.current.has(msg.id)) continue;
    if (agentAutonomy === 'ask') continue;

    autoExecutedRef.current.add(msg.id); // prevent double-run
    void autoExecuteMessage(msg, convId);
  }
}, [messages, isThinking, agentAutonomy]);
```

**Autonomy logic:**
- `full-auto`: executes ALL pending actions (including `requiresConfirmation: true`)
- `auto-safe`: executes only actions where `requiresConfirmation === false` (reads, safe writes, test runs)
- `ask`: no auto-execution, always waits for user to click Execute

**After FS actions**, the file tree is refreshed automatically:
```ts
if (fsActions.includes(action.type)) {
  const { buildFileTree } = await import('@/core/webcontainer/fs');
  const tree = await buildFileTree('/');
  useAppStore.getState().setFileTree(tree);
}
```

**Memory safety:** `useRef<Set<string>>` tracks which message IDs have been auto-executed to prevent double-runs on re-render.

---

### 3. Settings Page — Supabase Persistence

**File:** `src/pages/Settings.tsx`

- **Profile tab**: `full_name` + `role` → `supabase.from('profiles').update()`
- **Agent tab**: `expert_mode` + `agent_autonomy` → persisted to Supabase
- **GitHub tab**: Full connect flow (new — see section 4)
- `useSaveProfile()` mutation with `@tanstack/react-query`
- `useProfileData()` query pre-populates form from Supabase
- Optimistic update via Zustand + revert on failure
- Save button shows spinner during save (`Loader2`) and check on success
- Email field is read-only (can't be changed via profile update)

---

### 4. GitHub Integration

**File:** `src/lib/github.ts`

Uses raw `fetch` + GitHub REST API (no Octokit dependency needed):

| Function | Purpose |
|---|---|
| `getGitHubToken()` | Reads token from Supabase profiles table |
| `saveGitHubToken(token)` | Validates token, saves to profiles with github_username |
| `getAuthenticatedGitHubUser(token)` | Calls `/user` to validate and get login |
| `listUserRepos(token?)` | GET `/user/repos` — up to 100 repos sorted by updated |
| `connectReposToSupabase(repos)` | Upserts selected repos to `connected_repos` table |
| `createPullRequest(...)` | POST `/repos/:owner/:repo/pulls` |

**Settings GitHub tab flow:**
1. User pastes Personal Access Token
2. Token validated against GitHub API (`/user`)
3. `github_username` + token saved to profiles
4. Repo list fetched and displayed with checkboxes
5. Selected repos upserted to `connected_repos` table
6. "Refresh" button re-fetches repo list anytime

**PAT instructions shown inline** — links to GitHub token settings with required scopes (`repo`, `read:user`).

---

### 5. Analytics Page — Real Supabase Data

**File:** `src/pages/Analytics.tsx`

Replaced 100% mock data with real Supabase RPC calls:

| Section | Data Source |
|---|---|
| Build Success Rate (Area Chart) | `get_build_success_rate(weeks: 12)` RPC |
| AI Requests Bar Chart | `get_ai_usage(days: 30)` RPC |
| Category Breakdown (Donut) | `events` table, grouped by `event_type` |
| Top Changed Files | Placeholder (no file change tracking yet) |
| 4 Stat Cards | Derived from RPC data |

- Skeleton loaders (`ChartSkeleton`) while loading
- `EmptyChart` component for zero-data states with explanatory messages
- Donut chart colors mapped to event types, with fallback color array
- Total AI requests and avg build success shown in stat cards

---

### 6. Billing / Stripe

**File:** `src/pages/Billing.tsx`
- Real `ai_requests_used` / `ai_requests_limit` from Supabase profiles
- 3-tier plan grid: Starter (free), Pro ($49/mo), Team ($199/mo)
- Upgrade button calls `supabase.functions.invoke('create-checkout', { body: { priceId } })`
- Returns Stripe Checkout URL → opened in new tab
- Graceful fallback if edge function not deployed (shows descriptive error)
- `stripe_customer_id` shown on current plan card

**Edge Function:** `supabase/functions/create-checkout/index.ts`
- Auth via JWT
- Creates/reuses Stripe customer
- Creates Stripe Checkout Session (subscription mode)
- Returns `{ url }` for redirect

**Webhook:** `supabase/functions/stripe-webhook/index.ts`
- Verifies Stripe signature (custom HMAC-SHA256 implementation, no external deps)
- `checkout.session.completed` → updates `profiles.plan = 'pro'`, `plan_expires_at`
- `customer.subscription.deleted` → downgrades to `starter`
- Logs events to `events` table
- Required secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

---

## Verification Checklist

- [x] Terminal loads — CDN xterm, no conflicting static imports
- [x] Arrow Up/Down navigates history per session
- [x] Settings profile save → persists to Supabase
- [x] Settings agent autonomy save → persists to Supabase
- [x] GitHub connect flow: token → validate → list repos → upsert
- [x] Analytics shows real RPC data (empty states when no data)
- [x] Billing shows real `ai_requests_used` from profiles
- [x] Upgrade button creates Stripe checkout or shows descriptive error
- [x] Auto-execution fires for `full-auto` and `auto-safe` modes
- [x] `full-auto` executes all pending actions without user clicks
- [x] `auto-safe` skips `requiresConfirmation: true` actions
- [x] File tree refreshes after auto-executed FS actions
- [x] No TypeScript errors (all types maintained)
- [x] Edge functions: CORS, auth, error handling

---

## Environment Variables Needed

| Variable | Where | Purpose |
|---|---|---|
| `STRIPE_SECRET_KEY` | Supabase secrets | Stripe API key for checkout |
| `STRIPE_WEBHOOK_SECRET` | Supabase secrets | Webhook signature verification |
| `VITE_SUPABASE_URL` | Cloudflare Pages | Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Cloudflare Pages | Supabase anon key |

---

## Files Modified/Created

| File | Change |
|---|---|
| `src/components/features/Terminal/TerminalPanel.tsx` | Fixed CDN imports, added command history |
| `src/hooks/useAIAgent.ts` | Added auto-execute useEffect based on agentAutonomy |
| `src/pages/Settings.tsx` | Full Supabase persistence + GitHub tab |
| `src/pages/Analytics.tsx` | Real Supabase RPC data, real charts |
| `src/pages/Billing.tsx` | Real usage from profiles, Stripe upgrade flow |
| `src/lib/github.ts` | New — GitHub REST API integration |
| `supabase/functions/create-checkout/index.ts` | New — Stripe Checkout Session creator |
| `supabase/functions/stripe-webhook/index.ts` | New — Stripe webhook handler |
