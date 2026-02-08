import 'package:sqflite/sqflite.dart';

/// Data Access Object for parcels table with R-Tree spatial queries.
class ParcelsDao {
  ParcelsDao(this.db);

  final Database db;

  // ── Spatial queries (R-Tree powered) ───────────────────────

  /// Find all parcels whose bounding box contains or is near a point.
  /// Uses the R-Tree index for O(log n) lookup.
  Future<List<Map<String, Object?>>> findParcelsNearPoint({
    required double longitude,
    required double latitude,
    double bufferDeg = 0.005, // ~500m buffer
  }) async {
    return db.rawQuery('''
      SELECT p.*
      FROM parcels p
      INNER JOIN rtree_parcels r ON p.id = r.id
      WHERE r.min_x <= ? AND r.max_x >= ?
        AND r.min_y <= ? AND r.max_y >= ?
        AND p.is_deleted = 0
    ''', [
      longitude + bufferDeg, longitude - bufferDeg,
      latitude + bufferDeg, latitude - bufferDeg,
    ]);
  }

  /// Find all parcels belonging to a specific commune.
  Future<List<Map<String, Object?>>> findParcelsByCommune(
      String communeRef) async {
    return db.rawQuery('''
      SELECT *
      FROM parcels
      WHERE commune_ref = ?
        AND is_deleted = 0
      ORDER BY num_parcel
    ''', [communeRef]);
  }

  /// Find parcels visible in a map viewport (bounding box).
  /// Uses R-Tree for fast spatial filtering.
  Future<List<Map<String, Object?>>> findParcelsInViewport({
    required double minLng,
    required double minLat,
    required double maxLng,
    required double maxLat,
    String? communeRef,
  }) async {
    final communeFilter =
        communeRef != null ? 'AND p.commune_ref = ?' : '';
    final args = <Object>[maxLng, minLng, maxLat, minLat];
    if (communeRef != null) args.add(communeRef);

    return db.rawQuery('''
      SELECT p.*
      FROM parcels p
      INNER JOIN rtree_parcels r ON p.id = r.id
      WHERE r.min_x <= ? AND r.max_x >= ?
        AND r.min_y <= ? AND r.max_y >= ?
        AND p.is_deleted = 0
        $communeFilter
    ''', args);
  }

  /// Find parcels by type (sans_enquete / sans_numero) for a commune.
  Future<List<Map<String, Object?>>> findParcelsByTypeAndCommune({
    required String parcelType,
    required String communeRef,
  }) async {
    return db.rawQuery('''
      SELECT *
      FROM parcels
      WHERE parcel_type = ?
        AND commune_ref = ?
        AND is_deleted = 0
      ORDER BY num_parcel
    ''', [parcelType, communeRef]);
  }

  // ── Single parcel queries ──────────────────────────────────

  Future<Map<String, Object?>?> findById(int id) async {
    final rows = await db.query('parcels', where: 'id = ?', whereArgs: [id]);
    return rows.isEmpty ? null : rows.first;
  }

  Future<Map<String, Object?>?> findByNumParcel(String numParcel) async {
    final rows = await db.query(
      'parcels',
      where: 'num_parcel = ? AND is_deleted = 0',
      whereArgs: [numParcel],
    );
    return rows.isEmpty ? null : rows.first;
  }

  // ── Mutation ───────────────────────────────────────────────

  /// Insert a parcel and its R-Tree entry. Returns the new row id.
  Future<int> insertParcel(Map<String, Object?> row) async {
    final id = await db.insert('parcels', row);
    await db.insert('rtree_parcels', {
      'id': id,
      'min_x': row['min_x'],
      'max_x': row['max_x'],
      'min_y': row['min_y'],
      'max_y': row['max_y'],
    });
    return id;
  }

  /// Update parcel status after correction.
  Future<void> updateStatus(int id, String status) async {
    await db.update(
      'parcels',
      {
        'status': status,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // ── Stats ──────────────────────────────────────────────────

  Future<int> countByCommune(String communeRef) async {
    final result = await db.rawQuery(
      'SELECT COUNT(*) as cnt FROM parcels WHERE commune_ref = ? AND is_deleted = 0',
      [communeRef],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  Future<int> countPending(String communeRef) async {
    final result = await db.rawQuery(
      "SELECT COUNT(*) as cnt FROM parcels WHERE commune_ref = ? AND status = 'pending' AND is_deleted = 0",
      [communeRef],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  Future<int> totalCount() async {
    final result = await db.rawQuery(
      'SELECT COUNT(*) as cnt FROM parcels WHERE is_deleted = 0',
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }
}

