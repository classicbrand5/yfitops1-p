# YFitOps AI Agent — Project Review & Gap Analysis

**Last updated:** Phase 9 completion  
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
| Phase 9: WebContainer Fix + Agent Executor | ✅ Complete | ENOENT fix, agentExecutor wired, PromptBar Enter key |

---

## 🔴 Known Broken / Incomplete

### 1. xterm.js Terminal (Real Integration) — SKIPPED
**File:** `src/components/features/Terminal/TerminalPanel.tsx`  
**Current state:** Uses a custom `<input>` + output `<div>` instead of a real xterm.js Terminal instance. The panel works for simple command execution but lacks:
- Real terminal emulation (ANSI escape codes, cursor control, colors)
- Proper resize handling via `@xterm/addon-fit`
- Ctrl+C / SIGINT forwarding to the spawned process
- Arrow key history properly scoped to the process (not a React input)
- Multi-process management with per-session xterm instances

**Fix required:** Replace the input/output div pattern with `new Terminal()` from `@xterm/xterm`, mount to a `<div ref>`, attach `addon-fit` on resize, wire stdin/stdout to the WebContainer process's `input`/`output` streams.

---

### 2. Monaco Editor Model Cache Disposal — INCOMPLETE
**File:** `src/components/features/Editor/CodeEditor.tsx`  
**Current state:** Models are cached via `Monaco.Uri.file(path)` to preserve undo history per file. However, **models are never disposed** when tabs are closed.  
**Impact:** Memory leak in long sessions with many files opened and closed.  
**Fix required:** In `closeTab` action (store) or in `EditorTabs.tsx`, call `monaco.editor.getModel(Monaco.Uri.file(path))?.dispose()` when the tab is permanently closed (not just hidden).

---

### 3. AgentMessage — File Tree Refresh After Actions
**File:** `src/components/features/AgentChat/AgentMessage.tsx`  
**Current state:** The `useFileSystem` hook's `refreshTree()` is called after `write_file`, `delete_file`, `create_dir`, and `edit_file` actions. However, this depends on `useFileSystem` being properly wired to the real WebContainer FS (which requires `isWebContainerReady()`).  
**Risk:** If WebContainer hasn't booted yet when the agent executes, the refresh silently fails and the file tree won't update.  
**Fix:** Add a guard `if (!isWebContainerReady()) return;` inside `refreshTree` in `useFileSystem.ts`.

---

### 4. Agent Executor — `edit_file` Diff Parser Reliability
**File:** `src/core/agent/agentExecutor.ts`  
**Current state:** Custom unified-diff parser (`applyUnifiedDiff`). The parser handles common cases but is not a full implementation of the unified diff spec.  
**Known gaps:**
- Does not handle `\ No newline at end of file` cleanly in all edge cases
- Hunk context line counts (`,s` in `@@ -l,s +l,s @@`) are parsed but not strictly validated
- Falls back to full content replacement if diff fails — correct behavior, but may mask AI hallucinated diffs

**Fix:** Consider importing the `diff` npm package (`import { applyPatch } from 'diff'`) once confirmed available in package.json.

---

### 5. PromptBar — Attach File Button Non-Functional
**File:** `src/components/features/AgentChat/PromptBar.tsx`  
**Current state:** The `<Paperclip>` button renders but has no `onClick` handler beyond the placeholder. It does not open a file picker or inject file content into the message.  
**Fix:** Implement a hidden `<input type="file">` triggered by the button. On file select, read content with `FileReader.readAsText()` and prepend it as a code block to the textarea.

---

### 6. Dashboard Stats — RPC `get_dashboard_stats` Not Yet Called
**File:** `src/pages/Dashboard.tsx`  
**Current state:** Dashboard may show hardcoded stat values or counts derived from local Realtime state rather than the `get_dashboard_stats()` Supabase RPC.  
**Fix:** In `Dashboard.tsx`, add a `useQuery` call:
```ts
useQuery({
  queryKey: ['dashboard-stats', user?.id],
  queryFn: () => supabase.rpc('get_dashboard_stats'),
  refetchInterval: 30_000,
})
```
And wire the result to the stat cards.

---

### 7. Build Monitor — `log_url` Field Empty
**File:** `src/pages/BuildMonitor.tsx`  
**Current state:** "View Logs" button exists but the `log_url` field in the `builds` table is typically `null` unless populated by a real CI/CD pipeline.  
**Fix:** The log drawer should gracefully handle `null` log_url with: "No logs available. Logs are populated when builds are triggered via the GitHub integration."

