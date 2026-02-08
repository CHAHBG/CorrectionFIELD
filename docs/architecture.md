# Architecture mobile SIG — PROCASEF (Correction foncière)

## 1) Architecture globale du projet

### Flutter (exemple) — dossiers & responsabilités
```
lib/
  app/
    app.dart                      # App root (routes, thèmes)
    di/                           # Injection (get_it/riverpod)
  data/
    local/
      db/
        app_database.dart         # SQLite/SpatiaLite init + migrations
        spatialite_loader.dart    # Chargement extension SpatiaLite
      dao/
        parcels_dao.dart          # Requêtes spatiales/parcelles
        surveys_dao.dart          # Corrections, enquêtes
      models/
        parcel_row.dart           # Row mapping (raw SQLite)
        correction_row.dart
    remote/
      kobo_api.dart               # REST client KoboToolbox
      sync_api.dart               # API serveur central (deltas)
    repositories/
      parcels_repository.dart     # Offline-first, cache + sync
      corrections_repository.dart
  domain/
    entities/
      parcel.dart
      correction.dart
      commune.dart
    usecases/
      get_visible_parcels.dart    # filtre spatial/commune
      save_correction.dart        # validation + persistence
      sync_deltas.dart
  presentation/
    state/
      map_provider.dart           # état carte + géofencing
      gps_provider.dart           # précision GPS, status
    screens/
      map_screen.dart
      correction_form_screen.dart
    widgets/
      gps_accuracy_badge.dart
      commune_chip.dart
  services/
    geofencing_service.dart       # position + commune lookup
    topo_validator.dart           # auto-intersection
    kobo_bridge.dart              # deep links/intent
    delta_sync_service.dart       # empaquetage des modifications
  assets/
    map_style.json                # style MapLibre/Mapbox
```

### React Native (équivalent)
```
src/
  app/                            # navigation, thème
  data/                           # db, api, repositories
  domain/                         # entities + usecases
  presentation/                   # screens, components
  services/                       # geofencing, topo validation, sync
```

### Providers / State Management
- **Flutter**: Riverpod/Bloc (préférer Riverpod pour isolation des providers SIG).
- **React Native**: Zustand/Redux Toolkit + RTK Query pour sync.

### Services clés
- **GeofencingService** : détermination de la commune via position (point-in-polygon / lookup dans table Communes).
- **DeltaSyncService** : push/pull des modifications (timestamps + status `dirty`).
- **TopoValidator** : vérifie auto-intersections avant save (lib: `turf`, `jts`, `geolib`).
- **KoboBridge** : pré-remplissage via Intent/DeepLink vers Kobo.

## 2) Schéma de base locale (SQLite + SpatiaLite)

```sql
-- Communes (limites administratives)
CREATE TABLE communes (
  id INTEGER PRIMARY KEY,
  commune_ref TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  geom GEOMETRY  -- Polygon
);

-- Parcelles orphelines / base PROCASEF (PolygonZ)
CREATE TABLE parcels (
  id INTEGER PRIMARY KEY,
  num_parcel TEXT,                -- peut être NULL si orpheline
  commune_ref TEXT NOT NULL,
  geom GEOMETRY NOT NULL,         -- PolygonZ (stored as WKB)
  updated_at TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0
);

-- Corrections terrain (saisie enquêteur)
CREATE TABLE corrections (
  id INTEGER PRIMARY KEY,
  parcel_id INTEGER,
  num_parcel TEXT NOT NULL,
  survey_status TEXT NOT NULL,
  geom GEOMETRY NOT NULL,
  gps_accuracy REAL,
  updated_at TEXT NOT NULL,
  dirty INTEGER DEFAULT 1,
  FOREIGN KEY(parcel_id) REFERENCES parcels(id)
);

-- Index uniques / contraintes
CREATE UNIQUE INDEX idx_parcels_num_parcel
  ON parcels(num_parcel) WHERE num_parcel IS NOT NULL;
CREATE UNIQUE INDEX idx_corrections_num_parcel
  ON corrections(num_parcel);

-- R-Tree pour requêtes spatiales (SpatiaLite)
SELECT CreateSpatialIndex('parcels', 'geom');
SELECT CreateSpatialIndex('communes', 'geom');
```

