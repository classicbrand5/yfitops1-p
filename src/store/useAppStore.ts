// src/store/useAppStore.ts
// Single Zustand store — fully typed, persisted, immer-backed

import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
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
      immer((set) => ({
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
        setUser: (user) => set((s) => { s.user = user; }),
        setAuthLoading: (v) => set((s) => { s.isAuthLoading = v; }),

        // ── Layout ──
        setLayoutMode: (mode) => set((s) => { s.layoutMode = mode; }),
        setSplitRatio: (ratio) => set((s) => { s.splitRatio = Math.min(0.8, Math.max(0.2, ratio)); }),
        togglePanel: (panel) => set((s) => {
          const idx = s.activePanelIds.indexOf(panel);
          if (idx >= 0) s.activePanelIds.splice(idx, 1);
          else s.activePanelIds.push(panel);
        }),
        setSidebarCollapsed: (v) => set((s) => { s.sidebarCollapsed = v; }),
        setSidebarWidth: (w) => set((s) => { s.sidebarWidth = Math.min(400, Math.max(200, w)); }),
        setRightPanelWidth: (w) => set((s) => { s.rightPanelWidth = Math.min(600, Math.max(280, w)); }),
        toggleTheme: () => set((s) => { s.theme = s.theme === 'dark' ? 'light' : 'dark'; }),
        setExpertMode: (v) => set((s) => { s.expertMode = v; }),
        openCommandPalette: () => set((s) => { s.commandPaletteOpen = true; }),
        closeCommandPalette: () => set((s) => { s.commandPaletteOpen = false; }),
        setFocusedPanel: (panel) => set((s) => { s.focusedPanel = panel; }),

        // ── File System ──
        setWorkspaceReady: (ready, error) => set((s) => {
          s.workspaceReady = ready;
          s.workspaceError = error ?? null;
        }),
        setFileTree: (tree) => set((s) => { s.fileTree = tree; }),
        openFile: (path, language) => set((s) => {
          const existing = s.openTabs.find((t) => t.path === path);
          if (existing) {
            s.activeTabId = existing.id;
            return;
          }
          const id = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const name = path.split('/').pop() ?? path;
          s.openTabs.push({ id, path, name, isDirty: false, language });
          s.activeTabId = id;
          s.selectedFilePath = path;
        }),
        closeTab: (tabId) => set((s) => {
          const idx = s.openTabs.findIndex((t) => t.id === tabId);
          if (idx < 0) return;
          s.openTabs.splice(idx, 1);
          if (s.activeTabId === tabId) {
            s.activeTabId = s.openTabs[Math.max(0, idx - 1)]?.id ?? null;
          }
        }),
        setActiveTab: (tabId) => set((s) => { s.activeTabId = tabId; }),
        markTabDirty: (tabId, dirty) => set((s) => {
          const tab = s.openTabs.find((t) => t.id === tabId);
          if (tab) {
            tab.isDirty = dirty;
            if (dirty && !s.dirtyFiles.includes(tab.path)) {
              s.dirtyFiles.push(tab.path);
            } else if (!dirty) {
              s.dirtyFiles = s.dirtyFiles.filter((p) => p !== tab.path);
            }
          }
        }),
        setCursorPosition: (tabId, line, col) => set((s) => {
          const tab = s.openTabs.find((t) => t.id === tabId);
          if (tab) { tab.cursorLine = line; tab.cursorCol = col; }
        }),
        toggleFolder: (path) => set((s) => {
          const idx = s.expandedFolders.indexOf(path);
          if (idx >= 0) s.expandedFolders.splice(idx, 1);
          else s.expandedFolders.push(path);
        }),
        setSelectedFile: (path) => set((s) => { s.selectedFilePath = path; }),
        setCurrentBranch: (branch) => set((s) => { s.currentBranch = branch; }),
        setEditorMarkers: (errors, warnings) => set((s) => {
          s.editorErrors = errors;
          s.editorWarnings = warnings;
        }),
        removeFileFromTree: (path) => set((s) => {
          function removeFromTree(nodes: FileNode[]): FileNode[] {
            return nodes
              .filter((n) => n.path !== path)
              .map((n) => ({ ...n, children: n.children ? removeFromTree(n.children) : undefined }));
          }
          s.fileTree = removeFromTree(s.fileTree);
        }),
        addFileToTree: (file) => set((s) => { s.fileTree.push(file); }),

        // ── Terminal ──
        createTerminalSession: (id, cwd = '/') => set((s) => {
          s.terminalSessions[id] = {
            id,
            title: `bash`,
            isRunning: false,
            output: [],
            cwd,
            createdAt: Date.now(),
          };
          s.activeTerminalId = id;
        }),
        removeTerminalSession: (id) => set((s) => {
          delete s.terminalSessions[id];
          if (s.activeTerminalId === id) {
            const remaining = Object.keys(s.terminalSessions);
            s.activeTerminalId = remaining[0] ?? null;
          }
        }),
        setActiveTerminal: (id) => set((s) => { s.activeTerminalId = id; }),
        appendTerminalOutput: (sessionId, line) => set((s) => {
          const session = s.terminalSessions[sessionId];
          if (session) {
            session.output.push(line);
            if (session.output.length > 5000) session.output.splice(0, 500);
          }
        }),
        setTerminalRunning: (sessionId, running) => set((s) => {
          const session = s.terminalSessions[sessionId];
          if (session) session.isRunning = running;
        }),
        setTerminalExitCode: (sessionId, code) => set((s) => {
          const session = s.terminalSessions[sessionId];
          if (session) { session.exitCode = code; session.isRunning = false; }
        }),

        // ── Processes ──
        registerProcess: (p) => set((s) => { s.processes[p.id] = p; }),
        updateProcessStatus: (id, status, exitCode) => set((s) => {
          const p = s.processes[id];
          if (p) {
            p.status = status;
            if (exitCode !== undefined) p.exitCode = exitCode;
            if (['exited', 'killed', 'errored'].includes(status)) p.endedAt = Date.now();
          }
        }),
        appendProcessOutput: (id, line) => set((s) => {
          const p = s.processes[id];
          if (p) {
            p.output.push(line);
            if (p.output.length > 2000) p.output.splice(0, 200);
          }
        }),

        // ── Agent ──
        setConversations: (convs) => set((s) => { s.conversations = convs; }),
        setActiveConversation: (id) => set((s) => { s.activeConversationId = id; }),
        addConversation: (conv) => set((s) => { s.conversations.unshift(conv); }),
        addMessage: (convId, msg) => set((s) => {
          if (!s.messages[convId]) s.messages[convId] = [];
          s.messages[convId].push(msg);
          const conv = s.conversations.find((c) => c.id === convId);
          if (conv) { conv.messageCount++; conv.updatedAt = Date.now(); }
        }),
        updateMessage: (convId, msgId, patch) => set((s) => {
          const msgs = s.messages[convId];
          if (!msgs) return;
          const msg = msgs.find((m) => m.id === msgId);
          if (msg) Object.assign(msg, patch);
        }),
        setIsThinking: (v) => set((s) => { s.isThinking = v; }),
        setStreamingMessageId: (id) => set((s) => { s.streamingMessageId = id; }),
        setPendingActions: (actions) => set((s) => { s.pendingActions = actions; }),
        updateActionStatus: (msgId, actionIdx, status, result) => set((s) => {
          for (const convId of Object.keys(s.messages)) {
            const msg = s.messages[convId]?.find((m) => m.id === msgId);
            if (msg?.actions?.[actionIdx]) {
              msg.actions[actionIdx].status = status;
              if (result) msg.actions[actionIdx].result = result;
              return;
            }
          }
        }),
        setAgentAutonomy: (level) => set((s) => { s.agentAutonomy = level; }),
        updateAgentContext: (patch) => set((s) => { Object.assign(s.agentContext, patch); }),
        clearChat: (convId) => set((s) => { s.messages[convId] = []; }),

        // ── Notifications ──
        addNotification: (n) => set((s) => {
          const notification: Notification = {
            ...n,
            id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            read: false,
          };
          s.notifications.unshift(notification);
          s.unreadNotificationCount++;
          if (s.notifications.length > 50) s.notifications.splice(50);
        }),
        markNotificationRead: (id) => set((s) => {
          const n = s.notifications.find((x) => x.id === id);
          if (n && !n.read) { n.read = true; s.unreadNotificationCount = Math.max(0, s.unreadNotificationCount - 1); }
        }),
        clearNotifications: () => set((s) => {
          s.notifications = [];
          s.unreadNotificationCount = 0;
        }),
      })),
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
        }),
      }
    )
  )
);
