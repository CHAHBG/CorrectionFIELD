import '../../domain/entities/commune.dart';
import '../../domain/entities/parcel.dart';
import '../local/dao/communes_dao.dart';
import '../local/dao/parcels_dao.dart';

/// Offline-first repository for parcel data.
///
/// Combines commune lookup (geofencing) with parcel queries.
/// All data comes from the local SQLite database — no network needed.
class ParcelsRepository {
  ParcelsRepository({
    required this.parcelsDao,
    required this.communesDao,
  });

  final ParcelsDao parcelsDao;
  final CommunesDao communesDao;

  // ── Geofencing: GPS → Commune → Parcels ────────────────────

  /// Main geofencing query: given a GPS position, find the current
  /// commune and return all its parcels.
  Future<GeofencedResult> getVisibleParcelsForGps({
    required double latitude,
    required double longitude,
  }) async {
    // 1) Find the commune containing the GPS point
    final communeRow = await communesDao.findCommuneForPoint(
      longitude: longitude,
      latitude: latitude,
    );

    if (communeRow == null) {
      return GeofencedResult.empty();
    }

    final commune = Commune.fromRow(communeRow);

    // 2) Load all parcels for that commune
    final parcelRows =
        await parcelsDao.findParcelsByCommune(commune.communeRef);

    final parcels = parcelRows.map(Parcel.fromRow).toList();

    return GeofencedResult(
      commune: commune,
      parcels: parcels,
      totalCount: parcels.length,
      pendingCount: parcels.where((p) => p.needsCorrection).length,
    );
  }

  // ── Viewport queries ───────────────────────────────────────

  /// Get parcels visible in the current map viewport.
  Future<List<Parcel>> getParcelsInViewport({
    required double minLng,
    required double minLat,
    required double maxLng,
    required double maxLat,
    String? communeRef,
  }) async {
    final rows = await parcelsDao.findParcelsInViewport(
      minLng: minLng,
      minLat: minLat,
      maxLng: maxLng,
      maxLat: maxLat,
      communeRef: communeRef,
    );
    return rows.map(Parcel.fromRow).toList();
  }

  // ── Filtered queries ───────────────────────────────────────

  Future<List<Parcel>> getParcelsByCommune(String communeRef) async {
    final rows = await parcelsDao.findParcelsByCommune(communeRef);
    return rows.map(Parcel.fromRow).toList();
  }

  Future<List<Parcel>> getParcelsByTypeAndCommune({
    required String parcelType,
    required String communeRef,
  }) async {
    final rows = await parcelsDao.findParcelsByTypeAndCommune(
      parcelType: parcelType,
      communeRef: communeRef,
    );
    return rows.map(Parcel.fromRow).toList();
  }

  Future<Parcel?> getParcelById(int id) async {
    final row = await parcelsDao.findById(id);
    return row == null ? null : Parcel.fromRow(row);
  }

  /// Check if a parcel number already exists (for duplicate prevention).
  Future<bool> numParcelExists(String numParcel) async {
    final row = await parcelsDao.findByNumParcel(numParcel);
    return row != null;
  }

  // ── All communes ───────────────────────────────────────────

  Future<List<Commune>> getAllCommunes() async {
    final rows = await communesDao.findAll();
    return rows.map(Commune.fromRow).toList();
  }

  Future<Commune?> getCommuneByRef(String ref) async {
    final row = await communesDao.findByRef(ref);
    return row == null ? null : Commune.fromRow(row);
  }
}

/// Result of a geofenced parcel query.
class GeofencedResult {
  const GeofencedResult({
    this.commune,
    this.parcels = const [],
    this.totalCount = 0,
    this.pendingCount = 0,
  });

  factory GeofencedResult.empty() => const GeofencedResult();

  final Commune? commune;
  final List<Parcel> parcels;
  final int totalCount;
  final int pendingCount;

  bool get isEmpty => commune == null;
  bool get isNotEmpty => commune != null;
}

