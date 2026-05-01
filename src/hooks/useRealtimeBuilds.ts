// src/hooks/useRealtimeBuilds.ts
// Real-time subscription to the `builds` table for the current user's repos.
// Handles INSERT (prepend) and UPDATE (patch row) events.

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/useAppStore';

export interface RealtimeBuild {
  id: string;
  repo_id: string;
  branch: string;
  commit_sha: string | null;
  commit_message: string | null;
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
  log_url: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  triggered_by: string;
  created_at: string;
  // Joined from connected_repos
  repo_name?: string;
  repo_owner?: string;
  // Flash indicator for live updates
  _flash?: boolean;
}

interface UseRealtimeBuildsReturn {
  builds: RealtimeBuild[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useRealtimeBuilds(): UseRealtimeBuildsReturn {
  const { user } = useAppStore();
  const userId = user?.id ?? null;

  const [liveBuilds, setLiveBuilds] = useState<RealtimeBuild[]>([]);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const flashTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ── Initial load with react-query ───────────────────────
  const {
    data: initialBuilds,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['builds', userId],
    queryFn: async (): Promise<RealtimeBuild[]> => {
      if (!supabase || !userId) return [];

      // Get user's connected repo IDs first
      const { data: repos, error: repoErr } = await supabase
        .from('connected_repos')
        .select('id, repo_name, repo_owner')
        .eq('user_id', userId);

      if (repoErr) throw new Error(repoErr.message);
      if (!repos || repos.length === 0) return [];

      const repoIds = repos.map((r) => r.id);
      const repoMap = new Map(repos.map((r) => [r.id, r]));

      const { data: builds, error: buildsErr } = await supabase
        .from('builds')
        .select('*')
        .in('repo_id', repoIds)
        .order('created_at', { ascending: false })
        .limit(100);

      if (buildsErr) throw new Error(buildsErr.message);

      return ((builds ?? []) as RealtimeBuild[]).map((b) => ({
        ...b,
        repo_name: repoMap.get(b.repo_id)?.repo_name,
        repo_owner: repoMap.get(b.repo_id)?.repo_owner,
      }));
    },
    enabled: !!supabase && !!userId,
    staleTime: 30_000,
    retry: 2,
  });

  useEffect(() => {
    if (initialBuilds && initialBuilds.length > 0) {
      setLiveBuilds(initialBuilds);
    }
  }, [initialBuilds]);

  useEffect(() => {
    if (queryError) {
      const msg = queryError instanceof Error ? queryError.message : 'Failed to load builds';
      toast.error(`Build monitor: ${msg}`);
      setRealtimeError(msg);
    }
  }, [queryError]);

  // ── Flash animation helper ────────────────────────────────
  function flashBuild(id: string) {
    setLiveBuilds((prev) =>
      prev.map((b) => (b.id === id ? { ...b, _flash: true } : b))
    );
    const existing = flashTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      setLiveBuilds((prev) =>
        prev.map((b) => (b.id === id ? { ...b, _flash: false } : b))
      );
      flashTimers.current.delete(id);
    }, 1200);
    flashTimers.current.set(id, timer);
  }

  // ── Realtime subscription ────────────────────────────────
  useEffect(() => {
    if (!supabase || !userId) return;

    // We subscribe broadly and filter by checking repo ownership
    // (row-level filter on nested SELECT not supported in realtime directly)
    const channel = supabase
      .channel(`build-monitor-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'builds',
        },
        async (payload) => {
          const newBuild = payload.new as RealtimeBuild;

          // Verify this build belongs to the user's repo
          if (!supabase) return;
          const { data: repo } = await supabase
            .from('connected_repos')
            .select('repo_name, repo_owner')
            .eq('id', newBuild.repo_id)
            .eq('user_id', userId)
            .maybeSingle();

          if (!repo) return; // Not user's repo

          const enriched: RealtimeBuild = {
            ...newBuild,
            repo_name: repo.repo_name,
            repo_owner: repo.repo_owner,
            _flash: true,
          };

          setLiveBuilds((prev) => {
            if (prev.some((b) => b.id === newBuild.id)) return prev;
            const updated = [enriched, ...prev];
            return updated.slice(0, 100);
          });

          // Clear flash after 1.2s
          const timer = setTimeout(() => {
            setLiveBuilds((prev) =>
              prev.map((b) => (b.id === newBuild.id ? { ...b, _flash: false } : b))
            );
          }, 1200);
          flashTimers.current.set(newBuild.id, timer);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'builds',
        },
        (payload) => {
          const updated = payload.new as RealtimeBuild;
          setLiveBuilds((prev) => {
            const idx = prev.findIndex((b) => b.id === updated.id);
            if (idx < 0) return prev; // Not in our list (different user's repo)
            const next = [...prev];
            next[idx] = { ...next[idx], ...updated };
            return next;
          });
          flashBuild(updated.id);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          const msg = 'Failed to connect to build monitor';
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
      flashTimers.current.forEach((t) => clearTimeout(t));
      flashTimers.current.clear();
    };
  }, [userId]);

  return {
    builds: liveBuilds,
    isLoading: isLoading && liveBuilds.length === 0,
    error: realtimeError,
    refetch,
  };
}
