import 'dart:convert';

import 'package:sqflite/sqflite.dart';

import '../../../utils/geometry_utils.dart';

/// Data Access Object for communes table with R-Tree spatial lookup.
class CommunesDao {
  CommunesDao(this.db);

  final Database db;

  // ── Spatial: find the commune containing a GPS point ───────

  /// Find which commune contains the given WGS84 point.
  ///
  /// Strategy:
  ///   1. R-Tree bbox filter (fast — eliminates most communes)
  ///   2. Point-in-polygon test on remaining candidates (accurate)
  Future<Map<String, Object?>?> findCommuneForPoint({
    required double longitude,
    required double latitude,
  }) async {
    // Step 1: R-Tree bounding box candidates
    final candidates = await db.rawQuery('''
      SELECT c.*
      FROM communes c
      INNER JOIN rtree_communes r ON c.id = r.id
      WHERE r.min_x <= ? AND r.max_x >= ?
        AND r.min_y <= ? AND r.max_y >= ?
    ''', [longitude, longitude, latitude, latitude]);

    if (candidates.isEmpty) return null;
    if (candidates.length == 1) return candidates.first;

    // Step 2: Point-in-polygon on the few candidates
    final point = [longitude, latitude];

    for (final row in candidates) {
      final geom = jsonDecode(row['geom_json'] as String);
      final type = geom['type'] as String;
      final coords = geom['coordinates'];

      bool inside = false;
      if (type == 'MultiPolygon') {
        inside = GeometryUtils.pointInMultiPolygon(
          point,
          (coords as List)
              .map((p) => (p as List)
                  .map((r) => (r as List)
                      .map((c) => (c as List).cast<double>().toList())
                      .toList())
                  .toList())
              .toList(),
        );
      } else if (type == 'Polygon') {
        inside = GeometryUtils.pointInPolygon(
          point,
          (coords as List)
              .map((r) => (r as List)
                  .map((c) => (c as List).cast<double>().toList())
                  .toList())
              .toList(),
        );
      }

      if (inside) return row;
    }

    // Fallback: return nearest by bbox center
    return candidates.first;
  }

  // ── All communes ───────────────────────────────────────────

  Future<List<Map<String, Object?>>> findAll() async {
    return db.query('communes', orderBy: 'name');
  }

  Future<Map<String, Object?>?> findByRef(String communeRef) async {
    final rows = await db.query(
      'communes',
      where: 'commune_ref = ?',
      whereArgs: [communeRef],
    );
    return rows.isEmpty ? null : rows.first;
  }

  Future<Map<String, Object?>?> findByName(String name) async {
    final rows = await db.query(
      'communes',
      where: 'UPPER(name) = UPPER(?)',
      whereArgs: [name],
    );
    return rows.isEmpty ? null : rows.first;
  }

  // ── Insert ─────────────────────────────────────────────────

  Future<int> insertCommune(Map<String, Object?> row) async {
    final id = await db.insert(
      'communes',
      row,
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    await db.insert('rtree_communes', {
      'id': id,
      'min_x': row['min_x'],
      'max_x': row['max_x'],
      'min_y': row['min_y'],
      'max_y': row['max_y'],
    });
    return id;
  }

  Future<int> count() async {
    final result =
        await db.rawQuery('SELECT COUNT(*) as cnt FROM communes');
    return Sqflite.firstIntValue(result) ?? 0;
  }
}
