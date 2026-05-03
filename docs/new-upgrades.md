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
**Status:** 🔲 Not started

### Tasks
- [ ] Suspense import fix (Build 1 white-screen) — add `import React, { Suspense } from 'react'` to App.tsx or wherever Suspense is used without import
- [ ] Build 2 UUID format fix — verify crypto.randomUUID() is used everywhere, no manual IDs
- [ ] Build 2 model ID fix — confirm edge function uses `google/gemini-2.5-flash-preview` not `gemini-2.5-flash`
- [ ] SSE streaming edge function deployed and useStreamingAgent wired in AgentChat
- [ ] File tree right-click context menu (new/rename/delete) renders and executes
- [ ] Monaco view-state (scroll + cursor) restores on tab switch

### Files Modified
(fill in)

### Verification
Run the site. Open a file, switch tabs, verify scroll position returns. Send an agent message, verify tokens stream in. Right-click a file, verify menu appears.

### Blockers / Notes
(fill in)

---

## Phase 1 — GitHub App Integration
**Goal:** Clicking the GitHub icon opens GitHub App installation flow. After install, user repos are listed and cloneable into WebContainer.
**Status:** 🔲 Not started

### Tasks
- [ ] Create GitHub App named `yfitops-ai` at https://github.com/settings/apps/new
- [ ] Store App ID, private key, client ID, client secret in Supabase secrets
- [ ] Create edge function: `github-oauth` — handles OAuth callback, exchanges code for token, saves to profiles.github_access_token
- [ ] Update Sidebar GitHub icon click → opens `https://github.com/apps/yfitops-ai/installations/new`
- [ ] After OAuth redirect back, call GitHub REST `/installation/repositories` to list repos
- [ ] Display repo picker modal (search + select)
- [ ] isomorphic-git clone selected repo into WebContainer `/workspace/<repo-name>/`
- [ ] After clone: call buildFileTree('/'), update Zustand, open workspace

### Files Modified
(fill in)

### Verification
Click GitHub icon → redirected to GitHub App install page → install on a repo → redirected back → repo appears in picker → select it → files appear in file tree.

### Blockers / Notes
(fill in)

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
