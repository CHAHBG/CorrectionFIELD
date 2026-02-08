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
