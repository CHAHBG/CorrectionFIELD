import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../../services/geofencing_service.dart';

/// Reactive GPS state with live position tracking.
class GpsState {
  const GpsState({
    this.latitude,
    this.longitude,
    this.accuracyMeters = 0,
    this.isTracking = false,
    this.error,
    this.lastUpdate,
  });

  final double? latitude;
  final double? longitude;
  final double accuracyMeters;
  final bool isTracking;
  final String? error;
  final DateTime? lastUpdate;

  bool get hasPosition => latitude != null && longitude != null;

  GpsAccuracyLevel get level {
    if (accuracyMeters <= 5) return GpsAccuracyLevel.excellent;
    if (accuracyMeters <= 15) return GpsAccuracyLevel.good;
    return GpsAccuracyLevel.poor;
  }

  GpsState copyWith({
    double? latitude,
    double? longitude,
    double? accuracyMeters,
    bool? isTracking,
    String? error,
    DateTime? lastUpdate,
  }) {
    return GpsState(
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      accuracyMeters: accuracyMeters ?? this.accuracyMeters,
      isTracking: isTracking ?? this.isTracking,
      error: error,
      lastUpdate: lastUpdate ?? this.lastUpdate,
    );
  }
}

/// GPS state notifier with live position stream.
class GpsNotifier extends StateNotifier<GpsState> {
  GpsNotifier() : super(const GpsState());

  StreamSubscription<Position>? _sub;

  /// Start tracking GPS position.
  Future<void> startTracking() async {
    // Check permissions
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      state = state.copyWith(
        error: 'Permission GPS refusée',
        isTracking: false,
      );
      return;
    }

    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) {
      state = state.copyWith(
        error: 'Service de localisation désactivé',
        isTracking: false,
      );
      return;
    }

    state = state.copyWith(isTracking: true);

    // Get initial position
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      _updateFromPosition(pos);
    } catch (e) {
      state = state.copyWith(error: 'Erreur GPS: $e');
    }

    // Continuous stream
    _sub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 5,
      ),
    ).listen(
      _updateFromPosition,
      onError: (e) {
        state = state.copyWith(error: 'Erreur GPS: $e');
      },
    );
  }

  void _updateFromPosition(Position pos) {
    state = GpsState(
      latitude: pos.latitude,
      longitude: pos.longitude,
      accuracyMeters: pos.accuracy,
      isTracking: true,
      lastUpdate: DateTime.now(),
    );
  }

  /// Stop tracking.
  void stopTracking() {
    _sub?.cancel();
    _sub = null;
    state = state.copyWith(isTracking: false);
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }
}

/// Global GPS provider.
final gpsProvider = StateNotifierProvider<GpsNotifier, GpsState>((ref) {
  return GpsNotifier();
});

