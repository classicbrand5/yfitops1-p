# YFitOps AI Agent — Humanoid Project Documentation
# The Complete Technical & Design Reference

> **Living document** — updated every phase.  
> Last updated: **Phase 14-15** (ConfirmModal data-loss gate, Monaco ViewState, action CSS tokens, Expert steps panel, File heatmap, WorkspaceErrorBoundary, ConversationSync, StatusBar upgrades, AgentContextPanel, Workspace Snapshots, fetch-repo-zip edge function)

---

## 1. Project Identity

**Product:** YFitOps AI Agent  
**Purpose:** A production-grade browser IDE where an AI agent reads codebases, writes real code, runs real terminal commands, and pushes PRs — all in a single unified browser interface. Zero mocks. Every file operation hits a real sandboxed filesystem. Every terminal command executes in a real bash process.  
**Target users:** Senior engineers, tech leads, engineering managers who need an AI that can actually code rather than just suggest.  
**Target emotions:** Focused, confident, powerful — like a seasoned pair programmer who never sleeps.  
**Tagline:** *"Your autonomous engineering brain — code, run, ship, repeat."*

---

## 2. Technology Stack

### Frontend
| Technology | Version | Role |
|---|---|---|
| React | 18.3.1 | UI framework |
| TypeScript | 5.5.3 (strict) | Language |
| Vite | 5.4.1 | Build tool, dev server |
| Tailwind CSS | 3.4.11 | Utility styling |
| shadcn/ui | Latest | Component primitives |
| Zustand | 5.x | Global state management |
| @tanstack/react-query | 5.x | Server state, data fetching |
| react-hook-form + zod | Latest | Form validation |
| react-router-dom | 6.x | Client-side routing |
| recharts | Latest | Analytics charts |
| cmdk | Latest | Command palette fuzzy search |
| lucide-react | Latest | Icon library |

### Editor
| Technology | Role |
|---|---|
| @monaco-editor/react | Monaco Editor React wrapper |
| monaco-editor (bundled) | Core code editor (VS Code engine) |
| Custom theme: `yfitops-dark` | Electric mint + deep violet theme |
| Monaco.Uri.file() cache | One ITextModel per file path (undo history preserved) |
| Model disposal on tab close | Memory leak prevention |

### Terminal
| Technology | Role |
|---|---|
| @xterm/xterm 5.3.0 | Terminal emulator (loaded via esm.sh CDN) |
| @xterm/addon-fit 0.8.0 | Responsive terminal resize (loaded via esm.sh CDN) |
| ResizeObserver | Triggers fitAddon.fit() on container resize |
| WebContainer process streams | stdin/stdout wired to xterm data handlers |

### Backend
| Technology | Role |
|---|---|
| Supabase | Auth, PostgreSQL, Realtime, Edge Functions |
| @supabase/supabase-js | Client SDK |
| Supabase Edge Functions (Deno) | AI proxy, analytics events |
| Supabase Realtime | Live event/build subscriptions |

### AI
| Technology | Role |
|---|---|
| OnSpace AI | Default provider (no key config needed) |
| Google AI Studio | gemini-2.5-flash-preview, 1M context, free |
| Groq Cloud | llama-3.3-70b-versatile, 600+ tok/s, free |
| OpenRouter | deepseek-r1:free + 200+ models, free tier |
| Cloudflare AI | llama-3.3-70b-instruct-fp8, 10k neurons/day free |
| Cerebras | llama-3.3-70b, 2000+ tok/s, free |
| Together AI | Qwen2.5-Coder-32B, $1 credit, best for code |
| Supabase Edge Function: agent-inference v3 | Multi-provider router, rate limiting, SSE streaming |
| AgentModelPicker component | In-chat provider/model switcher dropdown |

### Deployment
| Technology | Role |
|---|---|
| GitHub Actions | CI/CD pipeline |
| Cloudflare Pages | Hosting, CDN, HTTP headers |
| public/_headers | COOP/COEP headers for SharedArrayBuffer |
| .github/workflows/deploy.yml | Auto-deploy on push to main |

---

## 3. Design System

### 3.1 Physical Metaphor
**Terminal / Glass** — Dark void base with frosted glass panels, electric mint primary accent, deep violet secondary. Material: matte dark backgrounds with subtle glassmorphism overlays. Depth: layered shadows, backdrop blur, glowing borders.

