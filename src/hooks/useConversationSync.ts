// src/hooks/useConversationSync.ts
// Syncs active conversation + messages to Supabase ai_conversations and ai_messages tables
// Uses debounced upsert — fires 2s after last message change

import { useCallback, useRef, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { supabase } from '@/lib/supabase';

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function useConversationSync() {
  const { user, conversations, messages, activeConversationId } = useAppStore();

  const syncToSupabase = useCallback(
    debounce(async (convId: string) => {
      if (!supabase || !user) return;

      const conv = conversations.find((c) => c.id === convId);
      const msgs = messages[convId] ?? [];
      if (!conv || msgs.length === 0) return;

      try {
        // Upsert conversation metadata
        const { error: convError } = await supabase.from('ai_conversations').upsert({
          id: convId,
          user_id: user.id,
          title: conv.title,
          category: conv.category ?? 'general',
          message_count: msgs.length,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });

        if (convError) {
          console.warn('[ConversationSync] Conv upsert failed:', convError.message);
          return;
        }

        // Batch upsert messages (only last 50 to avoid payload size limits)
        const recentMsgs = msgs.slice(-50);
        const msgRows = recentMsgs.map((m) => ({
          id: m.id,
          conversation_id: convId,
          role: m.role,
          content: m.content ?? '',
          metadata: {
            timestamp: m.timestamp,
            isStreaming: m.isStreaming ?? false,
            error: m.error ?? null,
          },
          actions: m.actions ?? [],
        }));

        const { error: msgError } = await supabase
          .from('ai_messages')
          .upsert(msgRows, { onConflict: 'id' });

        if (msgError) {
          console.warn('[ConversationSync] Messages upsert failed:', msgError.message);
        } else {
          console.log(`[ConversationSync] Synced ${msgRows.length} messages for conv ${convId}`);
        }
      } catch (err) {
        console.warn('[ConversationSync] Sync error:', err);
      }
    }, 2000),
    [user, conversations, messages]
  );

  // Load conversations from Supabase on mount
  useEffect(() => {
    if (!supabase || !user) return;

    async function loadConversations() {
      if (!supabase || !user) return;
      try {
        const { data, error } = await supabase
          .from('ai_conversations')
          .select('id,title,category,message_count,created_at,updated_at')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(10);

        if (error || !data) return;

        const { setConversations } = useAppStore.getState();
        const existing = useAppStore.getState().conversations;

        // Merge: prefer local state if already exists, add remote ones
        const merged = [...existing];
        for (const remote of data) {
          if (!merged.find((c) => c.id === remote.id)) {
            merged.push({
              id: remote.id,
              title: remote.title ?? 'Conversation',
              category: remote.category ?? 'general',
              messageCount: remote.message_count ?? 0,
              createdAt: new Date(remote.created_at).getTime(),
              updatedAt: new Date(remote.updated_at).getTime(),
            });
          }
        }

        setConversations(merged);
      } catch { /* ignore */ }
    }

    loadConversations();
  }, [user]);

  return { syncToSupabase };
}
