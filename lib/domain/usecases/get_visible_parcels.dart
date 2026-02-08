import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/di/providers.dart';
import '../../data/repositories/parcels_repository.dart';
import '../entities/commune.dart';
import '../entities/parcel.dart';

/// Use case: Get parcels visible for the current GPS position.
///
/// Implements the geofencing logic:
///   1. Determine which commune the user is in
///   2. Return only parcels for that commune
///   3. Optionally filter by viewport bounds
class GetVisibleParcels {
  GetVisibleParcels(this.repository);

  final ParcelsRepository repository;

  /// Get all parcels for the commune at the given GPS position.
  Future<GeofencedResult> byGpsPosition({
    required double latitude,
    required double longitude,
  }) async {
    return repository.getVisibleParcelsForGps(
      latitude: latitude,
      longitude: longitude,
    );
  }

  /// Get parcels within a map viewport, optionally filtered by commune.
  Future<List<Parcel>> byViewport({
    required double minLng,
    required double minLat,
    required double maxLng,
    required double maxLat,
    String? communeRef,
  }) async {
    return repository.getParcelsInViewport(
      minLng: minLng,
      minLat: minLat,
      maxLng: maxLng,
      maxLat: maxLat,
      communeRef: communeRef,
    );
  }

  /// Get all parcels for a specific commune.
  Future<List<Parcel>> byCommune(String communeRef) async {
    return repository.getParcelsByCommune(communeRef);
  }

  /// Get all communes.
  Future<List<Commune>> allCommunes() async {
    return repository.getAllCommunes();
  }
}

/// Provider for the use case.
final getVisibleParcelsProvider = Provider<GetVisibleParcels>((ref) {
  return GetVisibleParcels(ref.watch(parcelsRepositoryProvider));
});
