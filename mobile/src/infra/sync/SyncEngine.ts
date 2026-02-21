// =====================================================
//  FieldCorrect Mobile — Sync Engine v2
//  Delta push/pull + conflict detection + correction sync
// =====================================================

import { supabase } from '../supabase';
import { localDB } from '../db/LocalDB';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

const MAX_RETRY_ATTEMPTS = 5;
const RETRY_BACKOFF_BASE = 2000; // ms

export interface SyncConflict {
  featureId: string;
  localData: any;
  serverData: any;
}

type ConflictHandler = (conflict: SyncConflict) => void;

class SyncEngine {
  private running = false;
  private interval: ReturnType<typeof setInterval> | null = null;
  private conflictHandlers: ConflictHandler[] = [];
  private _lastSyncResult: { pushed: number; pulled: number; conflicts: number } | null = null;

  get lastSyncResult() {
    return this._lastSyncResult;
  }

  onConflict(handler: ConflictHandler): () => void {
    this.conflictHandlers.push(handler);
    return () => {
      this.conflictHandlers = this.conflictHandlers.filter((h) => h !== handler);
    };
  }

  start(): void {
    // Sync when app comes to foreground
    AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        this.run();
      }
    });

    // Periodic sync every 60 seconds
    this.interval = setInterval(() => this.run(), 60_000);

    // Initial sync
    this.run();
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async run(): Promise<void> {
    if (this.running) {
      return;
    }

    // Check connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return;
    }

    this.running = true;
    let pushedCount = 0;
    let pulledCount = 0;
    let conflictCount = 0;

    try {
      // ═══ 1. PUSH — drain local sync queue ═══
      const ops = await localDB.getPendingSyncOps();

      for (const op of ops) {
        // Skip ops that have exceeded max retries
        if (op.attempts >= MAX_RETRY_ATTEMPTS) {
          console.warn(`[Sync] op #${op.id} exceeded max retries, removing`);
          await localDB.removeSyncOp(op.id);
          continue;
        }

        try {
          const table = op.entity_type === 'feature' ? 'features'
            : op.entity_type === 'correction' ? 'corrections'
            : 'layers';

          if (op.op === 'INSERT') {
            const { error } = await supabase.from(table).insert(op.payload);
            if (error) {
              // Check for conflict (409 or unique violation)
              if (error.code === '23505') {
                // Duplicate key — server already has this record, try upsert
                const { error: upsertErr } = await supabase
                  .from(table)
                  .upsert(op.payload);
                if (upsertErr) {throw upsertErr;}
              } else {
                throw error;
              }
            }
          } else if (op.op === 'UPDATE') {
            const { error } = await supabase.from(table).update(op.payload).eq('id', op.entity_id);
            if (error) {
              throw error;
            }
          } else if (op.op === 'DELETE') {
            const { error } = await supabase.from(table).delete().eq('id', op.entity_id);
            if (error) {
              throw error;
            }
          }

          await localDB.removeSyncOp(op.id);
          pushedCount++;
        } catch (e: any) {
          console.warn(`[Sync] failed op #${op.id} (attempt ${op.attempts + 1})`, e);
          await localDB.incrementSyncAttempts(op.id);

          // Exponential backoff: skip remaining ops if we're getting errors
          if (op.attempts > 2) {
            await delay(RETRY_BACKOFF_BASE * Math.pow(2, op.attempts - 2));
          }
        }
      }

      // ═══ 2. PULL — fetch updated features from server ═══
      const db = localDB.getDB();
      const metaResult = await db.execute("SELECT value FROM app_meta WHERE key = 'last_sync'");
      const lastSync = (metaResult.rows?.[0]?.value as string | undefined) ?? '1970-01-01T00:00:00Z';

      // Pull layers
      const { data: layers } = await supabase
        .from('layers')
        .select('*')
        .gte('updated_at', lastSync);

      if (layers) {
        for (const l of layers) {
          await localDB.upsertLayer({
            id: l.id,
            project_id: l.project_id,
            name: l.name,
            geometry_type: l.geometry_type,
            source_crs: l.source_crs,
            fields: l.fields,
            style: l.style,
            visible: true,
            sort_order: l.sort_order ?? 0,
          });
        }
      }

      // Pull features (paginated)
      let offset = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: features } = await supabase
          .from('features')
          .select('*')
          .gte('updated_at', lastSync)
          .range(offset, offset + pageSize - 1)
          .order('updated_at', { ascending: true });

        if (!features || features.length === 0) {
          hasMore = false;
          break;
        }

        for (const f of features) {
          // Check for conflict: local dirty + server updated
          const localFeature = await localDB.getFeatureById(f.id);

          if (localFeature && localFeature.dirty) {
            // CONFLICT: local modified + server modified
            const conflict: SyncConflict = {
              featureId: f.id,
              localData: localFeature,
              serverData: f,
            };
            conflictCount++;
            this.conflictHandlers.forEach((h) => h(conflict));
            // Don't overwrite local — user must resolve
          } else {
            // No conflict: server wins
            await localDB.upsertFeature({
              id: f.id,
              layer_id: f.layer_id,
              geom: f.geom,
              props: f.props,
              status: f.status,
              dirty: false,
            });
            pulledCount++;
          }
        }

        offset += features.length;
        if (features.length < pageSize) {hasMore = false;}
      }

      // ═══ 3. PULL corrections (new) ═══
      const { data: corrections } = await supabase
        .from('corrections')
        .select('*')
        .gte('created_at', lastSync)
        .limit(1000);

      if (corrections) {
        for (const c of corrections) {
          await localDB.insertCorrection({
            id: c.id,
            feature_id: c.feature_id,
            layer_id: c.layer_id ?? '',
            user_id: c.user_id,
            props_patch: c.props_patch ?? {},
            geom_corrected: c.geom_corrected,
            notes: c.notes ?? '',
            gps_lat: c.gps_point?.coordinates?.[1] ?? null,
            gps_lng: c.gps_point?.coordinates?.[0] ?? null,
            gps_accuracy: c.gps_accuracy ?? null,
            media_urls: c.media_urls ?? [],
            status: c.status ?? 'submitted',
            dirty: false,
          }).catch(() => {
            // Ignore duplicate key errors
          });
        }
      }

      // ═══ 4. Expire stale locks locally ═══
      await db.execute(
        "UPDATE features SET status = 'pending', locked_by = NULL, locked_at = NULL WHERE status = 'locked' AND locked_at IS NOT NULL AND datetime(locked_at, '+30 minutes') < datetime('now')",
      );

      // ═══ 5. Update last sync timestamp ═══
      const now = new Date().toISOString();
      await db.execute(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('last_sync', ?)",
        [now],
      );

      this._lastSyncResult = { pushed: pushedCount, pulled: pulledCount, conflicts: conflictCount };
      console.log(
        `[Sync] complete. Pushed ${pushedCount}, pulled ${pulledCount}, conflicts ${conflictCount}`,
      );
    } catch (e) {
      console.error('[Sync] error', e);
    } finally {
      this.running = false;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const syncEngine = new SyncEngine();
