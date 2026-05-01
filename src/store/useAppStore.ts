// src/store/useAppStore.ts
// Single Zustand store — fully typed, persisted, plain set (no immer dependency)

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import type {
  FileNode,
  EditorTab,
  TerminalSession,
  ProcessRecord,
  ProcessStatus,
  LayoutMode,
  PanelId,
  Notification,
} from '@/types/dev.types';
import type {
  AgentAction,
  ActionResult,
  AgentAutonomy,
  AgentContext,
  ConversationMeta,
  ConversationMessage,
} from '@/types/agent.types';

// ── User ──────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: string;
  plan: 'starter' | 'pro' | 'team';
  githubUsername?: string;
}

// ── Store Interface ────────────────────────────────────────
export interface AppState {
  // Auth
  user: AuthUser | null;
  isAuthLoading: boolean;

  // Layout
  layoutMode: LayoutMode;
  splitRatio: number;
  activePanelIds: PanelId[];
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  rightPanelWidth: number;
  theme: 'dark' | 'light';
  expertMode: boolean;
  commandPaletteOpen: boolean;
  focusedPanel: PanelId | null;

  // Workspace
  workspaceReady: boolean;
  workspaceError: string | null;
  fileTree: FileNode[];
  openTabs: EditorTab[];
  activeTabId: string | null;
  dirtyFiles: string[];
  expandedFolders: string[];
  selectedFilePath: string | null;
  currentBranch: string;
  editorErrors: number;
  editorWarnings: number;

  // Terminal
  terminalSessions: Record<string, TerminalSession>;
  activeTerminalId: string | null;

  // Processes
  processes: Record<string, ProcessRecord>;

  // Agent
  conversations: ConversationMeta[];
  activeConversationId: string | null;
  messages: Record<string, ConversationMessage[]>;
  isThinking: boolean;
  streamingMessageId: string | null;
  pendingActions: AgentAction[];
  agentAutonomy: AgentAutonomy;
  agentContext: AgentContext;

  // Notifications
  notifications: Notification[];
  unreadNotificationCount: number;

  // ── Actions ──────────────────────────────────────────────
  // Auth
  setUser: (user: AuthUser | null) => void;
  setAuthLoading: (v: boolean) => void;

