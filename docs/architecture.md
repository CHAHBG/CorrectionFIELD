# Architecture mobile SIG — PROCASEF CorrectionFIELD

> Application Flutter offline-first pour la correction foncière de parcelles
> orphelines sur 17 communes du projet PROCASEF au Sénégal.

## Vue d'ensemble

| Composant | Technologie |
|-----------|-------------|
| Framework | Flutter 3.x (Dart) |
| Carte | MapLibre GL |
| Base locale | SQLite + R-Tree (via `sqflite`) |
| State mgmt | Riverpod |
| Sync | Delta push/pull (dio) |
| Kobo | Deep Link / Intent + API |
| GPS | Geolocator |
| Coord. sys. | Import: UTM 28N → WGS84 |

## 1) Architecture du projet (Clean Architecture)

```
lib/
  main.dart                              # Entry point + DB init
  app/
    app.dart                             # MaterialApp, routes, theme
    theme.dart                           # High-contrast field theme
    di/
      providers.dart                     # Riverpod DI (DB, DAOs, repos, services)
  data/
    local/
      db/
        app_database.dart                # SQLite open, schema, R-Tree helpers
      dao/
        parcels_dao.dart                 # R-Tree spatial queries on parcels
        communes_dao.dart                # Point-in-polygon commune lookup
        corrections_dao.dart             # CRUD + sync log
    repositories/
      parcels_repository.dart            # Geofenced parcel queries
      corrections_repository.dart        # Validation + save + sync payload
  domain/
    entities/
      parcel.dart                        # Parcel entity (ParcelType, ParcelStatus)
      commune.dart                       # Commune entity
      correction.dart                    # Correction entity
    usecases/
      get_visible_parcels.dart           # GPS → commune → parcels
      save_correction.dart               # Validate + persist
      sync_deltas.dart                   # Push/pull orchestration
  presentation/
    state/
      gps_provider.dart                  # Live GPS StateNotifier
      map_provider.dart                  # Map + geofence state
    screens/
      map_screen.dart                    # MapLibre + overlay UI
      correction_form_screen.dart        # Correction form
      import_screen.dart                 # GeoPackage import UI
    widgets/
      gps_accuracy_badge.dart            # Color-coded GPS badge
      commune_chip.dart                  # Current commune indicator
      parcel_info_sheet.dart             # Bottom sheet for parcel details
      parcel_filter_bar.dart             # Filter: tout/sans_enquete/sans_numero
      sync_status_indicator.dart         # Sync badge in app bar
  services/
    geofencing_service.dart              # GPS stream + commune detection
    topo_validator.dart                  # Self-intersection detection
    delta_sync_service.dart              # Offline delta queue
    kobo_bridge.dart                     # Deep link + API to Kobo
    gpkg_import_service.dart             # GeoPackage → SQLite importer
  utils/
    utm_converter.dart                   # EPSG:32628 → EPSG:4326
    gpkg_binary_parser.dart              # Parse GeoPackage Binary (GPKB → WKB)
    geometry_utils.dart                  # Point-in-polygon, bbox, intersection
    geojson_builder.dart                 # Build GeoJSON for MapLibre
assets/
  schema.sql                             # Full DB schema with R-Tree
  map_style.json                         # MapLibre base style
data/                                    # Source GeoPackage files (not bundled)
  Communes Boundou Procasef/             # 17 commune boundaries (.gpkg)
  Parcelles_sans_Enquete/                # ~1,700 parcels without survey
  Parcelles_sans_Numero/                 # ~1,225 parcels without number
```

## 2) Schéma de la base de données locale

### Tables principales

| Table | Rôle | Index spatial |
|-------|------|---------------|
| `communes` | Limites des 17 communes (MultiPolygon WGS84) | R-Tree `rtree_communes` |
| `parcels` | Parcelles orphelines (sans enquête / sans numéro) | R-Tree `rtree_parcels` |
| `corrections` | Corrections terrain (saisie enquêteur) | UUID unique |
| `sync_log` | Journal des deltas pour synchronisation | Index pending |
| `app_meta` | Métadonnées (last_sync_at, import_version) | — |

### Géométries

- Stockées en **GeoJSON texte** (pas WKB) pour consommation directe MapLibre
- Bounding box (min_x, min_y, max_x, max_y) dupliqué en colonnes pour R-Tree
- Coordonnées en **WGS84 (EPSG:4326)** — converties depuis UTM 28N à l'import

### R-Tree (indexation spatiale)

```sql
-- SQLite built-in R-Tree (pas besoin de SpatiaLite !)
CREATE VIRTUAL TABLE rtree_communes USING rtree(id, min_x, max_x, min_y, max_y);
CREATE VIRTUAL TABLE rtree_parcels USING rtree(id, min_x, max_x, min_y, max_y);
```

