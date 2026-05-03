# YFitOps AI Agent — Project Review & Gap Analysis

**Last updated:** Phase 16 — Multi-Provider AI Agent Switcher  
**Purpose:** Document all skipped, deferred, partially implemented, or known-broken items across all phases so nothing falls through the cracks.

---

## ✅ Completed Phases

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Foundation (design system, layout, routing) | ✅ Complete | CSS tokens, AppShell, Sidebar, StatusBar, SplitLayout |
| Phase 2: Supabase Integration | ✅ Complete | Auth, OTP+Password flow, profiles table |
| Phase 3: WebContainer Boot + File Explorer | ✅ Complete | Singleton boot, seed files, file tree |
| Phase 4–6: (Editor, Terminal stub, AgentChat UI) | ✅ Complete | Monaco @monaco-editor/react, xterm stub, ActionCard, DiffPreview |
| Phase 7: Command Palette | ✅ Complete | cmdk, 22 commands, 7 groups |
| Phase 8: Supabase Realtime (Dashboard + Build Monitor) | ✅ Complete | useRealtimeEvents, useRealtimeBuilds, live feeds |
| Phase 9: WebContainer Fix + Agent Executor + 401 Fix | ✅ Complete | ENOENT fix, agentExecutor wired, PromptBar Enter key, 401 auth fix |
| Phase 10: Real xterm Terminal + Memory + Stats + File Attach | ✅ Complete | Real xterm.js (esm.sh), Monaco model disposal, Dashboard RPC stats, PromptBar file attach, notification persistence |
| Phase 11-13: Agent Autonomy, GitHub, Analytics, Stripe, Settings Persist | ✅ Complete | Auto-execute logic, GitHub REST API, real Analytics RPC charts, Stripe checkout, Settings saved to Supabase, xterm history |
| Phase 16: Multi-Provider AI + Agent Inference v3 | ✅ Complete | Auto-execute logic, GitHub REST API, real Analytics RPC charts, Stripe checkout, Settings saved to Supabase, xterm history |

---

## ✅ Fixed in Phase 10

### 1. xterm.js Terminal (Real Integration) — ✅ FIXED (Hotfix)
**Resolution:** `TerminalPanel.tsx` completely rewritten as a **pure React terminal emulator** with zero external dependencies. Previous attempts used `esm.sh` CDN which failed due to CORS/MIME issues in the cross-origin-isolated iframe. The new implementation:
- ANSI color rendering via CSS spans (parseAnsi function)
- Hidden `<input>` captures keystrokes; visible output `<div>` renders lines
- Per-session `TermSession` objects stored in a module-level `Map`
- Command history (↑/↓), Ctrl+C/D/L, dangerous command blocking
- WebContainer process stdin/stdout wired via `spawn()` from `@/core/webcontainer/process`
- Auto-scrolls via `useLayoutEffect`
- No CDN imports, no `@xterm/xterm` dependency needed
- `vite.config.ts` excludes `@xterm/xterm` and `@xterm/addon-fit` from pre-bundling

### 2. Monaco Model Cache Disposal — ✅ FIXED
**Resolution:** `closeTab()` action in `useAppStore.ts` now accesses `window.monaco` (registered globally by `@monaco-editor/react` on mount), retrieves the model via `editor.getModel(Uri.file(path))` and calls `.dispose()`. Wrapped in try/catch for safety when Monaco hasn't loaded yet. Logged as `[Monaco] Disposed model for <path>`.

### 3. Dashboard Stats RPC — ✅ FIXED
**Resolution:** `Dashboard.tsx` calls `get_dashboard_stats()` Supabase RPC via `useDashboardStats()` hook (`useQuery` with `refetchInterval: 30_000`). All four stat cards show real numbers from Supabase.

### 4. PromptBar Attach File Button — ✅ FIXED
**Resolution:** Hidden `<input type="file">` wired to paperclip button click. `FileReader.readAsText()` reads selected file, prepends content as ` ```ext // File: name.ext \n content \n``` ` into the textarea. Textarea auto-resizes after insert. File input reset after reading for re-attachment.

### 5. Notification Bell Unread Count Persistence — ✅ FIXED
**Resolution:** `notifications` array (up to 50) and `unreadNotificationCount` added to `partialize` in Zustand persist config. Both survive page refresh now.

---

## 🔴 Known Broken / Incomplete

### 1. Agent Executor — Auto-Execute Based on Autonomy ✅ FIXED (Phase 11-13)
**Resolution:** `useEffect` in `useAIAgent.ts` watches messages for new pending actions. `full-auto` executes all; `auto-safe` skips `requiresConfirmation: true`; `ask` leaves as-is. `autoExecutedRef` prevents double-runs.

### 2. Agent Executor — `edit_file` Diff Parser Edge Cases
**File:** `src/core/agent/agentExecutor.ts`  
**Current state:** Custom `applyUnifiedDiff()` handles most cases but is not a full unified diff spec implementation.  
**Known gaps:**
- `\ No newline at end of file` handling in edge cases
- Hunk context line count validation not strict
- Falls back to full content replacement (correct behavior, but masks AI hallucinated diffs)

**Fix:** Import `applyPatch` from the `diff` npm package if/when it can be added to package.json.

### 3. AgentMessage — File Tree Refresh Race Condition
**File:** `src/components/features/AgentChat/AgentMessage.tsx`  
**Current state:** `refreshTree()` is called after FS actions. However, `useFileSystem.refreshTree()` already has an `if (!isWebContainerReady()) return;` guard, so this is safe. But if the agent executes before WebContainer boots (unlikely), the refresh silently no-ops.  
**Risk:** Low — WebContainer must be ready for the agent to function at all (auth gate + workspace boot gate).

