// src/hooks/useAIAgent.ts
import { useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { validateAgentResponse } from '@/types/agent.types';
import { toast } from 'sonner';
import type { ConversationMessage, AgentResponse } from '@/types/agent.types';

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function generateConvId(): string {
  return `conv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useAIAgent() {
  const {
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
    const targetConvId = convId ?? activeConversationId ?? createConversation();

    // Add user message
    const userMsg: ConversationMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    addMessage(targetConvId, userMsg);

    // Build message history for API
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
      const { supabase, isSupabaseReady } = await import('@/lib/supabase');
      if (!isSupabaseReady || !supabase) {
        throw new Error('Supabase not configured — connect your project to enable AI agent');
      }

      const { data, error } = await supabase.functions.invoke('agent-inference', {
        body: {
          messages: history,
          conversationId: targetConvId,
          expertMode,
          workspaceContext: agentContext,
        },
      });

      if (error) {
        let msg = error.message;
        // Extract real error text from edge function HTTP errors
        if ('context' in error && error.context) {
          try {
            const ctx = error.context as { status?: number; text?: () => Promise<string> };
            const status = ctx.status ?? 500;
            const text = await ctx.text?.();
            msg = `[${status}] ${text || error.message}`;
          } catch { /* ignore */ }
        }
        throw new Error(msg);
      }

      const raw: unknown = data;
      const parsed: AgentResponse = validateAgentResponse(raw);

      updateMessage(targetConvId, assistantMsgId, {
        content: parsed.final,
        actions: parsed.actions?.map((a) => ({ ...a, status: 'pending' as const })),
        isStreaming: false,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      updateMessage(targetConvId, assistantMsgId, {
        content: '',
        error,
        isStreaming: false,
      });
      toast.error('AI Agent Error', { description: error });
    } finally {
      setIsThinking(false);
      setStreamingMessageId(null);
    }
  }, [
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
    agentAutonomy,
    createConversation,
    sendMessage,
    clearChat,
    setActiveConversation,
  };
}
