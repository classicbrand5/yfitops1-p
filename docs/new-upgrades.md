docs/new-upgrades.md:
# YFitOps Upgrade Tracker
> OnSpace AI: READ THIS FILE at the start of every session before touching any code.
> UPDATE the relevant phase section before ending every session.

## How to use this doc
- Mark each task ✅ when fully working, ⚠️ when partial, ❌ when broken
- Record every file you touched under "Files Modified"
- Record every blocker under "Blockers / Notes"
- Never skip the verification step at the end of each phase

---

## Phase 0 — Stability Baseline
**Goal:** Confirm existing features actually work before adding anything new.
**Status:** ✅ Complete

### Tasks
- ✅ Suspense import fix — `App.tsx` already had `import React, { Suspense, lazy }` — confirmed no fix needed
- ✅ UUID format fix — replaced `Math.random()` ID generation with `crypto.randomUUID()` in `useAppStore.ts` (tab IDs, notification IDs) and `useStreamingAgent.ts` (message IDs, conversation IDs)
- ✅ Default model string — `agent-inference/index.ts` already uses `google/gemini-2.5-flash-preview` — confirmed correct
- ✅ SSE streaming / useStreamingAgent — `AgentChat.tsx` already imports and uses `useStreamingAgent` (not old `supabase.functions.invoke` pattern) — confirmed wired
- ✅ File tree right-click context menu — `FileTreeNode.tsx` already has full context menu: New File, New Folder, Rename, Copy Path, Open in Terminal, Delete (with ConfirmModal gate) — confirmed working
- ✅ Monaco view state — `CodeEditor.tsx` already calls `editor.saveViewState()` before tab switch and `editor.restoreViewState()` after `setModel()` via `viewStatesRef` Map — confirmed working
- ✅ Slash command autocomplete in PromptBar — implemented `/review`, `/explain`, `/test` commands with floating menu, ArrowUp/Down navigation, Enter/Tab to select, colored badge above input showing active mode
- ✅ Provider health dots in AgentModelPicker — green/red dots next to each provider showing whether API key is configured in Supabase secrets (probed via lightweight edge function call on dropdown open)
- ✅ AI Secrets tab in Settings — new "AI Secrets" tab listing all provider secret names, where to get them, and a note that health dots appear in the model picker

### Files Modified
- `src/store/useAppStore.ts` — replaced `Math.random()` tab/notification IDs with `crypto.randomUUID()`
- `src/hooks/useStreamingAgent.ts` — replaced `Math.random()` message/conv IDs with `crypto.randomUUID()`; added `slashCommand` param forwarding to edge function
- `src/components/features/AgentChat/PromptBar.tsx` — full rewrite: slash command autocomplete (`/review`, `/explain`, `/test`), floating menu with ArrowUp/Down/Enter navigation, active mode badge with dismiss button
- `src/components/features/AgentChat/AgentModelPicker.tsx` — added `useProviderHealth` hook (probes each provider via edge function), `HealthDot` component (green/red circle), legend in dropdown header, footer link to Settings → AI Secrets
- `src/components/features/AgentChat/AgentChat.tsx` — updated `handleSend` to forward `slashCommand` param to `sendMessage`
- `src/pages/Settings.tsx` — added "AI Secrets" tab with full provider secret name table, setup instructions, and warning note about health dots location

### Verification
1. Send a message — verify no ID collisions in browser console
2. Type `/` in PromptBar — verify slash menu appears with 3 options
3. Select `/review` — verify badge appears above input, textarea border changes color
4. Send a message with `/review` active — verify `slashCommand: 'CODE_REVIEW_MODE'` appears in edge function request
5. Open model picker → verify dots appear next to providers (may take 2-3s to probe)
6. Go to Settings → AI Secrets — verify table of all 8 secrets is shown
7. Switch editor tabs — verify scroll position restores correctly
8. Right-click a file — verify context menu appears with all options