### 3.2 Color Tokens
```css
/* Backgrounds — void → base → surface → elevated → overlay */
--bg-void:    #060609;   /* deepest black, terminal bg */
--bg-base:    #0C0C12;   /* page background */
--bg-surface: #111118;   /* cards, panels */
--bg-elevated:#16161F;   /* dropdowns, menus */
--bg-overlay: #1C1C27;   /* hover states */
--bg-input:   #13131C;   /* form inputs */

/* Primary accent — Electric Mint */
--accent-400: #00F5A0;   /* Primary CTA, cursor, active */
--accent-500: #00D488;   /* Hover states */
--accent-glow: rgba(0,245,160,0.18);

/* Secondary accent — Deep Violet */
--violet-400: #9B6EF5;   /* AI features, magic actions */
--violet-500: #7C3AED;   /* Buttons, badges */

/* Semantic */
--success: #00F5A0;       /* Same as accent — "green is mint" */
--warning: #FBBF24;       /* Amber */
--danger:  #FF4D6D;       /* Coral red */
--info:    #38BDF8;       /* Sky blue */

/* Text hierarchy */
--text-primary:   #EEEEFF;  /* Headlines, labels */
--text-secondary: #9494B8;  /* Body text */
--text-muted:     #5C5C7A;  /* Placeholders, hints */
--text-disabled:  #3A3A52;  /* Disabled states */
--text-inverse:   #060609;  /* Text on mint buttons */
```

### 3.3 Typography
| Role | Font | Weight | Size |
|---|---|---|---|
| Display / headings | Space Grotesk | 600–700 | 14–72px |
| Body / labels / UI | Inter | 400–600 | 12–16px |
| Code / terminal | JetBrains Mono | 400 | 12–14px |

All three fonts loaded from Google Fonts via `index.html` with `display=swap`.

### 3.4 Spacing System
8px base grid. Common steps: 4, 8, 12, 16, 24, 32, 48, 64px. Tailwind's default scale used throughout.

### 3.5 Animations
All defined as CSS `@keyframes` in `src/index.css`:
- `fade-up` — new content (agent messages, activity feed items)
- `fade-in` — overlays, modals
- `slide-in-right` — drawers (build log)
- `pulse-glow` — running builds, active WebContainer
- `thinking-bounce` — AI thinking indicator dots
- `shimmer` — skeleton loaders
- `terminal-cursor` — blinking cursor
- `scan-line` — CRT effect on AppShell background
- `float`, `marquee`, `drift-1/2` — Landing page decorative

### 3.6 Component Classes
Key utility classes defined in `@layer components` in `src/index.css`:
- `.glass` — glassmorphism panel
- `.glass-hover` — hover transition for glass panels
- `.panel` — standard surface card
- `.btn-accent` — primary CTA (mint)
- `.btn-ghost` — secondary CTA (bordered)
- `.btn-violet` — AI action button (violet)
- `.code-block` — terminal/code display area
- `.badge-accent/violet/warning/danger/muted` — status labels
- `.tab-item` — editor/terminal tab
- `.input-dark` — styled form input
- `.status-dot-green/red/yellow/grey` — presence indicators

---

## 4. Architecture

