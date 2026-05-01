// src/hooks/useAIAgent.ts
import { useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { validateAgentResponse } from '@/types/agent.types';
import { toast } from 'sonner';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { ConversationMessage, AgentResponse } from '@/types/agent.types';

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateConvId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Classify HTTP status from a FunctionsHttpError and show appropriate toast */
async function handleFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context?.status ?? 500;
    let body = '';
    try {
      body = await error.context?.text();
    } catch { /* ignore */ }

    if (status === 401) {
      toast.error('Session expired', {
        description: 'Your session is invalid or expired. Please sign in again.',
        action: {
          label: 'Sign in',
          onClick: () => { window.location.href = '/auth'; },
        },
        duration: 8000,
      });
      return 'Unauthorized — session expired. Please sign in again.';
    }

    if (status === 403) {
      toast.error('Access denied', { description: 'You do not have permission to use the AI agent.' });
      return 'Forbidden — access denied.';
    }

    if (status === 502 || status === 503) {
      toast.error('AI service unavailable', {
        description: 'The AI service is temporarily down. Please try again in a moment.',
        duration: 6000,
      });
      return `AI service unavailable (${status}). Please try again later.`;
    }

    if (status === 429) {
      toast.error('Rate limited', {
        description: 'Too many requests. Please wait a moment before trying again.',
        duration: 6000,
      });
      return 'Rate limited — too many requests.';
    }

    const detail = body ? body.slice(0, 200) : error.message;
    return `[${status}] ${detail}`;
  }

  // Generic error
  const msg = error instanceof Error ? error.message : String(error);
  return msg;
}

export function useAIAgent() {
  const {
    user,
    conversations,
    activeConversationId,
    messages,
    isThinking,
    agentAutonomy,
    agentContext,
    expertMode,
    addConversation,
    setActiveConversation,
    addMessage,
    updateMessage,
    setIsThinking,
    setStreamingMessageId,
    clearChat,
  } = useAppStore();

  const activeMessages = activeConversationId ? (messages[activeConversationId] ?? []) : [];
  const isAuthenticated = !!user;

  const createConversation = useCallback((title = 'New conversation') => {
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
  }, [addConversation, setActiveConversation]);

  const sendMessage = useCallback(async (content: string, convId?: string) => {
    // ── Guard: must be authenticated ──────────────────────────
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

    const targetConvId = convId ?? activeConversationId ?? createConversation();

    // Add user message
    const userMsg: ConversationMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    addMessage(targetConvId, userMsg);

    // Build message history for API (include history before new message)
    const history = (messages[targetConvId] ?? []).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    history.push({ role: 'user', content });

    setIsThinking(true);

    // Create placeholder assistant message
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
      // ── Guard: Supabase must be configured ────────────────
      const { supabase, isSupabaseReady } = await import('@/lib/supabase');
      if (!isSupabaseReady || !supabase) {
        throw new Error(
          'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables to enable the AI agent.'
        );
      }

      // ── Guard: session must be valid ──────────────────────
      // Refresh session silently before calling the edge function
      // so we catch token expiry before hitting the server
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session) {
        // Try to refresh once
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          toast.error('Session expired', {
            description: 'Your session has expired. Please sign in again.',
            action: {
              label: 'Sign in',
              onClick: () => { window.location.href = '/auth'; },
            },
            duration: 8000,
          });
          throw new Error('Session expired — please sign in again.');
        }
      }

      // ── Call edge function ────────────────────────────────
      const { data, error } = await supabase.functions.invoke('agent-inference', {
        body: {
          messages: history,
          conversationId: targetConvId,
          expertMode,
          workspaceContext: agentContext,
        },
      });

      if (error) {
        const errorMessage = await handleFunctionError(error);
        throw new Error(errorMessage);
      }

      const raw: unknown = data;
      const parsed: AgentResponse = validateAgentResponse(raw);

      updateMessage(targetConvId, assistantMsgId, {
        content: parsed.final,
        actions: parsed.actions?.map((a) => ({ ...a, status: 'pending' as const })),
        isStreaming: false,
      });
    } catch (err) {
      // If it's already been handled and toasted (FunctionsHttpError path),
      // we still need to update the message to show the error
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Only show a generic toast if the error wasn't already handled above
      const alreadyHandled =
        errorMessage.includes('Session expired') ||
        errorMessage.includes('Unauthorized') ||
        errorMessage.includes('Forbidden') ||
        errorMessage.includes('unavailable') ||
        errorMessage.includes('Rate limited');

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
    } finally {
      setIsThinking(false);
      setStreamingMessageId(null);
    }
  }, [
    user,
    activeConversationId,
    messages,
    expertMode,
    agentContext,
    addMessage,
    updateMessage,
    setIsThinking,
    setStreamingMessageId,
    createConversation,
  ]);

  return {
    conversations,
    activeConversationId,
    activeMessages,
    isThinking,
    isAuthenticated,
    agentAutonomy,
    createConversation,
    sendMessage,
    clearChat,
    setActiveConversation,
  };
}
