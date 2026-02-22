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

    // Guard: skip if DB not yet initialized
    try {
      localDB.getDB();
    } catch {
      console.warn('[Sync] DB not initialized yet, skipping sync run');
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
                if (upsertErr) { throw upsertErr; }
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

      // Pull layers (always pull all layers for user's projects to ensure new members see them)
      const { data: layers } = await supabase
        .from('layers')
        .select('*');

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

      // Pull project_members to get zones
      const { data: profile } = await supabase.auth.getUser();
      if (profile.user) {
        const { data: members } = await supabase
          .from('project_members')
          .select('project_id, zone')
          .eq('user_id', profile.user.id);

        if (members) {
          for (const m of members) {
            if (m.zone) {
              await db.execute(
                "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
                [`zone_${m.project_id}`, JSON.stringify(m.zone)]
              );
            }
          }
        }
      }

      // Pull features (paginated)
      // Strategy: for each layer, check if we have 0 features. If so, pull all. Otherwise pull delta.
      const localLayers = await localDB.getLayers();

      for (const layer of localLayers) {
        const localCountResult = await db.execute("SELECT COUNT(*) as cnt FROM features WHERE layer_id = ?", [layer.id]);
        const hasFeatures = (localCountResult.rows?.[0]?.cnt as number ?? 0) > 0;

        let offset = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          let query = supabase
            .from('features')
            .select('*')
            .eq('layer_id', layer.id)
            .range(offset, offset + pageSize - 1)
            .order('updated_at', { ascending: true });

          if (hasFeatures) {
            query = query.gte('updated_at', lastSync);
          }

          const { data: features } = await query;

          if (!features || features.length === 0) {
            hasMore = false;
            break;
          }

          for (const f of features) {
            const localFeature = await localDB.getFeatureById(f.id);
            if (localFeature && localFeature.dirty) {
              const conflict: SyncConflict = {
                featureId: f.id,
                localData: localFeature,
                serverData: f,
              };
              conflictCount++;
              this.conflictHandlers.forEach((h) => h(conflict));
            } else {
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
          if (features.length < pageSize) { hasMore = false; }
        }
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