### 4.1 File Structure
```
src/
├── App.tsx                          # Routes: BrowserRouter + all pages
├── main.tsx                         # React root, QueryClient, Sonner
├── index.css                        # Design system: tokens, components, animations
├── assets/
│   └── hero-ide.jpg                 # Landing page hero image
├── components/
│   ├── features/
│   │   ├── AgentChat/
│   │   │   ├── AgentChat.tsx        # Chat UI shell, conversation management
│   │   │   ├── AgentMessage.tsx     # Individual message + ActionCard execution
│   │   │   ├── ActionCard.tsx       # Execute/Skip buttons + result display
│   │   │   ├── AgentThinking.tsx    # 3-dot thinking animation
│   │   │   ├── DiffPreview.tsx      # Unified diff renderer (add/remove coloring)
│   │   │   └── PromptBar.tsx        # Input textarea + context toggles + file attach
│   │   ├── CommandPalette/
│   │   │   └── CommandPalette.tsx   # cmdk-based fuzzy search (22 commands, 7 groups)
│   │   ├── Editor/
│   │   │   ├── CodeEditor.tsx       # Monaco Editor via @monaco-editor/react
│   │   │   └── EditorTabs.tsx       # File tab bar with dirty indicators
│   │   ├── FileExplorer/
│   │   │   ├── FileExplorer.tsx     # Real FS tree from WebContainer
│   │   │   └── FileTreeNode.tsx     # Recursive tree node component
│   │   └── Terminal/
│   │       └── TerminalPanel.tsx    # Real xterm.js (loaded via esm.sh CDN)
│   └── layout/
│       ├── AppShell.tsx             # Root layout, mesh background, CRT effect
│       ├── Sidebar.tsx              # Icon rail, navigation, collapsible
│       ├── SplitLayout.tsx          # Drag-resize divider (horizontal/vertical)
│       ├── StatusBar.tsx            # Branch, errors, cursor position, clock
│       └── TopBar.tsx               # Breadcrumb, search, notifications bell
├── core/
│   ├── agent/
│   │   ├── agentExecutor.ts         # Action execution engine (real FS + process)
│   │   └── agentTypes.ts            # AgentAction, AgentResponse, ActionResult types
│   └── webcontainer/
│       ├── webcontainer.ts          # Singleton boot, getWebContainer(), isReady()
│       ├── fs.ts                    # readFile, writeFile, unlink, mkdir, buildFileTree
│       ├── process.ts               # spawn() with dangerous command gate
│       └── types.ts                 # ProcessHandle interface
├── hooks/
│   ├── useAIAgent.ts               # Agent invocation, 401 handling, session refresh
│   ├── useAuth.ts                  # OTP+Password auth, onAuthStateChange
│   ├── useFileSystem.ts            # FS helpers: refreshTree, saveFile, createFile
│   ├── useKeyboardShortcuts.ts     # Cmd+K, Alt+layout, Ctrl+` shortcuts
│   ├── useOtpCooldown.ts           # Per-email sessionStorage rate-limit gate
│   ├── useRealtimeBuilds.ts        # Supabase Realtime on builds table
│   ├── useRealtimeEvents.ts        # Supabase Realtime on events table
│   ├── useTerminal.ts              # Terminal session management hook
│   └── useWebContainer.ts          # Boot orchestration, seed files, progress
├── lib/
│   ├── errors.ts                   # YFitOpsError hierarchy (typed error classes)
│   └── supabase.ts                 # Supabase client, auth helpers, invokeFunction
├── pages/
│   ├── Analytics.tsx               # Engineering metrics (placeholder → Phase 12)
│   ├── Auth.tsx                    # OTP+Password login/signup
│   ├── Billing.tsx                 # Stripe billing (placeholder → Phase 14)
│   ├── BuildMonitor.tsx            # Real-time build table (Supabase Realtime)
│   ├── Dashboard.tsx               # Live activity feed + RPC stats + quick actions
│   ├── Index.tsx                   # Redirect to /workspace or /landing
│   ├── Landing.tsx                 # Marketing landing page
│   ├── NotFound.tsx                # 404 page
│   ├── Settings.tsx                # Profile, AI Agent, Editor settings
│   └── WorkspacePage.tsx           # IDE shell: BootOverlay + layout modes
├── store/
│   └── useAppStore.ts              # Single Zustand store (80+ actions, persisted)
└── types/
    ├── agent.types.ts              # AgentAction, AgentResponse, ConversationMessage
    └── dev.types.ts                # FileNode, EditorTab, TerminalSession, etc.
