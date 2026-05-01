# YFitOps AI Agent — Project Review & Gap Analysis

**Last updated:** Phase 10 completion  
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

---

## ✅ Fixed in Phase 10

### 1. xterm.js Terminal (Real Integration) — ✅ FIXED
**Resolution:** `TerminalPanel.tsx` completely rewritten. Real `@xterm/xterm@5.3.0` Terminal loaded from `esm.sh` CDN via dynamic `import()` (no package.json change needed). `@xterm/addon-fit@0.8.0` also from esm.sh. CSS injected via dynamic `<link>` tag. Multi-tab support via `Map<sessionId, XtermSession>`. WebContainer process stdout piped to `term.write()`. `term.onData()` sends keystrokes to process stdin. Ctrl+C → `\x03`, Ctrl+D → `\x04`, Ctrl+L → `term.clear()`. ResizeObserver triggers `fitAddon.fit()` on container resize. ASCII art welcome banner with ANSI colors.

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

### 1. Agent Executor — Auto-Execute Based on Autonomy (Full-Auto Mode)
**File:** `src/hooks/useAIAgent.ts`, `src/components/features/AgentChat/AgentMessage.tsx`  
**Current state:** When `agentAutonomy === 'full-auto'`, the agent still requires user to click Execute on each ActionCard. The `executeActions()` loop with `requestConfirmation` callback runs correctly for manual approval, but the autonomous path (skip confirmation when full-auto) is not triggered automatically after a message arrives.  
**Fix required:** In `useAIAgent.sendMessage()` or in `AgentMessage.tsx`, after the response arrives and actions are stored: if `agentAutonomy === 'full-auto'` or `agentAutonomy === 'auto-safe'`, automatically call `handleApprove()` for each non-destructive action without waiting for user click.

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

### 5. GitHub Integration — Octokit Not Wired
**Files:** None (feature not started)  
**Current state:** `profiles.github_access_token` column exists in Supabase. `connected_repos` table ready. But no Octokit-based repo listing, PR creation, or webhook integration exists.  
**Fix:** `src/lib/github.ts` with `new Octokit({ auth: profile.github_access_token })` → list repos, create PR, list branches. Wire to "Connect Repo" flow in Dashboard.

### 6. Billing / Stripe — Not Implemented
**File:** `src/pages/Billing.tsx`  
**Current state:** Placeholder page.  
**Fix:** Stripe Edge Function for checkout session. `subscribers` table. Subscription status on `profiles.plan`.

### 7. Analytics Page — Placeholder
**File:** `src/pages/Analytics.tsx`  
**Current state:** No real data. Placeholder layout.  
**Fix (Phase 12):** Recharts LineChart (build success rate), BarChart (AI usage), RadialChart (language distribution) via react-query from Supabase.

### 8. Settings Page — No Supabase Persistence
**File:** `src/pages/Settings.tsx`  
**Current state:** Settings UI (profile, AI agent, editor) changes do NOT persist to Supabase. They only update local state.  
**Fix:** Wire "Save Changes" button to `supabase.from('profiles').update({...}).eq('id', user.id)` with optimistic update and toast feedback.

### 9. xterm Terminal — No Command History (Arrow Keys)
**File:** `src/components/features/Terminal/TerminalPanel.tsx`  
**Current state:** The xterm `onData` handler does not implement arrow-key history navigation. Up/Down arrows are silently ignored in line-buffer mode.  
**Fix:** Maintain a `string[]` history array per session. On `\x1b[A` (up) and `\x1b[B` (down), navigate history and overwrite current line buffer using ANSI escape sequences (`\x1b[2K\r` to clear line, then rewrite).

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

---

## Deployment Notes

- **Cloudflare Pages**: `public/_headers` provides COOP/COEP headers for WebContainer SharedArrayBuffer support.
- **Build command**: `npm run build` (Vite)
- **Output directory**: `dist`
- **GitHub Actions workflow**: `.github/workflows/deploy.yml` — triggers on push to `main`
- **Node version**: 20.x recommended (matches Vite 5.x requirements)
- **xterm.js**: Loaded from `esm.sh` CDN at runtime — requires internet access in deployed environment. No build-time dependency.