  // Layout
  setLayoutMode: (mode: LayoutMode) => void;
  setSplitRatio: (ratio: number) => void;
  togglePanel: (panel: PanelId) => void;
  setSidebarCollapsed: (v: boolean) => void;
  setSidebarWidth: (w: number) => void;
  setRightPanelWidth: (w: number) => void;
  toggleTheme: () => void;
  setExpertMode: (v: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  setFocusedPanel: (panel: PanelId | null) => void;

  // File System
  setWorkspaceReady: (ready: boolean, error?: string) => void;
  setFileTree: (tree: FileNode[]) => void;
  openFile: (path: string, language: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  markTabDirty: (tabId: string, dirty: boolean) => void;
  setCursorPosition: (tabId: string, line: number, col: number) => void;
  toggleFolder: (path: string) => void;
  setSelectedFile: (path: string | null) => void;
  setCurrentBranch: (branch: string) => void;
  setEditorMarkers: (errors: number, warnings: number) => void;
  removeFileFromTree: (path: string) => void;
  addFileToTree: (file: FileNode) => void;

  // Terminal
  createTerminalSession: (id: string, cwd?: string) => void;
  removeTerminalSession: (id: string) => void;
  setActiveTerminal: (id: string) => void;
  appendTerminalOutput: (sessionId: string, line: string) => void;
  setTerminalRunning: (sessionId: string, running: boolean) => void;
  setTerminalExitCode: (sessionId: string, code: number) => void;

  // Processes
  registerProcess: (p: ProcessRecord) => void;
  updateProcessStatus: (id: string, status: ProcessStatus, exitCode?: number) => void;
  appendProcessOutput: (id: string, line: string) => void;

  // Agent
  setConversations: (convs: ConversationMeta[]) => void;
  setActiveConversation: (id: string | null) => void;
  addConversation: (conv: ConversationMeta) => void;
  addMessage: (convId: string, msg: ConversationMessage) => void;
  updateMessage: (convId: string, msgId: string, patch: Partial<ConversationMessage>) => void;
  setIsThinking: (v: boolean) => void;
  setStreamingMessageId: (id: string | null) => void;
  setPendingActions: (actions: AgentAction[]) => void;
  updateActionStatus: (msgId: string, actionIdx: number, status: AgentAction['status'], result?: ActionResult) => void;
  setAgentAutonomy: (level: AgentAutonomy) => void;
  updateAgentContext: (patch: Partial<AgentContext>) => void;
  clearChat: (convId: string) => void;

  // Notifications
  addNotification: (n: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
}

// ── Store Implementation ───────────────────────────────────
export const useAppStore = create<AppState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // ── Initial State ──
        user: null,
        isAuthLoading: true,

        layoutMode: 'split-horizontal',
        splitRatio: 0.6,
        activePanelIds: ['explorer', 'editor', 'terminal', 'chat'],
        sidebarCollapsed: false,
        sidebarWidth: 220,
        rightPanelWidth: 380,
        theme: 'dark',
        expertMode: false,
        commandPaletteOpen: false,
        focusedPanel: null,

        workspaceReady: false,
        workspaceError: null,
        fileTree: [],
        openTabs: [],
        activeTabId: null,
        dirtyFiles: [],
        expandedFolders: [],
        selectedFilePath: null,
        currentBranch: 'main',
        editorErrors: 0,
        editorWarnings: 0,

        terminalSessions: {},
        activeTerminalId: null,

        processes: {},

        conversations: [],
        activeConversationId: null,
        messages: {},
        isThinking: false,
        streamingMessageId: null,
        pendingActions: [],
        agentAutonomy: 'ask',
        agentContext: {
          includeGitHistory: false,
          includeOpenFiles: true,
          includeBuildStatus: true,
          includeTerminalOutput: true,
          maxContextLines: 500,
        },

        notifications: [],
        unreadNotificationCount: 0,

        // ── Auth ──
        setUser: (user) => set({ user }),
        setAuthLoading: (v) => set({ isAuthLoading: v }),

        // ── Layout ──
        setLayoutMode: (mode) => set({ layoutMode: mode }),
        setSplitRatio: (ratio) => set({ splitRatio: Math.min(0.8, Math.max(0.2, ratio)) }),
        togglePanel: (panel) => set((s) => {
          const ids = s.activePanelIds;
          return {
            activePanelIds: ids.includes(panel)
              ? ids.filter((p) => p !== panel)
              : [...ids, panel],
          };
        }),
        setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
        setSidebarWidth: (w) => set({ sidebarWidth: Math.min(400, Math.max(200, w)) }),
        setRightPanelWidth: (w) => set({ rightPanelWidth: Math.min(600, Math.max(280, w)) }),
        toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
        setExpertMode: (v) => set({ expertMode: v }),
        openCommandPalette: () => set({ commandPaletteOpen: true }),
        closeCommandPalette: () => set({ commandPaletteOpen: false }),
        setFocusedPanel: (panel) => set({ focusedPanel: panel }),

        // ── File System ──
        setWorkspaceReady: (ready, error) => set({ workspaceReady: ready, workspaceError: error ?? null }),
        setFileTree: (tree) => set({ fileTree: tree }),
        openFile: (path, language) => set((s) => {
          const existing = s.openTabs.find((t) => t.path === path);
          if (existing) return { activeTabId: existing.id, selectedFilePath: path };
          const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const name = path.split('/').pop() ?? path;
          return {
            openTabs: [...s.openTabs, { id, path, name, isDirty: false, language }],
            activeTabId: id,
            selectedFilePath: path,
          };
        }),
        closeTab: (tabId) => set((s) => {
          const idx = s.openTabs.findIndex((t) => t.id === tabId);
          if (idx < 0) return {};
          const closedTab = s.openTabs[idx];
          const newTabs = s.openTabs.filter((t) => t.id !== tabId);
          const newActiveId = s.activeTabId === tabId
            ? (newTabs[Math.max(0, idx - 1)]?.id ?? null)
            : s.activeTabId;

          // Dispose Monaco model to prevent memory leaks
          if (closedTab?.path) {
            try {
              const monacoGlobal = (window as Record<string, unknown>)['monaco'];
              if (monacoGlobal && typeof monacoGlobal === 'object') {
                const m = monacoGlobal as {
                  editor?: {
                    getModel?: (uri: unknown) => { dispose?: () => void } | null;
                    Uri?: { file?: (p: string) => unknown };
                  };
                };
                if (m.editor?.getModel && m.editor?.Uri?.file) {
                  const uri = m.editor.Uri.file(closedTab.path);
                  const model = m.editor.getModel(uri);
                  if (model?.dispose) {
                    model.dispose();
                    console.log('[Monaco] Disposed model for', closedTab.path);
                  }
                }
              }
            } catch {
              // Monaco not ready or model already disposed — safe to ignore
            }
          }

          return { openTabs: newTabs, activeTabId: newActiveId };
        }),
        setActiveTab: (tabId) => set({ activeTabId: tabId }),
        markTabDirty: (tabId, dirty) => set((s) => {
          const tab = s.openTabs.find((t) => t.id === tabId);
          if (!tab) return {};
          return {
            openTabs: s.openTabs.map((t) =>
              t.id === tabId ? { ...t, isDirty: dirty } : t
            ),
            dirtyFiles: dirty
              ? s.dirtyFiles.includes(tab.path) ? s.dirtyFiles : [...s.dirtyFiles, tab.path]
              : s.dirtyFiles.filter((p) => p !== tab.path),
          };
        }),
        setCursorPosition: (tabId, line, col) => set((s) => ({
          openTabs: s.openTabs.map((t) =>
            t.id === tabId ? { ...t, cursorLine: line, cursorCol: col } : t
          ),
        })),
        toggleFolder: (path) => set((s) => ({
          expandedFolders: s.expandedFolders.includes(path)
            ? s.expandedFolders.filter((p) => p !== path)
            : [...s.expandedFolders, path],
        })),
        setSelectedFile: (path) => set({ selectedFilePath: path }),
        setCurrentBranch: (branch) => set({ currentBranch: branch }),
        setEditorMarkers: (errors, warnings) => set({ editorErrors: errors, editorWarnings: warnings }),
        removeFileFromTree: (path) => set((s) => {
          function removeFromTree(nodes: FileNode[]): FileNode[] {
            return nodes
              .filter((n) => n.path !== path)
              .map((n) => ({ ...n, children: n.children ? removeFromTree(n.children) : undefined }));
          }
          return { fileTree: removeFromTree(s.fileTree) };
        }),
        addFileToTree: (file) => set((s) => ({ fileTree: [...s.fileTree, file] })),

        // ── Terminal ──
        createTerminalSession: (id, cwd = '/') => set((s) => ({
          terminalSessions: {
            ...s.terminalSessions,
            [id]: {
              id,
              title: 'bash',
              isRunning: false,
              output: [],
              cwd,
              createdAt: Date.now(),
            },
          },
          activeTerminalId: id,
        })),
        removeTerminalSession: (id) => set((s) => {
          const { [id]: _removed, ...rest } = s.terminalSessions;
          const remaining = Object.keys(rest);
          return {
            terminalSessions: rest,
            activeTerminalId: s.activeTerminalId === id ? (remaining[0] ?? null) : s.activeTerminalId,
          };
        }),
        setActiveTerminal: (id) => set({ activeTerminalId: id }),
        appendTerminalOutput: (sessionId, line) => set((s) => {
          const session = s.terminalSessions[sessionId];
          if (!session) return {};
          const output = [...session.output, line];
          const trimmed = output.length > 5000 ? output.slice(-4500) : output;
          return {
            terminalSessions: {
              ...s.terminalSessions,
              [sessionId]: { ...session, output: trimmed },
            },
          };
        }),
        setTerminalRunning: (sessionId, running) => set((s) => {
          const session = s.terminalSessions[sessionId];
          if (!session) return {};
          return {
            terminalSessions: {
              ...s.terminalSessions,
              [sessionId]: { ...session, isRunning: running },
            },
          };
        }),
        setTerminalExitCode: (sessionId, code) => set((s) => {
          const session = s.terminalSessions[sessionId];
          if (!session) return {};
          return {
            terminalSessions: {
              ...s.terminalSessions,
              [sessionId]: { ...session, exitCode: code, isRunning: false },
            },
          };
        }),

        // ── Processes ──
        registerProcess: (p) => set((s) => ({
          processes: { ...s.processes, [p.id]: p },
        })),
        updateProcessStatus: (id, status, exitCode) => set((s) => {
          const p = s.processes[id];
          if (!p) return {};
          return {
            processes: {
              ...s.processes,
              [id]: {
                ...p,
                status,
                ...(exitCode !== undefined ? { exitCode } : {}),
                ...(['exited', 'killed', 'errored'].includes(status) ? { endedAt: Date.now() } : {}),
              },
            },
          };
        }),
        appendProcessOutput: (id, line) => set((s) => {
          const p = s.processes[id];
          if (!p) return {};
          const output = [...p.output, line];
          const trimmed = output.length > 2000 ? output.slice(-1800) : output;
          return { processes: { ...s.processes, [id]: { ...p, output: trimmed } } };
        }),

        // ── Agent ──
        setConversations: (convs) => set({ conversations: convs }),
        setActiveConversation: (id) => set({ activeConversationId: id }),
        addConversation: (conv) => set((s) => ({ conversations: [conv, ...s.conversations] })),
        addMessage: (convId, msg) => set((s) => {
          const existing = s.messages[convId] ?? [];
          const updatedConversations = s.conversations.map((c) =>
            c.id === convId ? { ...c, messageCount: c.messageCount + 1, updatedAt: Date.now() } : c
          );
          return {
            messages: { ...s.messages, [convId]: [...existing, msg] },
            conversations: updatedConversations,
          };
        }),
        updateMessage: (convId, msgId, patch) => set((s) => {
          const msgs = s.messages[convId];
          if (!msgs) return {};
          return {
            messages: {
              ...s.messages,
              [convId]: msgs.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
            },
          };
        }),
        setIsThinking: (v) => set({ isThinking: v }),
        setStreamingMessageId: (id) => set({ streamingMessageId: id }),
        setPendingActions: (actions) => set({ pendingActions: actions }),
        updateActionStatus: (msgId, actionIdx, status, result) => set((s) => {
          for (const convId of Object.keys(s.messages)) {
            const msgs = s.messages[convId];
            const msgIdx = msgs?.findIndex((m) => m.id === msgId) ?? -1;
            if (msgIdx >= 0 && msgs) {
              const msg = msgs[msgIdx];
              if (!msg.actions?.[actionIdx]) continue;
              const newActions = [...(msg.actions ?? [])];
              newActions[actionIdx] = { ...newActions[actionIdx], status, ...(result ? { result } : {}) };
              return {
                messages: {
                  ...s.messages,
                  [convId]: msgs.map((m, i) => (i === msgIdx ? { ...m, actions: newActions } : m)),
                },
              };
            }
          }
          return {};
        }),
        setAgentAutonomy: (level) => set({ agentAutonomy: level }),
        updateAgentContext: (patch) => set((s) => ({ agentContext: { ...s.agentContext, ...patch } })),
        clearChat: (convId) => set((s) => ({ messages: { ...s.messages, [convId]: [] } })),

        // ── Notifications ──
        addNotification: (n) => set((s) => {
          const notification: Notification = {
            ...n,
            id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            read: false,
          };
          const notifications = [notification, ...s.notifications].slice(0, 50);
          return { notifications, unreadNotificationCount: s.unreadNotificationCount + 1 };
        }),
        markNotificationRead: (id) => set((s) => {
          const n = s.notifications.find((x) => x.id === id);
          if (!n || n.read) return {};
          return {
            notifications: s.notifications.map((x) => (x.id === id ? { ...x, read: true } : x)),
            unreadNotificationCount: Math.max(0, s.unreadNotificationCount - 1),
          };
        }),
        clearNotifications: () => set({ notifications: [], unreadNotificationCount: 0 }),
      }),
      {
        name: 'yfitops-store',
        partialize: (state): Partial<AppState> => ({
          layoutMode: state.layoutMode,
          splitRatio: state.splitRatio,
          sidebarCollapsed: state.sidebarCollapsed,
          sidebarWidth: state.sidebarWidth,
          rightPanelWidth: state.rightPanelWidth,
          theme: state.theme,
          expertMode: state.expertMode,
          agentAutonomy: state.agentAutonomy,
          agentContext: state.agentContext,
          expandedFolders: state.expandedFolders,
          activeConversationId: state.activeConversationId,
          // Persist notifications so unread count survives page refresh
          notifications: state.notifications.slice(0, 50),
          unreadNotificationCount: state.unreadNotificationCount,
        }),
      }
    )
  )
);