```

### 4.2 Routing (App.tsx)
```
/           → Index (redirect)
/landing    → Landing page
/workspace  → WorkspacePage (protected)
/dashboard  → Dashboard
/builds     → BuildMonitor
/analytics  → Analytics
/settings   → Settings
/billing    → Billing
/auth       → Auth (OTP login/signup)
*           → NotFound
```

### 4.3 State Management (useAppStore.ts)
Single Zustand store with `subscribeWithSelector` + `persist` middleware. No immer (eliminated in Phase 4 due to missing peer dep). All mutations use plain `set` with spread operators.

**Persisted state** (survives page refresh):
- layoutMode, splitRatio, sidebarCollapsed, sidebarWidth, rightPanelWidth
- theme, expertMode, agentAutonomy, agentContext
- expandedFolders, activeConversationId
- notifications, unreadNotificationCount (Phase 10+)

**Ephemeral state** (lost on refresh):
- user (re-hydrated from Supabase session)
- fileTree, openTabs, terminalSessions, processes
- messages, isThinking, streamingMessageId, pendingActions

---

## 5. Backend

### 5.1 Supabase Project
- **Project ID:** bwiudgrsglnmseggcind
- **Status:** ACTIVE_HEALTHY
- **Backend URL:** https://bwiudgrsglnmseggcind.supabase.co

### 5.2 Database Tables
| Table | Purpose | RLS |
|---|---|---|
| profiles | User profile, GitHub token, plan, AI usage | ✅ Users own row |
| connected_repos | GitHub repos connected to workspace | ✅ Users own rows |
| builds | CI/CD build records | ✅ Via connected_repos |
| events | Analytics events (ai_request, build_*, etc.) | ✅ Users own rows |
| ai_conversations | Agent conversation metadata | ✅ Users own rows |
| ai_messages | Agent messages per conversation | ✅ Via ai_conversations |
| terminal_sessions | Terminal usage tracking | ✅ Users own rows |

### 5.3 Edge Functions
| Function | Purpose |
|---|---|
| agent-inference | Auth-protected AI proxy → OnSpace AI → structured JSON response |

### 5.4 Supabase RPC Functions
| Function | Called From | Purpose |
|---|---|---|
| get_dashboard_stats() | Dashboard.tsx | Returns connected_repos, ai_tasks_today, builds_this_month, terminal_sessions |
| get_ai_usage() | (Reserved) | AI request count and limits |
| get_build_success_rate() | (Reserved) | Build pass/fail ratio |
| increment_message_count() | Trigger | Auto-increments conversation message_count |

### 5.5 Realtime Subscriptions
| Hook | Table | Events | Filter |
|---|---|---|---|
| useRealtimeEvents | events | INSERT | user_id = current user |
| useRealtimeBuilds | builds | INSERT + UPDATE | repo_id in user's repos |

### 5.6 Environment Variables
| Variable | Location | Purpose |
|---|---|---|
| VITE_SUPABASE_URL | .env / Cloudflare Pages | Supabase project URL |
| VITE_SUPABASE_ANON_KEY | .env / Cloudflare Pages | Supabase anon key |
| ONSPACE_AI_API_KEY | Supabase secrets | OnSpace AI API key |
| ONSPACE_AI_BASE_URL | Supabase secrets | OnSpace AI base URL |

### 5.3 New Edge Functions (Phase 14-15)
| Function | Purpose |
|---|---|
| `create-checkout` | Stripe subscription checkout session |
| `stripe-webhook` | Stripe event handler (plan updates) |
| `fetch-repo-zip` | Proxies GitHub repo zip download (bypasses CORS) |

### 5.4 New Hooks (Phase 14-15)
| Hook | Purpose |
|---|---|
| `useConversationSync` | Debounced 2s upsert of conversations + messages to Supabase |

### 5.5 New Utilities (Phase 14-15)
| File | Purpose |
|---|---|
| `src/core/webcontainer/snapshots.ts` | Capture/restore full filesystem snapshots, localStorage FIFO 5-max |


### 6.0 GitHub Integration (`src/lib/github.ts`)

**No external dependencies** — uses raw `fetch` with GitHub REST API v3.

| Function | Endpoint | Purpose |
|---|---|---|
| `getGitHubToken()` | Supabase profiles | Reads stored PAT |
| `saveGitHubToken(token)` | `/user` + profiles | Validates + persists token + username |
| `listUserRepos(token?)` | `/user/repos` | Lists up to 100 repos sorted by updated |
| `connectReposToSupabase(repos)` | `connected_repos` upsert | Saves selected repos |
| `createPullRequest(...)` | `/repos/:owner/:repo/pulls` | Opens a PR |

**Settings flow:** Paste PAT → validate against `/user` → save to `profiles.github_access_token` + `github_username` → list repos with checkboxes → upsert selected to `connected_repos`.

### 6.01 Stripe Billing

**Edge Functions:**
- `supabase/functions/create-checkout/index.ts` — Creates/reuses Stripe customer, creates Checkout Session (subscription mode), returns `{ url }`
- `supabase/functions/stripe-webhook/index.ts` — Verifies Stripe signature (native HMAC-SHA256), handles `checkout.session.completed` + `customer.subscription.deleted`

**Required secrets:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**Plan tiers:** Starter (free / 500 AI req), Pro ($49/mo / 5000 req), Team ($199/mo / unlimited)

### 6.1 AI Agent
**Flow:**
1. User types message in PromptBar → presses Enter or clicks Send
2. `useAIAgent.sendMessage()` checks: user authenticated? Supabase configured? Session valid?
3. If not authenticated → toast + redirect to /auth
4. If session expired → try `supabase.auth.refreshSession()` → then invoke
5. `supabase.functions.invoke('agent-inference', { body: { messages, conversationId, expertMode, workspaceContext } })`
6. Edge function: verifies JWT → calls OnSpace AI (Gemini 2.5 Flash) → validates JSON schema → logs analytics event → returns structured response
7. `validateAgentResponse()` in client validates schema
8. Actions stored on message with `status: 'pending'`
9. User clicks Execute on ActionCard → `handleApprove()` in AgentMessage → calls `executeActions()`

**Action types supported:**
- `read_file` — reads from real WebContainer FS
- `write_file` — writes to real FS (auto-creates parent dirs)
- `edit_file` — applies unified diff to existing file, falls back to full content
- `delete_file` — unlinks file from FS
- `create_dir` — creates directory recursively
- `run_command` — spawns real process in WebContainer bash
- `search_files` — (UI only, not yet executed)
- `open_pr` — (UI only, not yet executed)

**Autonomy levels:**
- `ask` — every action requires user approval
- `auto-safe` — auto-approves reads/writes, asks for deletions
- `full-auto` — executes all actions without confirmation

### 6.2 WebContainer
**Boot sequence (useWebContainer.ts):**
1. Import `@webcontainer/api` dynamically
2. `WebContainer.boot({ workdirName: 'yfitops-workspace' })`
3. `mkdir('/src', { recursive: true })` + `mkdir('/public')`
4. Write seed files: `package.json`, `src/index.ts`, `src/App.tsx`, `.env.example`, `README.md`
5. `buildFileTree('/')` → populate Zustand `fileTree`
6. Set `status: 'ready'`, boot overlay disappears
7. WorkspacePage renders full IDE

**SharedArrayBuffer requirement:**
- Requires `Cross-Origin-Opener-Policy: same-origin`
- Requires `Cross-Origin-Embedder-Policy: require-corp`
- Set in `public/_headers` (Cloudflare Pages) and `vite.config.ts` (dev server)

### 6.3 Monaco Editor
- Wrapper: `@monaco-editor/react` (handles worker configuration)
- Theme: `yfitops-dark` — registered in `beforeMount` callback
- Model cache: `Monaco.Uri.file(path)` — one `ITextModel` per file path
- Model disposal: on `closeTab()` in Zustand store, checks `window.monaco` and calls `model.dispose()`
- Auto-save: debounced 800ms on content change
- Ctrl+S: immediate save

### 6.4 xterm.js Terminal
- Library: `@xterm/xterm@5.3.0` loaded from `esm.sh` CDN (dynamic import)
- Addon: `@xterm/addon-fit@0.8.0` from esm.sh
- CSS: injected dynamically into `<head>` on first load
- Per-tab xterm instances stored in `xtermSessions: Map<sessionId, XtermSession>`
- stdin forwarded to WebContainer process writer
- Ctrl+C → `\x03` to stdin
- Ctrl+D → `\x04` to stdin
- Ctrl+L → `terminal.clear()`
- Multi-tab: each tab has independent Terminal instance, dispose on tab close
- ResizeObserver triggers `fitAddon.fit()` on container size changes
- Welcome banner: ASCII art with ANSI colors on first open

### 6.5 Command Palette
- Library: `cmdk`
- Trigger: `Cmd+K` (Mac) / `Ctrl+K` (Windows/Linux)
- 22 commands in 7 semantic groups:
  - **Layout** — Split Horizontal, Split Vertical, Editor Only, Terminal Only, Chat Only, Full IDE
  - **Navigation** — Dashboard, Build Monitor, Analytics, Settings, Billing
  - **Agent** — New Conversation, Toggle Expert Mode, Clear Chat
  - **Terminal** — New Session
  - **Appearance** — Toggle Theme, Toggle Sidebar
  - **System** — Keyboard Shortcuts, Sign Out, Refresh File Tree
- Fuzzy search via cmdk, keyboard shortcut badges, footer hint bar
- Z-index 50, 600px container, glassmorphism border, backdrop blur

### 6.6 Dashboard
- **Stat cards** (4): Connected Repos, AI Tasks Today, Builds This Month, Terminal Sessions
  - Data source: `get_dashboard_stats()` Supabase RPC, refetched every 30 seconds
  - Sparkline AreaChart (Recharts) generated from stat value
  - Skeleton shimmer while loading
- **Activity feed**: Supabase Realtime subscription on `events` table
  - Initial load: last 50 events via react-query
  - New events prepended with `fade-up` animation
  - Event icons mapped to `event_type` (build_success, ai_request, repo_connected, etc.)
  - Relative timestamps (inline implementation, no date-fns)
- **Quick actions**: 6 action buttons (Generate Code, Analyse Repo, Write Docs, Open PR, View Insights, Open Chat)

### 6.7 Build Monitor
- Real-time build table via `useRealtimeBuilds` Supabase Realtime
- INSERT: prepend with highlight flash animation
- UPDATE: find row by id, update status inline
- Status badges: Running (pulse), Passed (green), Failed (red), Queued (amber), Cancelled (grey)
- Filter bar: all / running / success / failed / queued (client-side)
- Log drawer: slides in from right, shows build meta + log_url or "No logs available" message
- Empty state: "No builds yet. Push to a connected repository to trigger a build."

### 6.8 Auth (OTP + Password)
**Registration:**
1. Enter email → `sendOtp(email)` → Supabase sends OTP code
2. Enter OTP + name + password → `verifyOtpAndSetPassword()` → updates user metadata
3. `handle_new_user` trigger creates `profiles` row automatically

**Login:**
1. Enter email + password → `signInWithPassword()` → Supabase JWT
2. `onAuthStateChange` fires → `mapSupabaseUser()` → Zustand `setUser()`

**OTP Hardening:**
- `useOtpCooldown.ts` — per-email cooldown in sessionStorage, extends on 429
- useRef in-flight lock prevents double-click race
- 429 classifier extends cooldown by `retryAfterSeconds` from backend

**401 Fix (Phase 9):**
- Pre-invoke: check `user` exists in Zustand
- Pre-invoke: `supabase.auth.getSession()` → if no session, `refreshSession()`
- Error routing: 401 → sign-in toast, 502/503 → unavailable, 429 → rate limited

---

## 7. Layout Modes

Selectable from command palette or keyboard shortcuts (Alt+1 through Alt+6):

| Mode | Key | Description |
|---|---|---|
| `split-horizontal` | Default | File Explorer + Editor + Terminal + Chat |
| `editor-only` | Alt+1 | File Explorer + Editor only |
| `terminal-only` | Alt+2 | Full-screen terminal |
| `chat-only` | Alt+3 | Full-screen AI chat |
| `split-vertical` | Alt+4 | Explorer + Editor (top) + Chat (bottom) |
| `ide-full` | Alt+5 | Explorer + Editor + Terminal + Chat (4-pane) |

SplitLayout component supports drag-resize via mouse/touch divider. `rightPanelWidth` and `sidebarWidth` persisted in Zustand.

---

## 8. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Cmd/Ctrl+K | Open command palette |
| Ctrl+` | New terminal session |
| Alt+1–6 | Switch layout mode |
| Ctrl+S (in editor) | Save file |
| Ctrl+L (in terminal) | Clear terminal |
| Ctrl+C (in terminal) | SIGINT to process |
| Ctrl+D (in terminal) | EOF to process |
| Esc | Close command palette / drawers |
| Enter (in PromptBar) | Send message |
| Shift+Enter (in PromptBar) | Insert newline |

