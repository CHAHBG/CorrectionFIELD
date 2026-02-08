import 'dart:convert';

import 'package:sqflite/sqflite.dart';

/// Data Access Object for corrections (field corrections by enquêteurs).
class CorrectionsDao {
  CorrectionsDao(this.db);

  final Database db;

  // ── Queries ────────────────────────────────────────────────

  Future<List<Map<String, Object?>>> findByParcelId(int parcelId) async {
    return db.query(
      'corrections',
      where: 'parcel_id = ?',
      whereArgs: [parcelId],
      orderBy: 'updated_at DESC',
    );
  }

  Future<Map<String, Object?>?> findByUuid(String uuid) async {
    final rows = await db.query(
      'corrections',
      where: 'uuid = ?',
      whereArgs: [uuid],
    );
    return rows.isEmpty ? null : rows.first;
  }

  Future<List<Map<String, Object?>>> findDirty() async {
    return db.query(
      'corrections',
      where: 'dirty = 1',
      orderBy: 'updated_at ASC',
    );
  }

  Future<List<Map<String, Object?>>> findAll() async {
    return db.query('corrections', orderBy: 'updated_at DESC');
  }

  /// Returns corrections joined with their parcel row (including parcel geometry).
  /// Optionally filters by [communeRef].
  Future<List<Map<String, Object?>>> findCorrectionsWithParcels({
    String? communeRef,
  }) async {
    final communeClause = communeRef != null ? 'AND p.commune_ref = ?' : '';
    final args = <Object?>[];
    if (communeRef != null) args.add(communeRef);

    return db.rawQuery('''
      SELECT
        c.uuid AS correction_uuid,
        c.parcel_id AS parcel_id,
        c.num_parcel AS corrected_num_parcel,
        c.enqueteur AS enqueteur,
        c.survey_status AS survey_status,
        c.notes AS notes,
        c.gps_latitude AS gps_latitude,
        c.gps_longitude AS gps_longitude,
        c.gps_accuracy AS gps_accuracy,
        c.geom_json AS correction_geom_json,
        c.created_at AS correction_created_at,
        c.updated_at AS correction_updated_at,
        c.dirty AS dirty,

        p.commune_ref AS commune_ref,
        p.num_parcel AS original_num_parcel,
        p.parcel_type AS parcel_type,
        p.status AS parcel_status,
        p.geom_json AS parcel_geom_json,
        p.source_file AS source_file,
        p.updated_at AS parcel_updated_at
      FROM corrections c
      INNER JOIN parcels p ON p.id = c.parcel_id
      WHERE p.is_deleted = 0
        $communeClause
      ORDER BY c.updated_at DESC
    ''', args);
  }

  // ── Check uniqueness ──────────────────────────────────────

  /// Returns true if [numParcel] already exists in corrections table
  /// (excluding the given [excludeUuid] if editing).
  Future<bool> numParcelExists(String numParcel, {String? excludeUuid}) async {
    final where = excludeUuid != null
        ? 'num_parcel = ? AND uuid != ?'
        : 'num_parcel = ?';
    final args = excludeUuid != null
        ? [numParcel, excludeUuid]
        : [numParcel];

    final result = await db.rawQuery(
      'SELECT COUNT(*) as cnt FROM corrections WHERE $where',
      args,
    );
    return (Sqflite.firstIntValue(result) ?? 0) > 0;
  }

  // ── Insert / Update ────────────────────────────────────────

  Future<int> insertCorrection(Map<String, Object?> row) async {
    final id = await db.insert('corrections', row);

    // Also log to sync_log
    await _logSync('correction', id, 'create', row);

    return id;
  }

  Future<void> updateCorrection(String uuid, Map<String, Object?> values) async {
    values['dirty'] = 1;
    values['updated_at'] = DateTime.now().toUtc().toIso8601String();

    await db.update(
      'corrections',
      values,
      where: 'uuid = ?',
      whereArgs: [uuid],
    );

    final row = await findByUuid(uuid);
    if (row != null) {
      await _logSync('correction', row['id'] as int, 'update', row);
    }
  }

  /// Mark corrections as synced (dirty = 0).
  Future<void> markSynced(List<String> uuids) async {
    final placeholders = uuids.map((_) => '?').join(',');
    await db.rawUpdate(
      'UPDATE corrections SET dirty = 0 WHERE uuid IN ($placeholders)',
      uuids,
    );
  }

  // ── Sync log helper ────────────────────────────────────────

  Future<void> _logSync(
    String entityType,
    int entityId,
    String action,
    Map<String, Object?> payload,
  ) async {
    await db.insert('sync_log', {
      'entity_type': entityType,
      'entity_id': entityId,
      'action': action,
      'payload_json': jsonEncode(payload),
      'created_at': DateTime.now().toUtc().toIso8601String(),
    });
  }

  // ── Stats ──────────────────────────────────────────────────

  Future<int> countDirty() async {
    final result = await db.rawQuery(
      'SELECT COUNT(*) as cnt FROM corrections WHERE dirty = 1',
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  Future<int> totalCount() async {
    final result = await db.rawQuery(
      'SELECT COUNT(*) as cnt FROM corrections',
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }
}