## 3) Filtrage spatial par commune (code snippet)

### Flutter/Dart (pseudo SQL SpatiaLite)
```dart
/// Retourne les parcelles visibles pour la commune GPS courante
Future<List<Parcel>> getVisibleParcelsForGps(Position pos) async {
  // 1) Trouver la commune qui contient le point GPS
  final communeRow = await db.rawQuery('''
    SELECT commune_ref
    FROM communes
    WHERE ST_Contains(geom, MakePoint(?, ?, 4326))
    LIMIT 1
  ''', [pos.longitude, pos.latitude]);

  if (communeRow.isEmpty) return [];
  final communeRef = communeRow.first['commune_ref'] as String;

  // 2) Charger uniquement les parcelles de la commune
  final parcelRows = await db.rawQuery('''
    SELECT *
    FROM parcels
    WHERE commune_ref = ?
      AND is_deleted = 0
  ''', [communeRef]);

  return parcelRows.map(Parcel.fromRow).toList();
}
```

### Variante optimisée (cache spatial)
- Pré-calculer `commune_ref` dans `parcels` via jointure au moment d’import.
- Index `commune_ref` + R-Tree sur `geom` pour découpes par bounding box.

## 4) Validation des données

- **Unicité `num_parcel`**: contrainte UNIQUE + vérification UI avant save.
- **Topologie**: empêcher auto-intersection avec `ST_IsValid(geom)` côté DB.
  - En Dart/JS, fallback via `turf.booleanValid` ou `JTS IsValidOp`.

Exemple:
```sql
SELECT ST_IsValid(geom) AS valid FROM corrections WHERE id = ?;
```

## 5) KoboToolbox Bridge

- **Option API**: envoyer JSON vers Kobo (pré-remplissage via `submission`).
- **Option DeepLink/Intent**: ouvrir Kobo Collect avec un `content://` ou `file://`.

Pseudo workflow:
1. Générer payload JSON (corrections locales).
2. Mapper champs -> IDs Kobo.
3. Lancer Intent/deeplink vers Kobo Collect.

## 6) Stratégie de synchronisation des deltas

### Modèle
- Champs `updated_at`, `dirty`, `is_deleted`.
- Table `sync_queue` pour journaliser les changements (optional).

### Push
- Sélectionner `dirty=1`.
- Envoyer patches (diff ou full row) avec `updated_at`.
- Sur succès: `dirty=0` + stocker `server_revision`.

### Pull
- Garder `last_sync_at`.
- Pull `/changes?since=last_sync_at`.
- Appliquer upsert (si conflit: règle "latest wins" ou merge manuel).

## 7) Performance & indexation spatiale

- **R-Tree** via `CreateSpatialIndex()` sur `parcels.geom`.
- Requêtes basées sur `ST_Intersects` + `BuildMbr()` pour limiter scan.
- Sur carte: utiliser tuiles vectorielles locales (mbtiles) ou segmentation par commune.
- Chargement progressif (pagination + viewport).

Exemple de requête spatiale optimisée:
```sql
SELECT * FROM parcels
WHERE commune_ref = ?
  AND ROWID IN (
    SELECT pkid FROM idx_parcels_geom
    WHERE xmin <= ? AND xmax >= ? AND ymin <= ? AND ymax >= ?
  );
```

## 8) UI terrain (haute luminosité)

- Thème **High-Contrast** (fond clair, icônes épaisses).
- Indicateur précision GPS: vert (<5m), orange (5–15m), rouge (>15m).
- Bouton « Sync » visible + statut offline.

---

## Notes d’implémentation pour 10 000 polygones
- Eviter de charger tous les polygones en mémoire: filtrage par commune + viewport.
- Cacher les GeoJSON en mémoire seulement pour la commune active.
- Utiliser MapLibre avec `source` vectoriel et simplification géométrique (Douglas-Peucker) pour zoom bas.