**Performance** : Le R-Tree réduit une recherche de 10 000 polygones à ~5-20 candidats
en O(log n), puis le point-in-polygon (ray-casting) filtre les faux positifs.

### Schéma complet (assets/schema.sql)

```sql
CREATE TABLE communes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  commune_ref TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  region TEXT,
  department TEXT,
  geom_json TEXT NOT NULL,        -- GeoJSON MultiPolygon
  min_x REAL NOT NULL,
  min_y REAL NOT NULL,
  max_x REAL NOT NULL,
  max_y REAL NOT NULL,
  superficie_ha REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE parcels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  num_parcel TEXT,
  commune_ref TEXT NOT NULL,
  parcel_type TEXT NOT NULL CHECK(parcel_type IN ('sans_enquete','sans_numero')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','corrected','validated','synced')),
  geom_json TEXT NOT NULL,        -- GeoJSON Polygon
  min_x REAL, min_y REAL, max_x REAL, max_y REAL,
  source_file TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_deleted INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(commune_ref) REFERENCES communes(commune_ref)
);

CREATE TABLE corrections (
  uuid TEXT PRIMARY KEY,
  parcel_id INTEGER NOT NULL,
  num_parcel TEXT NOT NULL,
  enqueteur TEXT NOT NULL,
  notes TEXT,
  gps_latitude REAL,
  gps_longitude REAL,
  gps_accuracy REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  dirty INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(parcel_id) REFERENCES parcels(id)
);

CREATE UNIQUE INDEX idx_parcels_num_unique
  ON parcels(num_parcel) WHERE num_parcel IS NOT NULL AND num_parcel != '0';

CREATE TABLE sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('insert','update','delete')),
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  synced_at TEXT
);

CREATE TABLE app_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

## 3) Filtrage spatial par commune (Géofencing)

### Algorithme complet

```
GPS Position (lat, lng)
       │
       ▼
┌──────────────┐     R-Tree bbox filter
│ rtree_communes│ ──→ Candidats (1-3 communes)
└──────────────┘
       │
       ▼
┌──────────────┐     Ray-casting point-in-polygon
│ Dart runtime  │ ──→ Commune identifiée
└──────────────┘
       │
       ▼
┌──────────────┐     SQL WHERE commune_ref = ?
│ parcels table │ ──→ Parcelles filtrées
└──────────────┘
```

### Implémentation (CommunesDao)

```dart
// 1. R-Tree: trouver les communes dont le bbox contient le point
SELECT c.* FROM communes c
INNER JOIN rtree_communes r ON c.id = r.id
WHERE r.min_x <= :lng AND r.max_x >= :lng
  AND r.min_y <= :lat AND r.max_y >= :lat

// 2. Dart: point-in-polygon sur les candidats
GeometryUtils.pointInMultiPolygon([lng, lat], communeCoords)

// 3. SQL: charger les parcelles de la commune
SELECT * FROM parcels
WHERE commune_ref = :ref AND is_deleted = 0
```

### Viewport query (R-Tree optimisé)

```sql
SELECT p.* FROM parcels p
INNER JOIN rtree_parcels r ON p.id = r.id
WHERE r.min_x <= :maxLng AND r.max_x >= :minLng
  AND r.min_y <= :maxLat AND r.max_y >= :minLat
  AND p.commune_ref = :ref
```

## 4) Validation des données

### Unicité `num_parcel`

- **SQL** : `CREATE UNIQUE INDEX idx_parcels_num_unique ON parcels(num_parcel) WHERE num_parcel IS NOT NULL AND num_parcel != '0'`
- **Dart** : Vérification dans `CorrectionsRepository.isNumParcelTaken()` avant save
- **UI** : Message d'erreur inline dans le formulaire

### Topologie (auto-intersection)

- **Service** : `TopoValidator.validateGeoJson(geomJson)` 
- **Algorithme** : Brute-force segment-vs-segment O(n²) — suffisant pour < 200 sommets
- **Validations** : anneau fermé, minimum 4 points, surface non nulle, pas d'auto-intersection

## 5) Bridge KoboToolbox

### Deep Link (prioritaire — fonctionne offline)

```
kobo-collect://form/{formId}?d[num_parcel]=0532010100638&d[commune_ref]=05320101&...
```

Fallback : `odkcollect://form/...` puis formulaire web.

### Mapping des champs

| CorrectionFIELD | Kobo XLSForm |
|------------------|-------------|
| `num_parcel` | `num_parcel` |
| `commune_ref` | `commune_ref` |
| `parcel_type` | `parcel_type` |
| `enqueteur` | `enqueteur` |
| `gps_latitude/longitude` | `gps` |
| `notes` | `notes` |