---

## 9. Plugins & Libraries Reference

| Library | Version | Why chosen |
|---|---|---|
| `@monaco-editor/react` | Latest | Bundles Monaco correctly, handles workers |
| `@xterm/xterm` | 5.3.0 | Industry-standard terminal emulator |
| `@xterm/addon-fit` | 0.8.0 | Responsive xterm resize |
| `@supabase/supabase-js` | 2.x | Supabase official client |
| `@tanstack/react-query` | 5.x | Server state, caching, realtime |
| `cmdk` | Latest | Command palette (built for this pattern) |
| `zustand` | 5.x | Minimal, fast, SSR-compatible state |
| `recharts` | Latest | Composable charts for dashboards |
| `sonner` | Latest | Toast notifications (non-intrusive) |
| `react-hook-form` | Latest | Performant forms |
| `zod` | Latest | Schema validation |
| `react-router-dom` | 6.x | Nested routes, navigation |
| `lucide-react` | Latest | Consistent icon set (outline style) |
| `@webcontainer/api` | Latest | Browser-native FS + process API |

---

## 10. Fonts

| Font | Source | Usage |
|---|---|---|
| Space Grotesk 400/500/600/700 | Google Fonts | Display headings, brand elements, badges |
| Inter 300/400/500/600/700 | Google Fonts | Body text, labels, UI chrome |
| JetBrains Mono 300/400/500/600 + italic | Google Fonts | Code, terminal, file paths, commit SHAs |

