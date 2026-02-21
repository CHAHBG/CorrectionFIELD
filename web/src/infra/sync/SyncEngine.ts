// =====================================================
//  FieldCorrect — Sync Engine (offline push/pull)
// =====================================================

import { db } from '@/infra/db/schema';
import { supabase } from '@/infra/supabase';
import type { SyncOp, FeatureStatus } from '@/shared/types';
import type { Geometry } from 'geojson';

export class SyncEngine {
  private running = false;
  private activeLayerIds: string[] = [];

  setActiveLayerIds(ids: string[]) {
    this.activeLayerIds = ids;
  }

  start() {
    window.addEventListener('online', () => this.run());
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker?.addEventListener('message', (e) => {
        if ((e.data as { type?: string })?.type === 'BACKGROUND_SYNC') {
          this.run();
        }
      });
    }
    if (navigator.onLine) this.run();
  }

  async run() {
    if (this.running || !navigator.onLine) return;
    this.running = true;

    try {
      // 1. PUSH — drain offline queue in order
      const ops = await db.syncQueue.orderBy('id').toArray();
      for (const op of ops) {
        try {
          await this.executeOp(op);
          if (op.id !== undefined) {
            await db.syncQueue.delete(op.id);
          }
        } catch (err: unknown) {
          const error = err as { isConflict?: boolean };
          if (error.isConflict) {
            await this.handleConflict(op);
          } else if (op.id !== undefined) {
            await db.syncQueue.update(op.id, { attempts: op.attempts + 1 });
          }
        }
      }

      // 2. PULL — fetch changes since last sync
      const lastSync = localStorage.getItem('last_sync_at') ?? '1970-01-01T00:00:00Z';

      if (this.activeLayerIds.length > 0) {
        const { data: changes } = await supabase
          .from('features')
          .select('*')
          .gte('updated_at', lastSync)
          .in('layer_id', this.activeLayerIds);

        // 3. UPSERT local
        if (changes && changes.length > 0) {
          await db.features.bulkPut(
            changes.map((row: Record<string, unknown>) => ({
              id: row.id as string,
              layerId: row.layer_id as string,
              geom: row.geom as unknown as Geometry,
              props: (row.props ?? {}) as Record<string, unknown>,
              status: (row.status ?? 'pending') as FeatureStatus,
              lockedBy: (row.locked_by as string | null) ?? null,
              lockedAt: (row.locked_at as string | null) ?? null,
              lockExpires: (row.lock_expires as string | null) ?? null,
              correctedBy: (row.corrected_by as string | null) ?? null,
              correctedAt: (row.corrected_at as string | null) ?? null,
              validatedBy: (row.validated_by as string | null) ?? null,
              validatedAt: (row.validated_at as string | null) ?? null,
              sourceFile: row.source_file as string | undefined,
              createdAt: row.created_at as string,
              updatedAt: row.updated_at as string,
            }))
          );
        }
      }

      localStorage.setItem('last_sync_at', new Date().toISOString());
    } finally {
      this.running = false;
    }
  }

  private async executeOp(op: SyncOp): Promise<void> {
    const table = op.entityType === 'feature' ? 'features'
      : op.entityType === 'correction' ? 'corrections'
        : 'layers';

    switch (op.op) {
      case 'INSERT': {
        const { error } = await supabase.from(table).insert(op.payload);
        if (error) throw error;
        break;
      }
      case 'UPDATE': {
        const { error } = await supabase.from(table).update(op.payload).eq('id', op.entityId);
        if (error) throw error;
        break;
      }
      case 'DELETE': {
        const { error } = await supabase.from(table).delete().eq('id', op.entityId);
        if (error) throw error;
        break;
      }
    }
  }

  private async handleConflict(_op: SyncOp): Promise<void> {
    // Mark as conflict for manual resolution
    console.warn('Sync conflict detected:', _op);
  }

  async queueOp(op: Omit<SyncOp, 'id' | 'createdAt' | 'attempts'>): Promise<void> {
    await db.syncQueue.add({
      ...op,
      createdAt: new Date().toISOString(),
      attempts: 0,
    });
  }
}

export const syncEngine = new SyncEngine();
