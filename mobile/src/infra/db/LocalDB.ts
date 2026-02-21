// =====================================================
//  FieldCorrect Mobile — Local database (op-sqlite)
// =====================================================

import { open, type DB } from '@op-engineering/op-sqlite';

const DB_NAME = 'FieldCorrect.db';

export class LocalDB {
  private static instance: LocalDB;
  private db: DB | null = null;

  private constructor() {}

  static getInstance(): LocalDB {
    if (!LocalDB.instance) {
      LocalDB.instance = new LocalDB();
    }
    return LocalDB.instance;
  }

  async init(): Promise<void> {
    if (this.db) {
      return;
    }

    try {
      this.db = open({ name: DB_NAME });
      console.log('[LocalDB] opened');
      await this.runMigrations();
    } catch (e) {
      console.error('[LocalDB] failed to open', e);
      throw e;
    }
  }

  private async runMigrations(): Promise<void> {
    if (!this.db) {
      return;
    }

    // ── Meta table ──
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

    // ── Features (local cache) ──
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS features (
        id TEXT PRIMARY KEY,
        layer_id TEXT NOT NULL,
        geom TEXT NOT NULL,
        props TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'draft',
        locked_by TEXT,
        locked_at TEXT,
        corrected_by TEXT,
        corrected_at TEXT,
        validated_by TEXT,
        validated_at TEXT,
        source_file TEXT,
        dirty INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
    await this.db.execute('CREATE INDEX IF NOT EXISTS idx_features_layer ON features(layer_id);');
    await this.db.execute('CREATE INDEX IF NOT EXISTS idx_features_status ON features(status);');

    // ── Layers ──
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS layers (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        geometry_type TEXT NOT NULL,
        source_crs TEXT DEFAULT 'EPSG:4326',
        fields TEXT NOT NULL DEFAULT '[]',
        style TEXT NOT NULL DEFAULT '{}',
        visible INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // ── Corrections ──
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS corrections (
        id TEXT PRIMARY KEY,
        feature_id TEXT NOT NULL,
        layer_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        props_patch TEXT,
        geom_corrected TEXT,
        notes TEXT,
        gps_lat REAL,
        gps_lng REAL,
        gps_accuracy REAL,
        media_urls TEXT DEFAULT '[]',
        status TEXT DEFAULT 'submitted',
        reviewed_by TEXT,
        reviewed_at TEXT,
        review_notes TEXT,
        dirty INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    await this.db.execute('CREATE INDEX IF NOT EXISTS idx_corrections_feature ON corrections(feature_id);');

    // ── Sync queue ──
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        op TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        attempts INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // ── Tile cache ──
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS tile_cache (
        key TEXT PRIMARY KEY,
        data BLOB,
        expires INTEGER
      );
    `);

    console.log('[LocalDB] migrations complete');
  }

  getDB(): DB {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  // ── Feature helpers ──────────────────────────────

  async upsertFeature(f: {
    id: string;
    layer_id: string;
    geom: any;
    props: Record<string, unknown>;
    status: string;
    dirty?: boolean;
  }): Promise<void> {
    const conn = this.getDB();
    await conn.execute(
      `INSERT OR REPLACE INTO features (id, layer_id, geom, props, status, dirty, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [f.id, f.layer_id, JSON.stringify(f.geom), JSON.stringify(f.props), f.status, f.dirty ? 1 : 0]
    );
  }

  async getFeaturesByLayer(layerId: string): Promise<any[]> {
    const conn = this.getDB();
    const result = await conn.execute(
      'SELECT * FROM features WHERE layer_id = ? ORDER BY created_at',
      [layerId]
    );
    return (result.rows ?? []).map(this.parseFeatureRow);
  }

  async getFeatureById(id: string): Promise<any | null> {
    const conn = this.getDB();
    const result = await conn.execute('SELECT * FROM features WHERE id = ?', [id]);
    const rows = result.rows ?? [];
    return rows.length > 0 ? this.parseFeatureRow(rows[0]) : null;
  }

  async getDirtyFeatures(): Promise<any[]> {
    const conn = this.getDB();
    const result = await conn.execute('SELECT * FROM features WHERE dirty = 1');
    return (result.rows ?? []).map(this.parseFeatureRow);
  }

  private parseFeatureRow(row: any) {
    return {
      ...row,
      geom: typeof row.geom === 'string' ? JSON.parse(row.geom) : row.geom,
      props: typeof row.props === 'string' ? JSON.parse(row.props) : row.props,
    };
  }

  // ── Layer helpers ────────────────────────────────

  async upsertLayer(l: any): Promise<void> {
    const conn = this.getDB();
    await conn.execute(
      `INSERT OR REPLACE INTO layers (id, project_id, name, geometry_type, source_crs, fields, style, visible, sort_order, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [l.id, l.project_id, l.name, l.geometry_type, l.source_crs ?? 'EPSG:4326',
       JSON.stringify(l.fields ?? []), JSON.stringify(l.style ?? {}), l.visible ? 1 : 0, l.sort_order ?? 0]
    );
  }

  async getLayers(projectId?: string): Promise<any[]> {
    const conn = this.getDB();
    const sql = projectId
      ? 'SELECT * FROM layers WHERE project_id = ? ORDER BY sort_order'
      : 'SELECT * FROM layers ORDER BY sort_order';
    const result = await conn.execute(sql, projectId ? [projectId] : []);
    return (result.rows ?? []).map((row: any) => ({
      ...row,
      fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields,
      style: typeof row.style === 'string' ? JSON.parse(row.style) : row.style,
      visible: !!row.visible,
    }));
  }

  // ── Correction helpers ───────────────────────────

  async insertCorrection(c: any): Promise<void> {
    const conn = this.getDB();
    await conn.execute(
      `INSERT INTO corrections (id, feature_id, layer_id, user_id, props_patch, geom_corrected, notes, gps_lat, gps_lng, gps_accuracy, media_urls, status, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.feature_id, c.layer_id, c.user_id,
       JSON.stringify(c.props_patch ?? {}), c.geom_corrected ? JSON.stringify(c.geom_corrected) : null,
       c.notes ?? '', c.gps_lat ?? null, c.gps_lng ?? null, c.gps_accuracy ?? null,
       JSON.stringify(c.media_urls ?? []), c.status ?? 'submitted', c.dirty ? 1 : 0]
    );
  }

  async getCorrectionsByFeature(featureId: string): Promise<any[]> {
    const conn = this.getDB();
    const result = await conn.execute(
      'SELECT * FROM corrections WHERE feature_id = ? ORDER BY created_at DESC',
      [featureId]
    );
    return (result.rows ?? []).map((row: any) => ({
      ...row,
      props_patch: typeof row.props_patch === 'string' ? JSON.parse(row.props_patch) : row.props_patch,
      geom_corrected: row.geom_corrected ? JSON.parse(row.geom_corrected) : null,
      media_urls: typeof row.media_urls === 'string' ? JSON.parse(row.media_urls) : row.media_urls,
    }));
  }

  // ── Sync queue helpers ───────────────────────────

  async enqueueSyncOp(op: string, entityType: string, entityId: string, payload: any): Promise<void> {
    const conn = this.getDB();
    await conn.execute(
      'INSERT INTO sync_queue (op, entity_type, entity_id, payload) VALUES (?, ?, ?, ?)',
      [op, entityType, entityId, JSON.stringify(payload)]
    );
  }

  async getPendingSyncOps(): Promise<any[]> {
    const conn = this.getDB();
    const result = await conn.execute('SELECT * FROM sync_queue ORDER BY id ASC');
    return (result.rows ?? []).map((row: any) => ({
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    }));
  }

  async removeSyncOp(id: number): Promise<void> {
    const conn = this.getDB();
    await conn.execute('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  async incrementSyncAttempts(id: number): Promise<void> {
    const conn = this.getDB();
    await conn.execute('UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?', [id]);
  }

  async getSyncQueueCount(): Promise<number> {
    const conn = this.getDB();
    const result = await conn.execute('SELECT COUNT(*) as cnt FROM sync_queue');
    return (result.rows?.[0]?.cnt as number | undefined) ?? 0;
  }

  // ── GeoPackage support ───────────────────────────

  async attachGeoPackage(filePath: string, alias: string): Promise<void> {
    const conn = this.getDB();
    try {
      await conn.execute(`ATTACH DATABASE '${filePath}' AS ${alias}`);
      console.log(`[LocalDB] attached ${alias}`);
    } catch (e) {
      console.error(`[LocalDB] failed to attach ${alias}`, e);
    }
  }

  async detachGeoPackage(alias: string): Promise<void> {
    const conn = this.getDB();
    try {
      await conn.execute(`DETACH DATABASE ${alias}`);
    } catch (e) {
      console.error(`[LocalDB] failed to detach ${alias}`, e);
    }
  }
}

export const localDB = LocalDB.getInstance();
