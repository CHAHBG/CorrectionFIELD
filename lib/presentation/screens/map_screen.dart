import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/gps_provider.dart';
import '../widgets/gps_accuracy_badge.dart';

class MapScreen extends ConsumerWidget {
  const MapScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final gpsState = ref.watch(gpsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Correction parcelles'),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            onPressed: () {},
            tooltip: 'Synchroniser',
          ),
        ],
      ),
      body: Stack(
        children: [
          Container(
            color: const Color(0xFFF8FAFC),
            child: const Center(
              child: Text(
                'Carte MapLibre à intégrer ici',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
            ),
          ),
          Positioned(
            top: 16,
            left: 16,
            child: GpsAccuracyBadge(accuracyMeters: gpsState.accuracyMeters),
          ),
          Positioned(
            bottom: 24,
            right: 16,
            child: FloatingActionButton.extended(
              onPressed: () {},
              label: const Text('Nouvelle correction'),
              icon: const Icon(Icons.edit_location_alt),
            ),
          ),
        ],
      ),
    );
  }
}