### 4. Build Monitor — `log_url` Field Empty
**File:** `src/pages/BuildMonitor.tsx`  
**Current state:** "View Logs" opens the drawer. If `log_url` is null (no CI configured), the drawer shows "No log URL available" with explanation. ✅ This is correctly handled. The external link button is conditionally rendered only when `log_url` exists.

### 5. GitHub Integration ✅ FIXED (Phase 11-13)
**Resolution:** `src/lib/github.ts` implemented with raw fetch (no Octokit needed). Functions: `getGitHubToken()`, `saveGitHubToken()`, `listUserRepos()`, `connectReposToSupabase()`, `createPullRequest()`. Settings GitHub tab: paste PAT → validate → list repos → select & upsert to `connected_repos`.

### 6. Billing / Stripe ✅ IMPLEMENTED (Phase 11-13)
**Resolution:** `supabase/functions/create-checkout/index.ts` creates Stripe Checkout Sessions. `supabase/functions/stripe-webhook/index.ts` handles `checkout.session.completed` and `customer.subscription.deleted`. Real usage bars from `profiles.ai_requests_used/limit`. Requires `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` in Supabase secrets.

### 7. Analytics Page ✅ IMPLEMENTED (Phase 11-13)
**Resolution:** Real Supabase RPC calls: `get_build_success_rate(12)` → Area Chart, `get_ai_usage(30)` → Bar Chart, events table grouped by `event_type` → Donut chart. Skeleton loaders, empty states with explanatory messages. Top changed files still placeholder (no file change event tracking yet).

### 8. Settings Page ✅ FIXED (Phase 11-13)
**Resolution:** Profile save → `profiles.full_name + role`. Agent save → `profiles.expert_mode + agent_autonomy`. GitHub tab fully implemented. Uses `useMutation` + `useQuery` from react-query. Spinner during save, error toast on failure.

### 9. xterm Terminal — Command History ✅ FIXED (Phase 11-13)
**Resolution:** Per-session `history: string[]` + `historyIdx: number` in `XtermSession` object. Up arrow = older, Down arrow = newer, past end = clear. `\x1b[2K\r` clears line before writing history entry. Cap at 100. Only adds if different from last entry.

### 10. OTP Cooldown — Not Tested Against Real 429
**File:** `src/hooks/useOtpCooldown.ts`  
**Current state:** Implemented but not verified against actual Supabase 429 responses with `retryAfterSeconds`.  
**Fix:** Test with real OTP spam. Verify sessionStorage key format and cooldown extension logic.

---

## 🟡 Deferred (Planned But Not Started)

| Item | Target Phase | Description |
|------|-------------|-------------|
| Agent executor auto-approve (full-auto) | Phase 11 | Trigger executeActions automatically after message arrives |
| GitHub / Octokit | Phase 13 | List repos, create PRs, webhook builds |
| Analytics charts | Phase 12 | Recharts visualizations from real Supabase data |
| Billing / Stripe | Phase 14 | Subscription or one-time payment integration |
| Settings persistence | Phase 15 | Wire settings form to Supabase profiles table update |
| xterm command history | Phase 10.5 | Arrow key history in line-buffer mode |
| diff npm package | — | Replace custom applyUnifiedDiff with proper implementation |

---

## 🟢 Auth: 401 Fix Applied (Phase 9 Addendum)

**File:** `src/hooks/useAIAgent.ts`  
**Fixes applied:**
- Added `if (!user)` guard at top of `sendMessage` with redirect-to-auth toast
- Added `supabase.auth.getSession()` + `refreshSession()` before invoke
- Added `FunctionsHttpError` import and status-based error routing
- 401 → "Session expired" toast with Sign in action
- 502/503 → "AI service unavailable" toast
- 429 → "Rate limited" toast
- Generic errors → "AI Agent Error" toast with description

---

## Environment Variable Checklist

| Variable | Location | Status |
|----------|----------|--------|
| `VITE_SUPABASE_URL` | Cloudflare Pages / `.env` | Must be set |
| `VITE_SUPABASE_ANON_KEY` | Cloudflare Pages / `.env` | Must be set |
| `ONSPACE_AI_API_KEY` | Supabase Edge Function secrets | ✅ Configured |
| `ONSPACE_AI_BASE_URL` | Supabase Edge Function secrets | ✅ Configured |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets (auto) | ✅ Auto-set |
| `GOOGLE_AI_API_KEY` | Supabase Edge Function secrets | From aistudio.google.com — ✅ Added |
| `GROQ_API_KEY` | Supabase Edge Function secrets | From console.groq.com — ✅ Added |
| `OPENROUTER_API_KEY` | Supabase Edge Function secrets | From openrouter.ai/keys — ✅ Added |
| `CLOUDFLARE_AI_API_KEY` | Supabase Edge Function secrets | From dash.cloudflare.com → AI — ✅ Added |
| `CLOUDFLARE_ACCOUNT_ID` | Supabase Edge Function secrets | Cloudflare account ID |
| `CEREBRAS_API_KEY` | Supabase Edge Function secrets | From inference.cerebras.ai — ✅ Added |
| `TOGETHER_AI_API_KEY` | Supabase Edge Function secrets | From api.together.xyz — ✅ Added (edge fn uses this key name) |

---

## Deployment Notes

- **Cloudflare Pages**: `public/_headers` provides COOP/COEP headers for WebContainer SharedArrayBuffer support.
- **Build command**: `npm run build` (Vite)
- **Output directory**: `dist`
- **GitHub Actions workflow**: `.github/workflows/deploy.yml` — triggers on push to `main`
- **Node version**: 20.x recommended (matches Vite 5.x requirements)
- **xterm.js**: Loaded from `esm.sh` CDN at runtime — requires internet access in deployed environment. No build-time dependency.