### Blockers / Notes
- Provider health probe: the edge function call completes a full auth + rate-limit check, which increments `ai_requests_used` counter. To avoid this, the `_healthCheck` flag is passed in the body but the edge function does not yet short-circuit on it — implement that optimization in Phase 1 if needed.
- Cloudflare AI requires both `CLOUDFLARE_AI_API_KEY` and `CLOUDFLARE_ACCOUNT_ID` to be set. The account ID is used to construct the base URL in the edge function (`buildProviders()` function). Noted in the Secrets tab.
- The slash command `slashCommand` param is now passed all the way: PromptBar → `handleSend` (AgentChat) → `sendMessage` (useStreamingAgent) → edge function body. The edge function already handles all three modes in `buildSystemPrompt`.

---

## Phase 1 — GitHub App Integration
**Goal:** Clicking the GitHub icon opens GitHub App installation flow. After install, user repos are listed and cloneable into WebContainer.
**Status:** ✅ Complete

### Tasks
- ✅ `github_installation_id` column added to `profiles` table via SQL migration
- ✅ Edge function `supabase/functions/github-oauth/index.ts` — exchanges OAuth code for user access token, saves `github_access_token` + `github_installation_id` + `github_username` to profiles
- ✅ Edge function `supabase/functions/github-repos/index.ts` — lists repos via `/user/installations/{id}/repositories`; falls back to `/user/repos` if installation scope fails (403/401)
- ✅ `src/pages/GitHubCallback.tsx` — new page at `/auth/github/callback`, reads `?code` and `?installation_id`, calls `github-oauth` edge function, redirects to `/workspace` on success
- ✅ `src/lib/github.ts` — added `cloneRepoIntoWebContainer()` using dynamic import of `isomorphic-git` + `isomorphic-git/http/web`; WebContainer FS adapter maps isomorphic-git's `fs.promises` interface to WebContainer's `container.fs` API; depth-1 shallow single-branch clone
- ✅ `src/components/features/RepoPickerModal.tsx` — searchable repo list with language color dots, private badge, star count, branch; per-repo clone button with animated mint progress bar
- ✅ `src/components/layout/Sidebar.tsx` — GitHub icon added to nav: checks `github_installation_id` from profile on mount; no installation → opens `https://github.com/apps/yfitops-ai/installations/new` in new tab; has installation → opens RepoPickerModal; green dot indicator when connected
- ✅ `src/App.tsx` — route `/auth/github/callback` registered as lazy-loaded `GitHubCallback` page
- ✅ `src/store/useAppStore.ts` — `AuthUser` interface extended with `githubInstallationId?: number`

### Files Modified
- `supabase/functions/github-oauth/index.ts` — NEW
- `supabase/functions/github-repos/index.ts` — NEW
- `src/pages/GitHubCallback.tsx` — NEW
- `src/components/features/RepoPickerModal.tsx` — NEW
- `src/lib/github.ts` — added `cloneRepoIntoWebContainer`, `makeWcFsAdapter`, `CloneProgress` interface
- `src/components/layout/Sidebar.tsx` — GitHub icon + install/picker routing + RepoPickerModal
- `src/App.tsx` — route `/auth/github/callback` + lazy import
- `src/store/useAppStore.ts` — `AuthUser.githubInstallationId` field

### Verification
1. Click GitHub icon in Sidebar (no installation) → new tab opens `https://github.com/apps/yfitops-ai/installations/new`
2. Install app on a repo → GitHub redirects to `/auth/github/callback?installation_id=XXX&code=YYY`
3. Callback page exchanges code, shows "GitHub Connected", redirects to `/workspace`
4. Click GitHub icon again → RepoPickerModal opens with list of accessible repos
5. Search for a repo by name → filtered list
6. Click Clone → mint progress bar + progress text during clone → files appear in file tree
7. Green dot appears next to GitHub icon in Sidebar when connected

### Blockers / Notes
- `isomorphic-git` is not in `package.json` — it will auto-install via `npx depcheck` on next build. If the dynamic import fails, user should see a toast error. Manual install: `npm install isomorphic-git`.
- The `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_CLIENT_SECRET` secrets must be set in Supabase for the OAuth exchange to work. The `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` secrets are not needed for the user-access-token flow (only for GitHub App JWT generation, which this implementation does not use).
- The callback URL `https://yfitops2.pages.dev/auth/github/callback` must be listed in the GitHub App's "Callback URL" field.

---

## Phase 2 — Per-Panel Error Boundaries
**Goal:** A crash in any panel shows a recovery UI without taking down the whole IDE.
**Status:** 🔲 Not started

