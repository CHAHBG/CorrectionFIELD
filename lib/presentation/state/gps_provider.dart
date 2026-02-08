import 'package:flutter_riverpod/flutter_riverpod.dart';

class GpsState {
  const GpsState({required this.accuracyMeters});

  final double accuracyMeters;
}

final gpsProvider = StateProvider<GpsState>((ref) {
  return const GpsState(accuracyMeters: 8.0);
});
