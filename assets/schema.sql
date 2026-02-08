-- ============================================================
-- PROCASEF CorrectionFIELD — Local Database Schema
-- SQLite + R-Tree spatial indexing
-- EPSG:4326 (WGS 84) — all geometries stored as GeoJSON text
-- ============================================================

-- ── Communes (limites administratives des 17 communes) ──────
CREATE TABLE IF NOT EXISTS communes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  commune_ref   TEXT    UNIQUE NOT NULL,        -- COD_ENTITE (ex: 05320101)
  name          TEXT    NOT NULL,               -- CCRCA (ex: BALA)
  region        TEXT,                           -- REG
  departement   TEXT,                           -- DEPT
  arrondissement TEXT,                          -- CAV
  superficie_ha REAL,                           -- SUP_HA
  -- Bounding box (WGS84) for quick spatial filtering
  min_x         REAL,
  min_y         REAL,
  max_x         REAL,
  max_y         REAL,
  -- Geometry stored as GeoJSON string (MultiPolygon, WGS84)
  geom_json     TEXT    NOT NULL
);

-- R-Tree index on commune bounds for fast point-in-bbox lookup
CREATE VIRTUAL TABLE IF NOT EXISTS rtree_communes USING rtree(
  id,
  min_x, max_x,
  min_y, max_y
);

-- ── Parcelles orphelines (sans enquête / sans numéro) ───────
CREATE TABLE IF NOT EXISTS parcels (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  num_parcel    TEXT,                           -- Num_parcel (NULL or '0' for sans_numero)
  commune_ref   TEXT    NOT NULL,               -- FK vers communes.commune_ref
  parcel_type   TEXT    NOT NULL DEFAULT 'sans_enquete',
                                               -- 'sans_enquete' | 'sans_numero'
  source_file   TEXT,                           -- fichier DXF d'origine
  layer         TEXT,                           -- couche d'origine
  -- Bounding box (WGS84)
  min_x         REAL    NOT NULL,
  min_y         REAL    NOT NULL,
  max_x         REAL    NOT NULL,
  max_y         REAL    NOT NULL,
  -- Geometry stored as GeoJSON string (MultiPolygon, WGS84)
  geom_json     TEXT    NOT NULL,
  -- Sync metadata
  status        TEXT    NOT NULL DEFAULT 'pending',  -- pending | corrected | validated | synced
  updated_at    TEXT    NOT NULL,
  is_deleted    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_parcels_commune
  ON parcels(commune_ref);
CREATE INDEX IF NOT EXISTS idx_parcels_type
  ON parcels(parcel_type);
CREATE INDEX IF NOT EXISTS idx_parcels_status
  ON parcels(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parcels_num_unique
  ON parcels(num_parcel) WHERE num_parcel IS NOT NULL AND num_parcel != '0';

-- R-Tree index on parcel bounds for viewport / proximity queries
CREATE VIRTUAL TABLE IF NOT EXISTS rtree_parcels USING rtree(
  id,
  min_x, max_x,
  min_y, max_y
);

-- ── Corrections (saisies terrain par enquêteur) ─────────────
CREATE TABLE IF NOT EXISTS corrections (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  uuid          TEXT    UNIQUE NOT NULL,        -- UUID v4 for sync
  parcel_id     INTEGER NOT NULL,
  num_parcel    TEXT    NOT NULL,               -- numéro attribué
  enqueteur     TEXT,                           -- nom enquêteur
  survey_status TEXT    NOT NULL DEFAULT 'draft',  -- draft | submitted | synced
  notes         TEXT,
  -- GPS context at correction time
  gps_latitude  REAL,
  gps_longitude REAL,
  gps_accuracy  REAL,
  -- Corrected geometry (optional — if boundary was adjusted)
  geom_json     TEXT,
  -- Sync metadata
  dirty         INTEGER NOT NULL DEFAULT 1,     -- 1 = needs push
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL,
  FOREIGN KEY(parcel_id) REFERENCES parcels(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_corrections_uuid
  ON corrections(uuid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_corrections_num
  ON corrections(num_parcel);
CREATE INDEX IF NOT EXISTS idx_corrections_dirty
  ON corrections(dirty);

-- ── Sync journal (delta tracking) ───────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type   TEXT    NOT NULL,               -- 'correction' | 'parcel'
  entity_id     INTEGER NOT NULL,
  action        TEXT    NOT NULL,               -- 'create' | 'update' | 'delete'
  payload_json  TEXT    NOT NULL,               -- full row as JSON
  created_at    TEXT    NOT NULL,
  synced_at     TEXT                            -- NULL until pushed
);

CREATE INDEX IF NOT EXISTS idx_sync_log_pending
  ON sync_log(synced_at) WHERE synced_at IS NULL;

-- ── App metadata ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