## 6) Stratégie de synchronisation des deltas

### Modèle

- Champs `dirty` (1 = à pusher), `updated_at` (timestamp UTC)
- Table `sync_log` pour journaliser chaque mutation

### Push (local → serveur)

```
1. SELECT * FROM corrections WHERE dirty = 1
2. POST /api/sync/push {corrections: [...]}
3. Si succès: UPDATE corrections SET dirty = 0 WHERE uuid IN (...)
4. UPDATE sync_log SET synced_at = now() WHERE synced_at IS NULL
```

### Pull (serveur → local)

```
1. GET /api/sync/pull?since={last_sync_at}
2. Pour chaque changement: UPSERT (conflict: latest updated_at wins)
3. UPDATE app_meta SET value = now() WHERE key = 'last_sync_at'
```

## 7) Performance & 10 000 polygones

### Stratégie d'indexation

| Technique | Impact |
|-----------|--------|
| R-Tree (SQLite built-in) | Recherche spatiale O(log n) |
| Filtrage par commune | ~300 parcelles max par commune au lieu de ~3000 |
| Viewport clipping | Seules les parcelles visibles sont chargées |
| GeoJSON en texte | Pas de conversion WKB→GeoJSON à chaque frame |
| Batch insert | Import en batch (commit groupé) |

### Chiffres réels du dataset

| Commune | Sans enquête | Sans numéro | Total |
|---------|-------------|-------------|-------|
| NDOGA BABACAR | 244 | 498 | 742 |
| TOMBORONKOTO | 256 | 85 | 341 |
| MISSIRAH | 198 | 309 | 507 |
| SINTHIOU MALEME | 236 | 60 | 296 |
| ... (13 autres) | ... | ... | ... |
| **TOTAL** | **~1 699** | **~1 225** | **~2 924** |

→ Max ~742 parcelles par commune — largement dans les limites de fluidité.

## 8) Import GeoPackage

### Pipeline

```
.gpkg (EPSG:32628) → GpkgBinaryParser → UTM→WGS84 → GeoJSON → SQLite + R-Tree
```

1. Ouvrir le .gpkg comme base SQLite (read-only)
2. Lire `gpkg_contents` pour trouver la table feature
3. Pour chaque feature : parser le blob GPKB (header GP + WKB)
4. Convertir les coordonnées UTM 28N → WGS84 via `UtmConverter`
5. Calculer le bounding box
6. Insérer dans `communes` ou `parcels` + entrée R-Tree

### Format GPKB (GeoPackage Binary)

```
Bytes 0-1: "GP" magic number
Byte  2:   Version
Byte  3:   Flags (byte-order, envelope type, empty flag)
Bytes 4-7: SRID (int32)
Bytes 8+:  Envelope (varies by type: 32/48/64 bytes)
Then:      Standard WKB geometry
```

### Extraction du nom de commune

Fichiers nommés `NO_SURVEY_NOT_JOINED_MEDINA_BAFFE_LineStringZ_final_PROCESSED.gpkg`
→ Regex: extraction de `MEDINA_BAFFE` → `MEDINA BAFFE`

## 9) UI terrain (haute luminosité)

- **Thème** : Fond blanc, texte gras, contraste élevé
- **GPS badge** : Vert ≤5m / Orange 5–15m / Rouge >15m
- **Commune chip** : Affiche commune active + compteurs
- **Filter bar** : Tout / Sans enquête / Sans numéro
- **Touch targets** : Minimum 48x52px pour usage terrain
- **Orientation** : Portrait forcé

### Couleurs des parcelles (sur carte)

| Type | Status | Couleur |
|------|--------|---------|
| Sans enquête | Pending | Orange (#FF9800) |
| Sans enquête | Corrected | Blue (#2196F3) |
| Sans numéro | Pending | Red (#F44336) |
| Sans numéro | Corrected | Blue (#2196F3) |
| Tout | Validated | Green (#4CAF50) |

---

## 10) Décisions architecturales clés

| Décision | Raison |
|----------|--------|
| **Pure Dart au lieu de SpatiaLite** | Évite la compilation native cross-platform complexe. R-Tree SQLite built-in + ray-casting Dart suffisent pour ~3000 polygones |
| **GeoJSON texte au lieu de WKB** | MapLibre consomme du GeoJSON nativement ; évite la conversion à chaque refresh |
| **UTM→WGS84 à l'import** | Une seule conversion ; toutes les requêtes et l'affichage en WGS84 |
| **Riverpod (pas Bloc)** | Meilleure isolation des providers SIG, moins de boilerplate |
| **UUID pour corrections** | Permet la sync sans conflit d'ID entre devices |
| **commune_ref pré-calculé** | Évite le point-in-polygon à chaque requête parcelle |
