// =====================================================
//  FieldCorrect — Offline queue hook (Dexie)
// =====================================================

import { useCallback } from 'react';
import { db } from '@/infra/db/schema';
import { syncEngine } from '@/infra/sync/SyncEngine';

/**
 * Hook to enqueue offline mutations.
 * When online, pushes immediately. When offline, stores in Dexie syncQueue.
 */
export function useOfflineQueue() {
  const enqueue = useCallback(
    async (
      op: 'INSERT' | 'UPDATE' | 'DELETE',
      entityType: 'feature' | 'correction' | 'layer',
      entityId: string,
      payload: Record<string, unknown>
    ) => {
      await db.syncQueue.add({
        op,
        entityType,
        entityId,
        payload,
        createdAt: new Date().toISOString(),
        attempts: 0,
      });

      // Try immediate sync if online
      if (navigator.onLine) {
        syncEngine.run();
      }
    },
    []
  );

  const pendingCount = useCallback(async () => {
    return db.syncQueue.count();
  }, []);

  return { enqueue, pendingCount };
}
