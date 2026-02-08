import 'dart:convert';

import 'package:logger/logger.dart';
import 'package:sqflite/sqflite.dart';

import '../data/local/db/app_database.dart';
import '../data/repositories/corrections_repository.dart';

final _log = Logger(printer: PrettyPrinter(methodCount: 0));

/// Delta synchronization service.
///
/// Strategy:
///   - **Push**: select all dirty corrections → send to server → mark synced.
///   - **Pull**: request changes since `last_sync_at` → upsert locally.
///   - **Conflict resolution**: latest `updated_at` wins.
///
/// Works offline: queues changes locally and syncs when connectivity returns.
class DeltaSyncService {
  DeltaSyncService({
    required this.appDb,
    required this.correctionsRepo,
  });

  final AppDatabase appDb;
  final CorrectionsRepository correctionsRepo;

  // ── Push: local → server ───────────────────────────────────

  /// Push all dirty corrections to the server.
  /// Returns the number of successfully synced items.
  Future<SyncResult> pushDeltas({String? serverUrl}) async {
    final dirty = await correctionsRepo.getDirtyCorrections();

    if (dirty.isEmpty) {
      _log.i('No dirty corrections to push');
      return SyncResult(pushed: 0, pulled: 0);
    }

    _log.i('Pushing ${dirty.length} corrections...');

    // Build the payload
    final payload = dirty.map((c) => c.toJson()).toList();

    // In a real implementation, this would be an HTTP POST:
    // final response = await dio.post('$serverUrl/api/sync/push', data: payload);
    // For now, simulate success:
    final success = await _simulatePush(payload);

    if (success) {
      // Mark as synced
      final uuids = dirty.map((c) => c.uuid).toList();
      await correctionsRepo.markSynced(uuids);

      // Update sync_log
      await appDb.db.rawUpdate(
        "UPDATE sync_log SET synced_at = ? WHERE synced_at IS NULL AND entity_type = 'correction'",
        [DateTime.now().toUtc().toIso8601String()],
      );

      _log.i('Successfully pushed ${dirty.length} corrections');
      return SyncResult(pushed: dirty.length, pulled: 0);
    }

    _log.w('Push failed — corrections remain dirty');
    return SyncResult(pushed: 0, pulled: 0, error: 'Push failed');
  }

  // ── Pull: server → local ───────────────────────────────────

  /// Pull changes from the server since last sync.
  Future<SyncResult> pullDeltas({String? serverUrl}) async {
    final lastSync = await appDb.getMeta('last_sync_at') ?? '';

    _log.i('Pulling changes since: ${lastSync.isEmpty ? "beginning" : lastSync}');

    // In a real implementation:
    // final response = await dio.get('$serverUrl/api/sync/pull', queryParameters: {'since': lastSync});
    // final changes = response.data as List;

    // Simulate: no server-side changes for now
    final changes = <Map<String, dynamic>>[];

    var pulled = 0;
    for (final change in changes) {
      await _applyServerChange(change);
      pulled++;
    }

    // Update last_sync_at
    await appDb.setMeta(
      'last_sync_at',
      DateTime.now().toUtc().toIso8601String(),
    );

    _log.i('Pulled $pulled changes from server');
    return SyncResult(pushed: 0, pulled: pulled);
  }

  // ── Full sync (push + pull) ────────────────────────────────

  Future<SyncResult> sync({String? serverUrl}) async {
    final pushResult = await pushDeltas(serverUrl: serverUrl);
    final pullResult = await pullDeltas(serverUrl: serverUrl);

    return SyncResult(
      pushed: pushResult.pushed,
      pulled: pullResult.pulled,
      error: pushResult.error ?? pullResult.error,
    );
  }

  // ── Pending sync status ────────────────────────────────────

  /// Get the number of changes waiting to be pushed.
  Future<int> pendingPushCount() async {
    return correctionsRepo.countDirty();
  }

  /// Get unsynced log entries.
  Future<List<Map<String, Object?>>> getUnsyncedLogs() async {
    return appDb.db.query(
      'sync_log',
      where: 'synced_at IS NULL',
      orderBy: 'created_at ASC',
    );
  }

  // ── Private helpers ────────────────────────────────────────

  Future<bool> _simulatePush(List<Map<String, dynamic>> payload) async {
    // Placeholder: in production, replace with actual HTTP POST
    // to your server endpoint.
    await Future.delayed(const Duration(milliseconds: 100));
    return true; // simulate success
  }

  Future<void> _applyServerChange(Map<String, dynamic> change) async {
    final action = change['action'] as String;
    final entityType = change['entity_type'] as String;
    final data = change['data'] as Map<String, dynamic>;

    if (entityType == 'correction') {
      final uuid = data['uuid'] as String;
      final existing = await correctionsRepo.getByUuid(uuid);

      if (existing == null && action != 'delete') {
        // Insert new server correction
        await correctionsRepo.saveCorrection(
          uuid: uuid,
          parcelId: data['parcel_id'] as int,
          numParcel: data['num_parcel'] as String,
          enqueteur: data['enqueteur'] as String?,
          notes: data['notes'] as String?,
          gpsLatitude: data['gps_latitude'] as double?,
          gpsLongitude: data['gps_longitude'] as double?,
          gpsAccuracy: data['gps_accuracy'] as double?,
          geomJson: data['geom_json'] as String?,
        );
      } else if (existing != null) {
        // Conflict resolution: latest updated_at wins
        final serverTime = DateTime.parse(data['updated_at'] as String);
        final localTime = DateTime.parse(existing.updatedAt);

        if (serverTime.isAfter(localTime)) {
          await correctionsRepo.updateCorrection(
            uuid: uuid,
            numParcel: data['num_parcel'] as String?,
            enqueteur: data['enqueteur'] as String?,
            notes: data['notes'] as String?,
            surveyStatus: data['survey_status'] as String?,
          );
        }
      }
    }
  }
}

/// Result of a sync operation.
class SyncResult {
  const SyncResult({
    this.pushed = 0,
    this.pulled = 0,
    this.error,
  });

  final int pushed;
  final int pulled;
  final String? error;

  bool get hasError => error != null;
  int get total => pushed + pulled;
}