---

### 8. GitHub Integration — Octokit Not Wired
**Files:** None (feature not started)  
**Current state:** The `profiles` table has `github_username` and `github_access_token` columns, and `connected_repos` stores repo metadata. However, no Octokit-based code exists for:
- Listing user repos from GitHub API
- Creating pull requests
- Webhooks for triggering builds

**Fix:** Implement a `src/lib/github.ts` with Octokit initialization using the stored token. Wire to "Connect Repo" flow in the Dashboard.

---

### 9. Billing / Stripe — Not Implemented
**File:** `src/pages/Billing.tsx`  
**Current state:** Billing page is a placeholder. Stripe integration referenced in the original spec has not been started.  
**Fix:** Implement per the Stripe guidelines in Implementation Constraints: one-time payment or subscription mode, Supabase `subscribers` table, Edge Function for checkout session creation.

---

### 10. Analytics Page — Placeholder
**File:** `src/pages/Analytics.tsx`  
**Current state:** Analytics page exists but may show mock/placeholder content.  
**Fix (Phase 12):** Build Recharts visualizations — 30-day build success rate line chart, AI usage bar chart, language distribution donut chart. All fetched via react-query from Supabase.

---

### 11. Settings Page — Partially Implemented
**File:** `src/pages/Settings.tsx`  
**Current state:** Settings UI exists but may not persist changes to the `profiles` table via Supabase `UPDATE`.  
**Fix:** Wire each settings section to `supabase.from('profiles').update({...}).eq('id', user.id)` with optimistic updates and toast feedback.

---

### 12. WebContainer — COOP/COEP in Production
**File:** `public/_headers`  
**Current state:** `_headers` file is configured for Cloudflare Pages. However, if deployed to a different host (e.g., Vercel, Netlify), the headers won't be applied automatically.  
**Fix:** Ensure the deployment target is documented. For Vercel: add `vercel.json` with headers config. For Netlify: add `_headers` in root (already done for Cloudflare).

---

### 13. OTP Cooldown — `useOtpCooldown` Not Tested End-to-End
**File:** `src/hooks/useOtpCooldown.ts`  
**Current state:** Implemented in Phase 3, but has not been verified against actual Supabase 429 responses with `retryAfterSeconds` in the payload.  
**Fix:** Test with real OTP spam attempts. Confirm `sessionStorage` key survives navigation but not browser close.

---

### 14. Agent Autonomy — 'auto-safe' and 'full-auto' Modes Not Gated in UI
**File:** `src/pages/Settings.tsx`, `src/components/features/AgentChat/AgentChat.tsx`  
**Current state:** `agentAutonomy` is stored in Zustand and read by `agentExecutor.ts`, but there is no UI in Settings to change it. Users can only change it via the command palette (if wired).  
**Fix:** Add an autonomy selector in Settings under "AI Agent" section.

---

### 15. Notification Bell — Unread Count Not Persisted
**File:** `src/components/layout/TopBar.tsx`, `src/store/useAppStore.ts`  
**Current state:** `notifications` and `unreadNotificationCount` are in Zustand persist, but `notifications` array itself is excluded from `partialize`. After a page refresh, the bell shows 0.  
**Fix:** Either include `notifications` in `partialize`, or sync read/unread state with Supabase `events` table.

---

## 🟡 Deferred (Planned But Not Started)

| Item | Target Phase | Description |
|------|-------------|-------------|
| Real xterm.js terminal | Phase 10 | Wire xterm Terminal instance to WebContainer process streams |
| Monaco model cache disposal | Phase 11 | Dispose ITextModel on tab close to prevent memory leaks |
| Agent executor → UI wiring | Phase 11 | ActionCard approve/reject fully connected to executeActions() |
| Dashboard RPC stats | Phase 12 | Call get_dashboard_stats() Supabase RPC |
| Analytics charts | Phase 12 | Recharts visualizations from real Supabase data |
| GitHub / Octokit | Phase 13 | List repos, create PRs, webhook builds |
| Billing / Stripe | Phase 14 | Subscription or one-time payment integration |
| Settings persistence | Phase 15 | Wire settings form to Supabase profiles table update |

---

## 🟢 Auth: 401 Fix Applied (Phase 9 Addendum)

**File:** `src/hooks/useAIAgent.ts`  
**Problem:** Edge function returned 401 because:
1. No auth check before invoking — unauthenticated users could call `sendMessage()`
2. No session refresh before the call — expired tokens caused silent 401s
3. Error handling didn't differentiate 401 vs 502 vs 429

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