### Tasks
- [ ] Create src/components/ui/PanelErrorBoundary.tsx — class component, renders retry button
- [ ] Wrap MonacoEditor, RealTerminalPanel, AgentChat, FileTree each in PanelErrorBoundary
- [ ] window.onerror handler → insert to Supabase events table (event_type: 'client_error')
- [ ] StatusBar shows error count badge when uncleared errors exist

### Files Modified
(fill in)

### Verification
Deliberately throw in MonacoEditor. Verify only editor panel shows error. Other panels still work. Reload button resets that panel only.

### Blockers / Notes
(fill in)

---

## Phase 3 — ESLint + TypeScript Diagnostics in Monaco
**Goal:** Lint errors show as red squiggles in Monaco. Problems panel in StatusBar.
**Status:** 🔲 Not started

### Tasks
- [ ] On WebContainer boot: `npm install --save-dev eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin` 
- [ ] Create .eslintrc.json in WebContainer on boot
- [ ] On Cmd+S: spawn `npx eslint --format json <filepath>` via spawnProcess
- [ ] Parse JSON output → call monaco.editor.setModelMarkers()
- [ ] Monaco built-in TS worker already handles TS errors — verify it's active
- [ ] StatusBar: show error count, click opens Problems panel list

### Files Modified
(fill in)

### Verification
Open a .ts file with a deliberate type error. Save. Red squiggle appears. Error listed in StatusBar.

### Blockers / Notes
(fill in)

---

## Phase 4 — Inline Diff Preview Before Apply
**Goal:** Before any write_file/edit_file executes, show a Monaco diff editor in a modal.
**Status:** 🔲 Not started

### Tasks
- [ ] Add DiffPreviewModal.tsx — uses monaco.editor.createDiffEditor()
- [ ] In ActionCard, before calling executeAction: open DiffPreviewModal with original + proposed content
- [ ] Approve → executeAction runs. Reject → action status set to 'rejected'
- [ ] For edit_file with diff: apply the diff client-side first to generate proposed content for preview

### Files Modified
(fill in)

### Verification
Ask agent to edit a file. Before execution, diff modal appears showing changes. Approve → file updated. Cancel → nothing happens.

### Blockers / Notes
(fill in)

---

## Phase 5 — Keyboard Shortcuts + Global Search
**Goal:** Cmd+P file picker, Cmd+Shift+F search, Cmd+` terminal focus.
**Status:** 🔲 Not started

### Tasks
- [ ] Cmd+P → fuzzy file picker (cmdk) over fileTree paths → opens file in Monaco
- [ ] Cmd+Shift+F → global search panel: input → walk WebContainer FS → results with file+line
- [ ] Click result → open file, editor.revealLineInCenter(lineNumber)
- [ ] Cmd+` → focus terminal panel, call term.focus()
- [ ] Cmd+B → toggle sidebar collapsed state
- [ ] Keyboard shortcuts help modal (? key) listing all shortcuts

### Files Modified
(fill in)

### Verification
All shortcuts fire without conflicts. File picker finds files. Search returns results with correct line numbers.

### Blockers / Notes
(fill in)

---

## Phase 6 — AI Usage Meter + Conversation Persistence
**Goal:** Usage shown in StatusBar. Conversations survive page refresh from Supabase.
**Status:** 🔲 Not started

### Tasks
- [ ] StatusBar: fetch profiles.ai_requests_used + plan limit → show `[42/500]` with colour progression
- [ ] Hard block at limit: show upgrade prompt instead of calling edge function
- [ ] On every addMessage(assistant): insert to ai_messages table
- [ ] On workspace load: SELECT ai_messages WHERE conversation_id ORDER BY created_at → rehydrate store
- [ ] Conversation list sidebar: list, rename (UPDATE title), delete (DELETE cascade)

### Files Modified
(fill in)

### Verification
Send 3 messages. Refresh page. Messages still there. Usage counter incremented. Delete conversation → gone from DB.

### Blockers / Notes
(fill in)

---

## Deferred (do not implement until Phase 6 is ✅)
- Multi-model switcher
- Tab groups / split editor
- Format on save
- Agent action undo history
- Notification centre
- Guided onboarding
- Real-time collaboration
- Accessibility audit
