import 'dart:convert';

import '../../domain/entities/correction.dart';
import '../local/dao/corrections_dao.dart';
import '../local/dao/parcels_dao.dart';

/// Repository for field corrections with sync tracking.
class CorrectionsRepository {
  CorrectionsRepository({
    required this.correctionsDao,
    required this.parcelsDao,
  });

  final CorrectionsDao correctionsDao;
  final ParcelsDao parcelsDao;

  // ── Queries ────────────────────────────────────────────────

  Future<List<Correction>> getByParcelId(int parcelId) async {
    final rows = await correctionsDao.findByParcelId(parcelId);
    return rows.map(Correction.fromRow).toList();
  }

  Future<Correction?> getByUuid(String uuid) async {
    final row = await correctionsDao.findByUuid(uuid);
    return row == null ? null : Correction.fromRow(row);
  }

  Future<List<Correction>> getDirtyCorrections() async {
    final rows = await correctionsDao.findDirty();
    return rows.map(Correction.fromRow).toList();
  }

  Future<List<Correction>> getAll() async {
    final rows = await correctionsDao.findAll();
    return rows.map(Correction.fromRow).toList();
  }

  // ── Validation ─────────────────────────────────────────────

  /// Check if the parcel number is already used (prevents duplicates).
  Future<bool> isNumParcelTaken(String numParcel, {String? excludeUuid}) async {
    // Check in corrections table
    final inCorrections = await correctionsDao.numParcelExists(
      numParcel,
      excludeUuid: excludeUuid,
    );
    if (inCorrections) return true;

    // Also check if the num already exists in parcels table
    final parcelRow = await parcelsDao.findByNumParcel(numParcel);
    return parcelRow != null;
  }

  // ── Save / Update ──────────────────────────────────────────

  /// Save a new correction. Returns the correction id.
  Future<int> saveCorrection({
    required String uuid,
    required int parcelId,
    required String numParcel,
    String? enqueteur,
    String? notes,
    double? gpsLatitude,
    double? gpsLongitude,
    double? gpsAccuracy,
    String? geomJson,
  }) async {
    final now = DateTime.now().toUtc().toIso8601String();

    final id = await correctionsDao.insertCorrection({
      'uuid': uuid,
      'parcel_id': parcelId,
      'num_parcel': numParcel,
      'enqueteur': enqueteur,
      'survey_status': 'draft',
      'notes': notes,
      'gps_latitude': gpsLatitude,
      'gps_longitude': gpsLongitude,
      'gps_accuracy': gpsAccuracy,
      'geom_json': geomJson,
      'dirty': 1,
      'created_at': now,
      'updated_at': now,
    });

    // Update parcel status to 'corrected'
    await parcelsDao.updateStatus(parcelId, 'corrected');

    return id;
  }

  /// Update an existing correction.
  Future<void> updateCorrection({
    required String uuid,
    String? numParcel,
    String? enqueteur,
    String? notes,
    String? surveyStatus,
    String? geomJson,
  }) async {
    final values = <String, Object?>{};
    if (numParcel != null) values['num_parcel'] = numParcel;
    if (enqueteur != null) values['enqueteur'] = enqueteur;
    if (notes != null) values['notes'] = notes;
    if (surveyStatus != null) values['survey_status'] = surveyStatus;
    if (geomJson != null) values['geom_json'] = geomJson;

    await correctionsDao.updateCorrection(uuid, values);
  }

  /// Mark corrections as synced.
  Future<void> markSynced(List<String> uuids) async {
    await correctionsDao.markSynced(uuids);
  }

  // ── Sync payload ───────────────────────────────────────────

  /// Build JSON payloads for all dirty corrections (for delta sync).
  Future<List<Map<String, dynamic>>> buildSyncPayload() async {
    final corrections = await getDirtyCorrections();
    return corrections.map((c) => c.toJson()).toList();
  }

  // ── Stats ──────────────────────────────────────────────────

  Future<int> countDirty() async => correctionsDao.countDirty();
  Future<int> totalCount() async => correctionsDao.totalCount();
}
