// =====================================================
//  FieldCorrect Mobile — Realtime Subscriptions Hook
//  v2: Feature changes, locks, presence via WebSocket
// =====================================================

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/infra/supabase';
import { localDB } from '@/infra/db/LocalDB';
import { useProjectStore } from '@/stores/projectStore';
import { useLayerStore } from '@/stores/layerStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface RealtimeCallbacks {
  onFeatureUpdate?: (feature: any) => void;
  onCorrectionInsert?: (correction: any) => void;
  onLockChange?: (featureId: string, lockedBy: string | null) => void;
  onPresenceSync?: (users: { userId: string; name: string }[]) => void;
}

/**
 * Hook that subscribes to Supabase Realtime channels for:
 * - Feature status/lock changes (postgres_changes)
 * - New corrections
 * - User presence (who's online, what area they're viewing)
 */
export function useProjectRealtime(callbacks?: RealtimeCallbacks) {
  const { currentProject, user } = useProjectStore();
  const { layers } = useLayerStore();
  const channelRef = useRef<RealtimeChannel | null>(null);

  const handleFeatureChange = useCallback(
    async (payload: any) => {
      const record = payload.new ?? payload.record;
      if (!record) {return;}

      // Update local DB cache
      try {
        await localDB.upsertFeature({
          id: record.id,
          layer_id: record.layer_id,
          geom: record.geom,
          props: record.props,
          status: record.status,
          dirty: false,
        });
      } catch (e) {
        console.warn('[Realtime] local upsert failed:', e);
      }

      // Notify lock changes
      if (callbacks?.onLockChange) {
        callbacks.onLockChange(record.id, record.locked_by);
      }

      // General update callback
      callbacks?.onFeatureUpdate?.(record);
    },
    [callbacks],
  );

  const handleCorrectionInsert = useCallback(
    (payload: any) => {
      const record = payload.new ?? payload.record;
      if (!record) {return;}
      // Skip our own corrections
      if (record.user_id === user?.id) {return;}
      callbacks?.onCorrectionInsert?.(record);
    },
    [callbacks, user?.id],
  );

  useEffect(() => {
    if (!currentProject?.id) {return;}

    // Get active layer IDs for this project
    const layerIds = layers
      .filter((l) => l.project_id === currentProject.id)
      .map((l) => l.id);

    if (layerIds.length === 0) {return;}

    const channelName = `project:${currentProject.id}`;

    // Create channel with postgres changes
    const channel = supabase
      .channel(channelName)
      // Listen for feature updates (lock/unlock/status)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'features',
          filter: `layer_id=in.(${layerIds.join(',')})`,
        },
        handleFeatureChange,
      )
      // Listen for new corrections
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'corrections',
        },
        handleCorrectionInsert,
      )
      // Presence tracking
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state)
          .flat()
          .map((p: any) => ({
            userId: p.user_id,
            name: p.user_name ?? 'Anonymous',
          }));
        callbacks?.onPresenceSync?.(users);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED' && user) {
          // Track our presence
          await channel.track({
            user_id: user.id,
            user_name: user.full_name || user.email,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [
    currentProject?.id,
    layers,
    user,
    handleFeatureChange,
    handleCorrectionInsert,
    callbacks,
  ]);

  return channelRef.current;
}

/**
 * Subscribe to feature lock changes for a specific layer.
 * Returns a cleanup function.
 */
export function subscribeToLayerLocks(
  layerId: string,
  onLockChange: (featureId: string, lockedBy: string | null, lockExpires: string | null) => void,
): () => void {
  const channel = supabase
    .channel(`locks:${layerId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'features',
        filter: `layer_id=eq.${layerId}`,
      },
      (payload: any) => {
        const f = payload.new;
        if (f) {
          onLockChange(f.id, f.locked_by, f.lock_expires);
        }
      },
    )
    .subscribe();

  return () => channel.unsubscribe();
}
