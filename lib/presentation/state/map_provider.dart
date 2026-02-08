import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/di/providers.dart';
import '../../domain/entities/commune.dart';
import '../../domain/entities/parcel.dart';
import '../../services/geofencing_service.dart';
import 'gps_provider.dart';

/// State for the map screen — combines geofencing with parcel data.
class MapState {
  const MapState({
    this.currentCommune,
    this.parcels = const [],
    this.selectedParcel,
    this.allCommunes = const [],
    this.isLoading = false,
    this.error,
    this.totalCount = 0,
    this.pendingCount = 0,
    this.filterType, // null = all, 'sans_enquete', 'sans_numero'
  });

  final Commune? currentCommune;
  final List<Parcel> parcels;
  final Parcel? selectedParcel;
  final List<Commune> allCommunes;
  final bool isLoading;
  final String? error;
  final int totalCount;
  final int pendingCount;
  final String? filterType;

  /// Filtered parcels based on current filter.
  List<Parcel> get filteredParcels {
    if (filterType == null) return parcels;
    return parcels
        .where((p) =>
            filterType == 'sans_enquete'
                ? p.parcelType == ParcelType.sansEnquete
                : p.parcelType == ParcelType.sansNumero)
        .toList();
  }

  /// Build a GeoJSON FeatureCollection for the filtered parcels.
  String get parcelsGeoJson {
    final features = filteredParcels.map((p) {
      return {
        'type': 'Feature',
        'id': p.id,
        'geometry': jsonDecode(p.geomJson),
        'properties': {
          'id': p.id,
          'num_parcel': p.numParcel ?? '',
          'parcel_type': p.parcelType.name,
          'status': p.status.name,
          'commune_ref': p.communeRef,
        },
      };
    }).toList();

    return jsonEncode({
      'type': 'FeatureCollection',
      'features': features,
    });
  }

  /// Build a GeoJSON FeatureCollection for the current commune boundary.
  String? get communeGeoJson {
    if (currentCommune == null) return null;
    final feature = {
      'type': 'FeatureCollection',
      'features': [
        {
          'type': 'Feature',
          'geometry': jsonDecode(currentCommune!.geomJson),
          'properties': {
            'name': currentCommune!.name,
            'commune_ref': currentCommune!.communeRef,
          },
        }
      ],
    };
    return jsonEncode(feature);
  }

  MapState copyWith({
    Commune? currentCommune,
    List<Parcel>? parcels,
    Parcel? selectedParcel,
    List<Commune>? allCommunes,
    bool? isLoading,
    String? error,
    int? totalCount,
    int? pendingCount,
    String? filterType,
    bool clearSelection = false,
    bool clearCommune = false,
  }) {
    return MapState(
      currentCommune:
          clearCommune ? null : (currentCommune ?? this.currentCommune),
      parcels: parcels ?? this.parcels,
      selectedParcel:
          clearSelection ? null : (selectedParcel ?? this.selectedParcel),
      allCommunes: allCommunes ?? this.allCommunes,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      totalCount: totalCount ?? this.totalCount,
      pendingCount: pendingCount ?? this.pendingCount,
      filterType: filterType,
    );
  }
}

/// Map state notifier — orchestrates geofencing and parcel loading.
class MapNotifier extends StateNotifier<MapState> {
  MapNotifier(this._ref) : super(const MapState());

  final Ref _ref;

  /// Initialize: load all communes and start geofencing.
  Future<void> initialize() async {
    state = state.copyWith(isLoading: true);

    try {
      final repo = _ref.read(parcelsRepositoryProvider);
      final communes = await repo.getAllCommunes();
      state = state.copyWith(allCommunes: communes, isLoading: false);
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: 'Erreur d\'initialisation: $e',
      );
    }
  }

  /// Perform geofencing with current GPS position.
  Future<void> geofenceWithPosition(double lat, double lng) async {
    try {
      final repo = _ref.read(parcelsRepositoryProvider);
      final result = await repo.getVisibleParcelsForGps(
        latitude: lat,
        longitude: lng,
      );

      if (result.isNotEmpty) {
        state = state.copyWith(
          currentCommune: result.commune,
          parcels: result.parcels,
          totalCount: result.totalCount,
          pendingCount: result.pendingCount,
        );
      }
    } catch (e) {
      state = state.copyWith(error: 'Erreur géofencing: $e');
    }
  }

  /// Manually select a commune (override GPS).
  Future<void> selectCommune(String communeRef) async {
    state = state.copyWith(isLoading: true, clearSelection: true);

    try {
      final repo = _ref.read(parcelsRepositoryProvider);
      final commune = await repo.getCommuneByRef(communeRef);
      final parcels = await repo.getParcelsByCommune(communeRef);

      state = state.copyWith(
        currentCommune: commune,
        parcels: parcels,
        totalCount: parcels.length,
        pendingCount: parcels.where((p) => p.needsCorrection).length,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: '$e');
    }
  }

  /// Select a parcel (e.g., tapped on map).
  void selectParcel(int parcelId) {
    final parcel = state.parcels.where((p) => p.id == parcelId).firstOrNull;
    state = state.copyWith(selectedParcel: parcel);
  }

  /// Clear parcel selection.
  void clearSelection() {
    state = state.copyWith(clearSelection: true);
  }

  /// Set filter type.
  void setFilter(String? type) {
    state = state.copyWith(filterType: type);
  }

  /// Refresh parcels for current commune.
  Future<void> refresh() async {
    if (state.currentCommune == null) return;
    await selectCommune(state.currentCommune!.communeRef);
  }
}

/// Map state provider.
final mapProvider = StateNotifierProvider<MapNotifier, MapState>((ref) {
  return MapNotifier(ref);
});
