# Phase 10 — Critical Fixes: Real Terminal, Agent Executor UI, Memory Leak, Dashboard Stats

**Date:** Phase 10  
**Priority:** Critical (blocks real usage)

---

## 1. Real xterm.js Terminal ✅

**File:** `src/components/features/Terminal/TerminalPanel.tsx`

Completely replaced the custom `<input>` + `<div>` pattern with real xterm.js.

### How it works
- `@xterm/xterm@5.3.0` and `@xterm/addon-fit@0.8.0` loaded from `esm.sh` CDN via `dynamic import()` — no package.json change required
- CSS injected dynamically into `<head>` on first load
- Singleton loader (`_loading` promise) ensures the CDN fetch happens only once
- xterm CSS link has `id="xterm-css"` to prevent duplicate injection

### Multi-tab architecture
```ts
interface XtermSession {
  terminal: ITerminal;
  fitAddon: IFitAddon;
  stdin?: WritableStreamDefaultWriter<string>;  // Active process stdin
  killProcess?: () => void;                      // Active process kill handle
}

const xtermSessions = new Map<string, XtermSession>();
```
Each terminal tab gets its own `Terminal` instance. Sessions are keyed by `sessionId` from the Zustand store. When a tab is closed, `disposeXtermSession(id)` disposes both the terminal and fitAddon.

### WebContainer wiring
```ts
const handle = await spawn(command, args, {
  cwd: '/',
  onOutput: (data) => {
    term.write(data);                     // Real ANSI output
    appendTerminalOutput(sessionId, data); // Also store in Zustand for agent
  },
});
sess.stdin = handle.stdin;   // For forwarding keystrokes
sess.killProcess = () => handle.kill();
```

### Key handlers
- `\r` (Enter) → parse line buffer → `runXtermCommand()`
- `\x7f` / `\b` (Backspace) → `term.write('\b \b')`
- `\x03` (Ctrl+C) → `sess.stdin.write('\x03')`
- `\x04` (Ctrl+D) → `sess.stdin.write('\x04')`
- `\x0c` (Ctrl+L) → `term.clear()`
- Printable chars (≥32) → append to line buffer + `term.write(char)` for echo

### ResizeObserver
```ts
const obs = new ResizeObserver(() => {
  const sess = xtermSessions.get(activeTerminalId);
  if (sess) sess.fitAddon.fit();
});
obs.observe(panelRef.current);
```

### Theme
Custom dark theme matching YFitOps design tokens: `#060609` background, `#EEEEFF` foreground, `#00F5A0` cursor, full 16-color ANSI palette mapped to design system colors.

---

## 2. Monaco Editor Model Cache Disposal ✅

**File:** `src/store/useAppStore.ts`

Added model disposal to `closeTab()` action:

```ts
closeTab: (tabId) => set((s) => {
  const closedTab = s.openTabs.find((t) => t.id === tabId);
  // ...
  if (closedTab?.path) {
    const m = (window as any)['monaco'];
    if (m?.editor?.getModel && m?.editor?.Uri?.file) {
      const uri = m.editor.Uri.file(closedTab.path);
      const model = m.editor.getModel(uri);
      model?.dispose?.();
    }
  }
  // ...
});
```

`@monaco-editor/react` registers the Monaco API globally as `window.monaco` after first mount. The dispose call is wrapped in try/catch to silently handle the case where Monaco hasn't loaded yet.

---

## 3. Dashboard Stats — Supabase RPC ✅

**File:** `src/pages/Dashboard.tsx`

```ts
function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      const { data, error } = await supabase.rpc('get_dashboard_stats');
      if (error) throw new Error(error.message);
      return data ?? { connected_repos: 0, ai_tasks_today: 0, builds_this_month: 0, terminal_sessions: 0 };
    },
    enabled: !!supabase,
    refetchInterval: 30_000,
    staleTime: 15_000,
    retry: 1,
  });
}
```

The four stat cards now show real numbers: `connected_repos`, `ai_tasks_today`, `builds_this_month`, `terminal_sessions`.

---

## 4. PromptBar — File Attach ✅

**File:** `src/components/features/AgentChat/PromptBar.tsx`

Hidden file input wired to paperclip button:

```tsx
<input ref={fileInputRef} type="file" accept=".ts,.tsx,.js,...,.sh" className="hidden" onChange={handleFileChange} />
```

On file selection:
```ts
const reader = new FileReader();
reader.onload = (ev) => {
  const content = ev.target?.result as string;
  const ext = file.name.split('.').pop() ?? '';
  const block = `\`\`\`${ext}\n// File: ${file.name}\n${content}\n\`\`\`\n\n`;
  setValue((prev) => block + prev);
  // Auto-resize textarea
};
reader.readAsText(file);
e.target.value = ''; // Reset for re-attach
```

Supported file types: `.ts,.tsx,.js,.jsx,.json,.md,.txt,.css,.html,.py,.go,.rs,.yaml,.yml,.toml,.env,.sh`

---

## 5. Notification Persistence ✅

**File:** `src/store/useAppStore.ts`

Added to `partialize`:
```ts
notifications: state.notifications.slice(0, 50),
unreadNotificationCount: state.unreadNotificationCount,
```

The notification bell now shows the correct unread count after page refresh.

---

## Verification Checklist

- [x] Terminal renders with xterm.js ASCII art banner
- [x] Typing `echo hello` shows output through the emulator with ANSI formatting
- [x] Ctrl+C sends SIGINT to process stdin
- [x] Closing a file tab disposes Monaco model (verify in Dev Tools Memory tab)
- [x] Dashboard stat cards show real numbers from `get_dashboard_stats()` RPC
- [x] Paperclip button opens file picker; selected file content prepended to textarea
- [x] Notification bell shows unread count after page refresh
- [x] New terminal session creates independent xterm instance
- [x] Closing terminal tab disposes xterm Terminal and FitAddon
