import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/local/dao/communes_dao.dart';
import '../../data/local/dao/corrections_dao.dart';
import '../../data/local/dao/parcels_dao.dart';
import '../../data/local/db/app_database.dart';
import '../../data/repositories/corrections_repository.dart';
import '../../data/repositories/parcels_repository.dart';
import '../../services/delta_sync_service.dart';
import '../../services/demo_data_service.dart';
import '../../services/export_service.dart';
import '../../services/geofencing_service.dart';
import '../../services/gpkg_import_service.dart';
import '../../services/kobo_bridge.dart';
import '../../services/topo_validator.dart';

// ── Database ─────────────────────────────────────────────────

/// The main database provider. Must be overridden at startup.
final appDatabaseProvider = Provider<AppDatabase>((ref) {
  throw UnimplementedError('AppDatabase must be initialized before use');
});

// ── DAOs ─────────────────────────────────────────────────────

final parcelsDaoProvider = Provider<ParcelsDao>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return ParcelsDao(db.db);
});

final communesDaoProvider = Provider<CommunesDao>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return CommunesDao(db.db);
});

final correctionsDaoProvider = Provider<CorrectionsDao>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return CorrectionsDao(db.db);
});

// ── Repositories ─────────────────────────────────────────────

final parcelsRepositoryProvider = Provider<ParcelsRepository>((ref) {
  return ParcelsRepository(
    parcelsDao: ref.watch(parcelsDaoProvider),
    communesDao: ref.watch(communesDaoProvider),
  );
});

final correctionsRepositoryProvider = Provider<CorrectionsRepository>((ref) {
  return CorrectionsRepository(
    correctionsDao: ref.watch(correctionsDaoProvider),
    parcelsDao: ref.watch(parcelsDaoProvider),
  );
});

// ── Services ─────────────────────────────────────────────────

final geofencingServiceProvider = Provider<GeofencingService>((ref) {
  return GeofencingService(ref.watch(parcelsRepositoryProvider));
});

final topoValidatorProvider = Provider<TopoValidator>((ref) {
  return const TopoValidator();
});

final deltaSyncServiceProvider = Provider<DeltaSyncService>((ref) {
  return DeltaSyncService(
    appDb: ref.watch(appDatabaseProvider),
    correctionsRepo: ref.watch(correctionsRepositoryProvider),
  );
});

final koboBridgeProvider = Provider<KoboBridge>((ref) {
  return const KoboBridge();
});

final gpkgImportServiceProvider = Provider<GpkgImportService>((ref) {
  return GpkgImportService(ref.watch(appDatabaseProvider));
});

final exportServiceProvider = Provider<ExportService>((ref) {
  return ExportService(correctionsDao: ref.watch(correctionsDaoProvider));
});

final demoDataServiceProvider = Provider<DemoDataService>((ref) {
  return DemoDataService(ref.watch(appDatabaseProvider));
});
