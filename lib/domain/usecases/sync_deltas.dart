import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/di/providers.dart';
import '../../services/delta_sync_service.dart';

/// Use case: Synchronize local deltas with the central server.
///
/// Strategy:
///   1. Push dirty corrections (local → server)
///   2. Pull new changes (server → local)
///   3. Resolve conflicts by `updated_at` timestamp
class SyncDeltas {
  SyncDeltas(this.syncService);

  final DeltaSyncService syncService;

  /// Execute a full sync cycle (push + pull).
  Future<SyncResult> execute({String? serverUrl}) async {
    return syncService.sync(serverUrl: serverUrl);
  }

  /// Push only (for offline queuing).
  Future<SyncResult> pushOnly({String? serverUrl}) async {
    return syncService.pushDeltas(serverUrl: serverUrl);
  }

  /// Pull only.
  Future<SyncResult> pullOnly({String? serverUrl}) async {
    return syncService.pullDeltas(serverUrl: serverUrl);
  }

  /// Get pending push count.
  Future<int> pendingCount() async {
    return syncService.pendingPushCount();
  }
}

/// Provider for the use case.
final syncDeltasProvider = Provider<SyncDeltas>((ref) {
  return SyncDeltas(ref.watch(deltaSyncServiceProvider));
});