Loaded in `index.html` via `<link rel="preconnect">` + `<link href="...">` with `display=swap` for FOUT prevention.

---

## 11. Favicon & Icons

**Favicon:** `/public/favicon.svg` — Custom SVG lightning bolt in electric mint (#00F5A0) on transparent background. Declared in `index.html` as `<link rel="icon" type="image/svg+xml" href="/favicon.svg">`.

**Icons throughout app:** `lucide-react` — outline style, rounded corners, consistent 12–24px sizing. Selected icons:
- `Zap` — workspace boot, builds, quick actions
- `Bot` — AI agent, conversations
- `GitBranch` — repositories, branches
- `Terminal` — terminal sessions, run_command actions
- `FilePlus / FileEdit / Trash2` — write/edit/delete file actions
- `FolderPlus` — create_dir action
- `CheckCircle / XCircle` — build success/fail
- `Loader2` — running states (with `animate-spin`)
- `AlertTriangle` — errors, dangerous commands
- `LogIn` — auth required banner

---

## 12. Modals & Overlays

| Component | Type | Trigger |
|---|---|---|
| CommandPalette | Full-screen overlay (z-50) | Cmd+K |
| BuildLogDrawer | Right slide-in drawer | "Logs" button in Build Monitor |
| BootOverlay | Full workspace overlay | WebContainer not ready |
| Auth banner in AgentChat | Inline banner | User not signed in |

---

## 13. Error Handling

### Error Classes (`src/lib/errors.ts`)
```
YFitOpsError (base)
├── WebContainerError     — boot/FS failures
├── FilesystemError       — read/write/unlink
├── AgentExecutionError   — action executor
├── BackendUnavailableError — Supabase not configured
├── AuthError             — auth failures
└── DangerousCommandError — blocked commands
```

### Toast Pattern
All user-facing errors use `sonner` toasts:
- `toast.error(title, { description, action })` — errors with optional action button
- `toast.success(message)` — confirmations
- `toast.warning(message)` — non-blocking warnings

### Console Logging
All `console.log/error` calls use `[ModuleName]` prefix for filtering:
- `[WebContainer]`, `[FS]`, `[agent-inference]`, `[Monaco]`, `[Auth]`

---

## 14. Security

### Command Safety Gate (`src/core/webcontainer/process.ts`)
Blocks patterns via regex before spawn:
- `rm -rf /`, `rm -rf *`, `sudo rm`
- `dd if=`, `mkfs`, `format`
- `shutdown`, `reboot`, `halt`, `poweroff`
- Fork bomb `:(){:|:&};:`
- `chmod -R 777 /`
- `curl | bash`, `wget | bash`

In `'full-auto'` autonomy mode, dangerous commands are still blocked for `rm -rf /` but allowed with warning for others.

### Auth Guards
- `agent-inference` edge function: requires valid JWT → rejects with 401
- `useAIAgent.sendMessage()`: checks `user` from Zustand before invoking
- OTP rate limiting: per-email sessionStorage cooldown
- RLS on all tables: users can only access their own rows

### CORS
Edge function returns CORS headers on all responses including OPTIONS preflight.

---

## 15. Performance

### Bundle Splitting (vite.config.ts)
```js
manualChunks: {
  'monaco-editor': ['@monaco-editor/react'],
  'vendor-ui': ['react', 'react-dom', 'react-router-dom'],
  'vendor-state': ['zustand', '@tanstack/react-query'],
  'vendor-charts': ['recharts'],
  'vendor-supabase': ['@supabase/supabase-js'],
}
```

### xterm Loading
- Dynamic import from esm.sh on first terminal mount
- Singleton loader (loaded once, reused across sessions)
- CSS injected once via `<link>` tag with id check

### React Query
- Stale time: 15s for dashboard stats
- Refetch interval: 30s for dashboard stats
- Query cancellation on unmount

### Monaco
- `optimizeDeps` includes `@monaco-editor/react`
- One model per file path (no recreation on tab switch)
- Model disposal on tab close (prevents memory accumulation)

---

## 16. Phase History

| Phase | What Was Built |
|---|---|
| 1 | Foundation: design system, AppShell, Sidebar, routing, all page shells |
| 2 | Supabase integration: auth, profiles table, OTP+Password flow |
| 3 | WebContainer boot + File Explorer, OTP 429 hardening |
| 4–6 | Monaco Editor, Terminal stub, AgentChat UI (ActionCard, DiffPreview) |
| 7 | Command Palette (cmdk, 22 commands, 7 groups) |
| 8 | Supabase Realtime: Dashboard activity feed, Build Monitor live updates |
| 9 | WebContainer ENOENT fix, agentExecutor wired to UI, 401 auth fix |
| 10 | Real xterm.js terminal, Monaco model disposal, Dashboard RPC stats, PromptBar file attach, notification persistence |
| 11-13 | Agent auto-execute (full-auto/auto-safe), xterm command history, Settings → Supabase, GitHub REST API, Analytics real RPC, Stripe checkout + webhook |
| 14-15 | ConfirmModal gate (data-loss prevention), Monaco ViewState, action CSS tokens, Expert mode steps in AgentMessage, File heatmap in FileTreeNode, enhanced context menu with ConfirmModal delete, WorkspaceErrorBoundary, ConversationSync to Supabase, StatusBar AI counter + WebContainer dot, AgentContextPanel chips, Workspace Snapshot system, fetch-repo-zip edge function, React.lazy import fixes |
| 16 | Multi-provider AI (7 providers: OnSpace, Google, Groq, OpenRouter, Cloudflare, Cerebras, Together), AgentModelPicker dropdown in chat header, provider/model persisted in Zustand, agent-inference v3 with provider routing + SSE streaming + action validation + rate limiting |

---

## 17. Known Gaps & Pending Phases

See `docs/review.md` for full gap analysis. Key remaining items:

| Item | Priority | Notes |
|---|---|---|
| Analytics: Top changed files tracking | 🟡 Medium | Requires agent FS action events to be logged |
| diff npm package for `edit_file` | 🟡 Medium | Custom parser works but edge cases exist |
| Stripe Customer Portal | 🟢 Low | Add manage subscription link when customer_id exists |
| Monaco command history in palette | 🟢 Low | Recently opened files shortcut |
| OTP cooldown real 429 test | 🟢 Low | Verify against real Supabase rate limits |

---

## 18. Deployment

**CI/CD:** GitHub Actions → `.github/workflows/deploy.yml`  
**Trigger:** Push to `main` branch  
**Build:** `npm install && npm run build` (Vite outputs to `dist/`)  
**Deploy:** Cloudflare Pages  
**Headers:** `public/_headers` copied to `dist/_headers` by Vite — provides COOP/COEP for SharedArrayBuffer  

**Cloudflare Pages settings:**
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Custom domain:** Not yet configured (using `.onspace.app` subdomain)

---

*This document is maintained by the YFitOps AI Agent development process and updated at the end of every phase.*
