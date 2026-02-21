// =====================================================
//  FieldCorrect — Realtime subscription hook
// =====================================================

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/infra/supabase';
import { useMapStore } from '@/stores/mapStore';
import { useProjectStore } from '@/stores/projectStore';
import type { AppFeature } from '@/shared/types';

/**
 * Subscribe to Supabase Realtime for a project's features and corrections.
 */
export function useProjectRealtime(projectId: string | undefined, layerIds: string[]) {
  const queryClient = useQueryClient();
  const currentUserId = useProjectStore((s) => s.currentUser?.id);
  const layerIdsFilter = layerIds.join(',');

  useEffect(() => {
    if (!projectId || layerIds.length === 0) return;

    const channel = supabase
      .channel(`project:${projectId}`)

      // Feature changes (locks, corrections, status)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'features',
          filter: `layer_id=in.(${layerIdsFilter})`,
        },
        (payload) => {
          const newRow = payload.new as Record<string, unknown>;
          const layerId = newRow.layer_id as string;

          // Optimistic cache update
          queryClient.setQueryData<AppFeature[]>(
            ['features', layerId],
            (old) => {
              if (!old) return old;
              const idx = old.findIndex((f) => f.id === newRow.id);
              if (idx >= 0) {
                const updated = [...old];
                updated[idx] = { ...updated[idx], ...newRow } as unknown as AppFeature;
                return updated;
              }
              return old;
            }
          );

          // Notification if locked by someone else
          if (
            newRow.locked_by &&
            newRow.locked_by !== currentUserId
          ) {
            console.info(`Feature locked by another user`);
          }
        }
      )

      // New corrections
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'corrections',
        },
        (payload) => {
          const newRow = payload.new as Record<string, unknown>;
          queryClient.invalidateQueries({
            queryKey: ['corrections', newRow.feature_id],
          });
        }
      )

      // Presence
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat() as unknown as Array<{
          userId: string;
          name: string;
          viewport?: Record<string, unknown>;
          activeTool?: string;
        }>;
        useMapStore.getState().setOnlineUsers(
          users.map((u) => ({
            userId: u.userId,
            name: u.name,
            activeTool: u.activeTool,
          }))
        );
      })

      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && currentUserId) {
          const user = useProjectStore.getState().currentUser;
          await channel.track({
            userId: currentUserId,
            name: user?.fullName ?? 'Unknown',
            activeTool: useMapStore.getState().activeTool,
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [projectId, layerIds, layerIdsFilter, currentUserId, queryClient]);
}
