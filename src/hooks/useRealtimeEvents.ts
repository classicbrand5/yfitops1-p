// src/hooks/useRealtimeEvents.ts
// Real-time subscription to the `events` table for the current user.
// Initial load via react-query, then live via Supabase Realtime.

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

export interface RealtimeEvent {
  id: number;
  user_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface UseRealtimeEventsReturn {
  events: RealtimeEvent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRealtimeEvents(): UseRealtimeEventsReturn {
  const { user } = useAppStore();
  const userId = user?.id ?? null;

  const [liveEvents, setLiveEvents] = useState<RealtimeEvent[]>([]);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);

  // ── Initial load with react-query ───────────────────────
  const {
    data: initialEvents,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['events', userId],
    queryFn: async (): Promise<RealtimeEvent[]> => {
      if (!supabase || !userId) return [];
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return (data ?? []) as RealtimeEvent[];
    },
    enabled: !!supabase && !!userId,
    staleTime: 30_000,
    retry: 2,
  });

  // Seed live events from initial query
  useEffect(() => {
    if (initialEvents && initialEvents.length > 0) {
      setLiveEvents(initialEvents);
    }
  }, [initialEvents]);

  // Show query error as toast
  useEffect(() => {
    if (queryError) {
      const msg = queryError instanceof Error ? queryError.message : 'Failed to load events';
      toast.error(`Activity feed: ${msg}`);
      setRealtimeError(msg);
    }
  }, [queryError]);

  // ── Realtime subscription ────────────────────────────────
  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = supabase
      .channel(`dashboard-events-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newEvent = payload.new as RealtimeEvent;
          setLiveEvents((prev) => {
            // Deduplicate by id
            if (prev.some((e) => e.id === newEvent.id)) return prev;
            const updated = [newEvent, ...prev];
            return updated.slice(0, 50);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          const msg = 'Failed to connect to live activity feed';
          setRealtimeError(msg);
          toast.error(msg);
        } else if (status === 'SUBSCRIBED') {
          setRealtimeError(null);
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  return {
    events: liveEvents,
    isLoading: isLoading && liveEvents.length === 0,
    error: realtimeError,
    refetch,
  };
}
