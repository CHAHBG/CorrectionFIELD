-- Communes
CREATE TABLE IF NOT EXISTS communes (
  id INTEGER PRIMARY KEY,
  commune_ref TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  geom BLOB
);

-- Parcelles
CREATE TABLE IF NOT EXISTS parcels (
  id INTEGER PRIMARY KEY,
  num_parcel TEXT,
  commune_ref TEXT NOT NULL,
  geom BLOB NOT NULL,
  updated_at TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0
);

-- Corrections
CREATE TABLE IF NOT EXISTS corrections (
  id INTEGER PRIMARY KEY,
  parcel_id INTEGER,
  num_parcel TEXT NOT NULL,
  survey_status TEXT NOT NULL,
  geom BLOB NOT NULL,
  gps_accuracy REAL,
  updated_at TEXT NOT NULL,
  dirty INTEGER DEFAULT 1,
  FOREIGN KEY(parcel_id) REFERENCES parcels(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_parcels_num_parcel
  ON parcels(num_parcel) WHERE num_parcel IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_corrections_num_parcel
  ON corrections(num_parcel);
