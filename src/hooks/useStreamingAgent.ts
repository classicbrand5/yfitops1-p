// src/hooks/useStreamingAgent.ts
// Owns the entire streaming lifecycle for the AI agent chat.
// Uses raw fetch + ReadableStream to consume typed SSE frames from agent-inference.
//
// SSE frame protocol:
//   { t: 'token', v: string }         → append text to message
//   { t: 'done', actions, steps, meta } → hydrate actions, stop streaming
//   { t: 'error', message: string }   → show error, stop streaming
//   data: [DONE]                       → stream closed

import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { validateAgentResponse } from '@/types/agent.types';
import { toast } from 'sonner';
import { executeActions } from '@/core/agent/agentExecutor';
import type { ConversationMessage, AgentAction, ActionResult } from '@/types/agent.types';

// ── Helpers ───────────────────────────────────────────────────
function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateConvId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Strip the JSON wrapper that some providers emit when response_format:json_object
// is active and they stream the literal JSON object character-by-character.
// e.g. {"final":"Here is your answer",...}  →  Here is your answer
function stripJsonWrapper(text: string): string {
  // Try to strip leading {"final":" and trailing ",...}
  const stripped = text
    .replace(/^\s*\{\s*"final"\s*:\s*"/, '')
    .replace(/"\s*,?\s*"actions"[\s\S]*$/, '')
    .replace(/"\s*\}\s*$/, '');
  return stripped.length > 0 && stripped !== text ? stripped : text;
}

// ── Main Hook ─────────────────────────────────────────────────
export function useStreamingAgent() {
  const store = useAppStore();
  const {
    user,
    conversations,
    activeConversationId,
    messages,
    isThinking,
    agentAutonomy,
    agentContext,
    expertMode,
    selectedProvider,
    selectedModel,
    addConversation,
    setActiveConversation,
    addMessage,
    updateMessage,
    setIsThinking,
    setStreamingMessageId,
    streamingMessageId,
    clearChat,
    appendTerminalOutput,
    activeTerminalId,
    updateActionStatus,
    addNotification,
    setSelectedProvider,
    setSelectedModel,
  } = store;

  const activeMessages = activeConversationId
    ? (messages[activeConversationId] ?? [])
    : [];
  const isAuthenticated = !!user;

  // Abort controller ref for cancelling in-flight stream
  const abortRef = useRef<AbortController | null>(null);

  // Track which messages have been auto-executed
  const autoExecutedRef = useRef<Set<string>>(new Set());

  // ── createConversation ────────────────────────────────────
  const createConversation = useCallback(
    (title = 'New conversation') => {
      const id = generateConvId();
      addConversation({
        id,
        title,
        category: 'general',
        messageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      setActiveConversation(id);
      return id;
    },
    [addConversation, setActiveConversation],
  );

  // ── cancelStream ──────────────────────────────────────────
  const cancelStream = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsThinking(false);
    setStreamingMessageId(null);
  }, [setIsThinking, setStreamingMessageId]);

  // ── Auto-execute based on agentAutonomy ──────────────────
  useEffect(() => {
    if (isThinking) return;

    const allMessages = Object.values(messages).flat();

    for (const msg of allMessages) {
      if (msg.role !== 'assistant') continue;
      if (!msg.actions || msg.actions.length === 0) continue;
      if (autoExecutedRef.current.has(msg.id)) continue;
      if (msg.isStreaming) continue; // Don't auto-execute during stream

      const hasPending = msg.actions.some((a) => a.status === 'pending');
      if (!hasPending) continue;
      if (agentAutonomy === 'ask') continue;

      autoExecutedRef.current.add(msg.id);

      let convId: string | null = null;
      for (const [cid, msgs] of Object.entries(messages)) {
        if (msgs.some((m) => m.id === msg.id)) {
          convId = cid;
          break;
        }
      }
      if (!convId) continue;

      void autoExecuteMessage(msg);
    }
  }, [messages, isThinking, agentAutonomy]);

  async function autoExecuteMessage(msg: ConversationMessage) {
    if (!msg.actions) return;

    for (let i = 0; i < msg.actions.length; i++) {
      const action = msg.actions[i];
      if (action.status !== 'pending') continue;
      if (agentAutonomy === 'auto-safe' && action.requiresConfirmation) continue;

      updateActionStatus(msg.id, i, 'executing');

      try {
        await executeActions([action], {
          autonomy: agentAutonomy,
          onOutput: (line) => {
            if (activeTerminalId) appendTerminalOutput(activeTerminalId, line);
          },
          onActionStatus: (_idx, status, result) => {
            updateActionStatus(msg.id, i, status, result);
          },
          requestConfirmation: async () => true,
        });

        const fsActions = ['write_file', 'edit_file', 'delete_file', 'create_dir'];
        if (fsActions.includes(action.type)) {
          const { buildFileTree } = await import('@/core/webcontainer/fs');
          const { isWebContainerReady } = await import('@/core/webcontainer/webcontainer');
          if (isWebContainerReady()) {
            const tree = await buildFileTree('/');
            useAppStore.getState().setFileTree(tree);
          }
        }

        addNotification({
          type: 'success',
          title: 'Auto-executed',
          message: action.explanation,
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        updateActionStatus(msg.id, i, 'failed', { success: false, error });
        toast.error('Auto-execution failed', { description: error });
      }
    }
  }

  // ── sendMessage ───────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string, convId?: string) => {
      if (!user) {
        toast.error('Not signed in', {
          description: 'Please sign in to use the AI agent.',
          action: {
            label: 'Sign in',
            onClick: () => { window.location.href = '/auth'; },
          },
          duration: 8000,
        });
        return;
      }

      const targetConvId =
        convId ?? activeConversationId ?? createConversation();

      // Add user message immediately
      const userMsg: ConversationMessage = {
        id: generateId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      addMessage(targetConvId, userMsg);

      // Build history for API
      const history = (messages[targetConvId] ?? []).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      history.push({ role: 'user', content });

      setIsThinking(true);

      // Create empty assistant message (shows thinking dots until first token)
      const assistantMsgId = generateId();
      const assistantMsg: ConversationMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      };
      addMessage(targetConvId, assistantMsg);
      setStreamingMessageId(assistantMsgId);

      try {
        const { supabase, isSupabaseReady } = await import('@/lib/supabase');
        if (!isSupabaseReady || !supabase) {
          throw new Error('Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        }

        // Ensure we have a fresh session token
        const { data: sessionData } = await supabase.auth.getSession();
        let accessToken = sessionData?.session?.access_token;

        if (!accessToken) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshData?.session) {
            toast.error('Session expired', {
              description: 'Please sign in again.',
              action: { label: 'Sign in', onClick: () => { window.location.href = '/auth'; } },
              duration: 8000,
            });
            throw new Error('Session expired');
          }
          accessToken = refreshData.session.access_token;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

        // Create fresh AbortController for this request
        let accumulatedText = '';

        const abort = new AbortController();
        abortRef.current = abort;

        const response = await fetch(
          `${supabaseUrl}/functions/v1/agent-inference`,
          {
            method: 'POST',
            signal: abort.signal,
            headers: {
              Authorization: `Bearer ${accessToken}`,
              apikey: supabaseAnonKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messages: history,
              conversationId: targetConvId,
              expertMode,
              context: agentContext,
              provider: selectedProvider,
              model: selectedModel,
              stream: true,
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text();
          let errorMsg = `Agent error (${response.status})`;
          try {
            const errJson = JSON.parse(errorText);
            errorMsg = errJson.error ?? errorMsg;
            // Handle 429 rate limit
            if (response.status === 429 && errJson.upgradeUrl) {
              toast.error('AI limit reached', {
                description: `Plan: ${errJson.plan}. ${errJson.used}/${errJson.limit} requests used.`,
                action: {
                  label: 'Upgrade',
                  onClick: () => { window.location.href = '/billing'; },
                },
                duration: 10000,
              });
            }
          } catch { /* ignore */ }
          throw new Error(errorMsg);
        }

        if (!response.body) {
          throw new Error('No response body from agent');
        }

        // ── Consume SSE stream ──────────────────────────────
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';

        // Hide thinking dots on first token by updating isThinking
        let gotFirstToken = false;

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });

            // Split on double-newline (SSE event boundary)
            const events = sseBuffer.split('\n\n');
            sseBuffer = events.pop() ?? '';

            for (const event of events) {
              const trimmed = event.trim();
              if (!trimmed.startsWith('data:')) continue;

              const payload = trimmed.slice(5).trim();
              if (payload === '[DONE]') continue;

              let frame: { t: string; v?: string; actions?: unknown[]; steps?: unknown; meta?: unknown; message?: string };
              try {
                frame = JSON.parse(payload);
              } catch {
                continue;
              }

              if (frame.t === 'token' && typeof frame.v === 'string') {
                // Handle REPLACE signal (model streamed raw JSON wrapper)
                if (frame.v.startsWith('\x00REPLACE\x00')) {
                  accumulatedText = frame.v.slice('\x00REPLACE\x00'.length);
                } else {
                  accumulatedText += frame.v;
                }

                // Strip JSON wrapper if model streamed it verbatim
                const displayText = stripJsonWrapper(accumulatedText);

                if (!gotFirstToken) {
                  gotFirstToken = true;
                  // Keep isThinking:true so AgentThinking stays hidden
                  // (AgentChat shows thinking dots only when isThinking && content==='')
                  setIsThinking(false);
                }

                updateMessage(targetConvId, assistantMsgId, {
                  content: displayText,
                  isStreaming: true,
                });
              } else if (frame.t === 'done') {
                // Stream complete — hydrate actions and steps
                const actions = Array.isArray(frame.actions) ? frame.actions : [];
                const steps = frame.steps ?? {};

                updateMessage(targetConvId, assistantMsgId, {
                  content: accumulatedText
                    ? stripJsonWrapper(accumulatedText)
                    : accumulatedText,
                  actions: actions.map((a: unknown) => ({
                    ...(a as object),
                    status: 'pending' as const,
                  })),
                  steps: steps as ConversationMessage['steps'],
                  isStreaming: false,
                });

                setStreamingMessageId(null);
                abortRef.current = null;
              } else if (frame.t === 'error') {
                throw new Error(frame.message ?? 'Stream error');
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User cancelled — update message to show cancellation
          updateMessage(targetConvId, assistantMsgId, {
            content: accumulatedText || '[Cancelled]',
            isStreaming: false,
            error: undefined,
          });
          setStreamingMessageId(null);
          return;
        }

        const errorMessage = err instanceof Error ? err.message : String(err);

        const alreadyHandled =
          errorMessage.includes('Session expired') ||
          errorMessage.includes('limit reached');

        if (!alreadyHandled) {
          toast.error('AI Agent Error', {
            description: errorMessage.slice(0, 200),
            duration: 6000,
          });
        }

        updateMessage(targetConvId, assistantMsgId, {
          content: '',
          error: errorMessage,
          isStreaming: false,
        });
        setStreamingMessageId(null);
      } finally {
        setIsThinking(false);
        abortRef.current = null;
      }
    },
    [
      user,
      activeConversationId,
      messages,
      expertMode,
      agentContext,
      selectedProvider,
      selectedModel,
      agentAutonomy,
      addMessage,
      updateMessage,
      setIsThinking,
      setStreamingMessageId,
      createConversation,
    ],
  );

  return {
    conversations,
    activeConversationId,
    activeMessages,
    isThinking,
    isStreaming: !!streamingMessageId,
    isAuthenticated,
    agentAutonomy,
    createConversation,
    sendMessage,
    cancelStream,
    clearChat,
    setActiveConversation,
    selectedProvider,
    selectedModel,
    setSelectedProvider,
    setSelectedModel,
  };
}

// Re-export with old name for backward compatibility
export { useStreamingAgent as useAIAgent };
