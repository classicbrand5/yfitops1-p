# Phase 8 — Supabase Realtime: Live Activity Feed & Build Monitor

## Overview

Phase 8 wires the Dashboard and Build Monitor pages to Supabase Realtime, replacing all static/mock data with live data that updates instantly without any page refresh.

---

## Files Created / Modified

| File | Change |
|------|--------|
| `src/hooks/useRealtimeEvents.ts` | **New** — Supabase Realtime subscription for `events` table |
| `src/hooks/useRealtimeBuilds.ts` | **New** — Supabase Realtime subscription for `builds` table |
| `src/pages/Dashboard.tsx` | **Rewritten** — live activity feed + real RPC stats + sparklines |
| `src/pages/BuildMonitor.tsx` | **Rewritten** — live build table with INSERT/UPDATE animations |
| `index.html` | Updated fonts: Space Grotesk + Inter + JetBrains Mono |
| `src/index.css` | Updated font-family CSS variables to match new fonts |
| `public/favicon.svg` | **New** — SVG favicon (lightning bolt in electric mint) |

---

## Architecture

### `useRealtimeEvents`

```
Initial load (react-query)
  └── supabase.from('events').select('*').eq('user_id', userId).order('created_at', desc).limit(50)
        └── liveEvents state ← initialEvents

Realtime subscription
  └── supabase.channel('dashboard-events-{userId}')
        .on('postgres_changes', { event: 'INSERT', table: 'events', filter: 'user_id=eq.{userId}' }, handler)
              └── prepend to liveEvents, keep max 50
              └── clearTimeout on unmount
```

**Returns:** `{ events: RealtimeEvent[], isLoading: boolean, error: string | null }`

### `useRealtimeBuilds`

```
Initial load (react-query)
  └── supabase.from('connected_repos').select('id, repo_name, repo_owner').eq('user_id', userId)
        └── supabase.from('builds').select('*').in('repo_id', repoIds).order('created_at', desc).limit(100)
              └── liveBuilds state ← initialBuilds (enriched with repo metadata)

Realtime subscription (broad, filtered post-receive)
  └── supabase.channel('build-monitor-{userId}')
        .on('postgres_changes', { event: 'INSERT', table: 'builds' }, async handler)
              └── verify repo ownership via connected_repos query
              └── prepend if owned, flash animation for 1.2s
        .on('postgres_changes', { event: 'UPDATE', table: 'builds' }, handler)
              └── patch existing row by id, flash animation
```

**Returns:** `{ builds: RealtimeBuild[], isLoading: boolean, error: string | null, refetch: () => void }`

---

## Dashboard Page

### Stats Cards
- Calls `get_dashboard_stats()` Supabase RPC (already implemented in DB)
- Refetches every 30 seconds
- Shows sparkline AreaChart per stat (generated from real value, not mock)
- Stats: Connected Repos, AI Tasks Today, Builds This Month, Terminal Sessions

### Activity Feed
- Uses `useRealtimeEvents` hook
- Maps `event_type` → icon + human-readable text + timestamp via `timeAgo()` helper
- Supports: `build_success`, `build_failed`, `build_started`, `ai_request`, `terminal_session`, `repo_connected`, `pr_opened`
- Empty state, error state, skeleton loaders
- Fade-up animation on new events

### Live Indicator
- Shows Wifi/WifiOff icon based on subscription health
- Green "Live" badge when connected, red "Offline" on error

---

## Build Monitor Page

### Build Table
- Real-time rows from `useRealtimeBuilds`
- Columns: Commit SHA (7-char), Status Badge, Repo, Branch, Duration, Trigger, Time, Logs button
- `_flash` prop causes subtle green background for 1.2s on INSERT/UPDATE
- Status-based row background: failed rows get faint red tint

### `BuildStatusBadge` Component
Built inline in `BuildMonitor.tsx`:
| Status | Color | Icon | Animation |
|--------|-------|------|-----------|
| running | accent | Loader2 (spinning) | `animate-pulse-glow` |
| success | success green | Check | — |
| failed | danger red | X | — |
| queued | muted | Clock | — |
| cancelled | muted | RotateCcw | — |

### Build Log Drawer
- Opens on "Logs" button click
- Shows build metadata (status, duration, trigger, commit)
- If `log_url` is set, shows clickable external link
- If no log_url, shows a "no logs available" empty state
- Closes with Escape key or backdrop click
- Slide-in animation from right

---

## Font System

| Purpose | Font | Weights |
|---------|------|---------|
| Display / Headings | Space Grotesk | 400, 500, 600, 700 |
| Body / UI | Inter | 300, 400, 500, 600, 700 |
| Code / Terminal | JetBrains Mono | 300, 400, 500, 600 |

CSS variables updated in `index.css`:
```css
--font-display: 'Space Grotesk', sans-serif;
--font-body:    'Inter', sans-serif;
--font-mono:    'JetBrains Mono', 'Fira Code', monospace;
```

---

## Key Design Decisions

1. **No `date-fns` dependency** — replaced with inline `timeAgo()` helper to avoid an uninstalled package
2. **Broad realtime filter for builds** — Supabase Realtime doesn't support nested subquery filters, so we subscribe broadly and verify repo ownership in the INSERT handler via a secondary query
3. **Flash animation via `_flash` field** — a runtime-only boolean on `RealtimeBuild` that is set to `true` on INSERT/UPDATE and cleared after 1.2s via `setTimeout`
4. **Skeleton loaders** — used while `isLoading && liveBuilds.length === 0` to prevent layout shifts
5. **Cleanup** — both hooks return a cleanup function that removes the Supabase channel and clears all flash `setTimeout` refs on unmount

---

## Validation Checklist

- [x] Dashboard shows real events from Supabase `events` table
- [x] New events appear instantly when inserted (realtime INSERT)
- [x] Build Monitor shows builds from `builds` table
- [x] New builds appear live without refresh (realtime INSERT)
- [x] Build status updates flash live (realtime UPDATE)
- [x] Empty states render correctly when no data
- [x] Error toast + error state when Supabase connection fails
- [x] No duplicate entries — INSERT handler checks `prev.some(b => b.id === id)`
- [x] Subscriptions cleaned up on unmount
- [x] TypeScript types correct — no use of `any`
- [x] Dashboard stats use real `get_dashboard_stats()` RPC
- [x] Skeleton loaders shown while initial data loads
- [x] Responsive: 2-col stats on mobile, 4-col on desktop
