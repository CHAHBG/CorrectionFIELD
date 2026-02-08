import 'dart:async';

import 'package:geolocator/geolocator.dart';
import 'package:logger/logger.dart';

import '../data/repositories/parcels_repository.dart';
import '../domain/entities/commune.dart';
import '../domain/entities/parcel.dart';

final _log = Logger(printer: PrettyPrinter(methodCount: 0));

/// GPS position + accuracy wrapper.
class GpsPosition {
  const GpsPosition({
    required this.latitude,
    required this.longitude,
    required this.accuracy,
    required this.timestamp,
  });

  final double latitude;
  final double longitude;
  final double accuracy; // meters
  final DateTime timestamp;

  /// Accuracy classification for UI badge.
  GpsAccuracyLevel get level {
    if (accuracy <= 5) return GpsAccuracyLevel.excellent;
    if (accuracy <= 15) return GpsAccuracyLevel.good;
    return GpsAccuracyLevel.poor;
  }
}

enum GpsAccuracyLevel { excellent, good, poor }

/// Result of a geofencing check.
class GeofenceState {
  const GeofenceState({
    this.position,
    this.commune,
    this.parcels = const [],
    this.totalCount = 0,
    this.pendingCount = 0,
    this.isLoading = false,
    this.error,
  });

  final GpsPosition? position;
  final Commune? commune;
  final List<Parcel> parcels;
  final int totalCount;
  final int pendingCount;
  final bool isLoading;
  final String? error;

  bool get isInCommune => commune != null;
  bool get hasPosition => position != null;

  GeofenceState copyWith({
    GpsPosition? position,
    Commune? commune,
    List<Parcel>? parcels,
    int? totalCount,
    int? pendingCount,
    bool? isLoading,
    String? error,
  }) {
    return GeofenceState(
      position: position ?? this.position,
      commune: commune ?? this.commune,
      parcels: parcels ?? this.parcels,
      totalCount: totalCount ?? this.totalCount,
      pendingCount: pendingCount ?? this.pendingCount,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

/// Service that tracks GPS position and performs commune-based geofencing.
///
/// On each significant position change:
///   1. Determine which commune the user is in (point-in-polygon)
///   2. Load only the parcels for that commune
///   3. Emit a [GeofenceState] with position + commune + parcels
class GeofencingService {
  GeofencingService(this.repository);

  final ParcelsRepository repository;

  StreamSubscription<Position>? _positionSub;
  String? _currentCommuneRef;

  final _controller = StreamController<GeofenceState>.broadcast();

  /// Stream of geofence state updates.
  Stream<GeofenceState> get stream => _controller.stream;

  /// Start listening to GPS position changes.
  Future<void> start() async {
    // Check permissions
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        _controller.add(const GeofenceState(
          error: 'Permission GPS refusée',
        ));
        return;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      _controller.add(const GeofenceState(
        error: 'Permission GPS bloquée. Activez-la dans les paramètres.',
      ));
      return;
    }

    // Check if location service is enabled
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      _controller.add(const GeofenceState(
        error: 'Service de localisation désactivé',
      ));
      return;
    }

    _controller.add(const GeofenceState(isLoading: true));

    // Get initial position
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 0,
        ),
      );
      await _onPositionChanged(pos);
    } catch (e) {
      _log.e('Error getting initial position: $e');
    }

    // Start continuous tracking
    _positionSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 20, // update every 20 meters
      ),
    ).listen(
      _onPositionChanged,
      onError: (e) {
        _log.e('GPS stream error: $e');
        _controller.add(GeofenceState(error: 'Erreur GPS: $e'));
      },
    );
  }

  /// Process a new GPS position.
  Future<void> _onPositionChanged(Position pos) async {
    final gpsPos = GpsPosition(
      latitude: pos.latitude,
      longitude: pos.longitude,
      accuracy: pos.accuracy,
      timestamp: pos.timestamp ?? DateTime.now(),
    );

    _log.d(
      'GPS: ${pos.latitude.toStringAsFixed(6)}, '
      '${pos.longitude.toStringAsFixed(6)} '
      '(±${pos.accuracy.toStringAsFixed(1)}m)',
    );

    try {
      // Perform geofencing query
      final result = await repository.getVisibleParcelsForGps(
        latitude: pos.latitude,
        longitude: pos.longitude,
      );

      final newCommuneRef = result.commune?.communeRef;

      // Only reload parcels if commune changed
      if (newCommuneRef != _currentCommuneRef) {
        _currentCommuneRef = newCommuneRef;
        _log.i('Commune changed to: ${result.commune?.name ?? "none"}');
      }

      _controller.add(GeofenceState(
        position: gpsPos,
        commune: result.commune,
        parcels: result.parcels,
        totalCount: result.totalCount,
        pendingCount: result.pendingCount,
      ));
    } catch (e) {
      _log.e('Geofencing error: $e');
      _controller.add(GeofenceState(
        position: gpsPos,
        error: 'Erreur géofencing: $e',
      ));
    }
  }

  /// Force a refresh with a specific commune (manual override).
  Future<void> loadCommuneManually(String communeRef) async {
    _currentCommuneRef = communeRef;

    try {
      final parcels = await repository.getParcelsByCommune(communeRef);
      final commune = await repository.getCommuneByRef(communeRef);

      final lastState = GeofenceState(
        commune: commune,
        parcels: parcels,
        totalCount: parcels.length,
        pendingCount: parcels.where((p) => p.needsCorrection).length,
      );

      _controller.add(lastState);
    } catch (e) {
      _log.e('Manual commune load error: $e');
    }
  }

  /// Stop GPS tracking.
  void stop() {
    _positionSub?.cancel();
    _positionSub = null;
  }

  /// Dispose of resources.
  void dispose() {
    stop();
    _controller.close();
  }
}

