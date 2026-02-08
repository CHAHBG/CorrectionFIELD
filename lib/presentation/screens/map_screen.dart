import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:maplibre_gl/maplibre_gl.dart';

import '../../app/di/providers.dart';
import '../../app/theme.dart';
import '../../domain/entities/commune.dart';
import '../../domain/entities/parcel.dart';
import '../state/gps_provider.dart';
import '../state/map_provider.dart';
import '../widgets/commune_chip.dart';
import '../widgets/gps_accuracy_badge.dart';
import '../widgets/parcel_filter_bar.dart';
import '../widgets/parcel_info_sheet.dart';
import '../widgets/sync_status_indicator.dart';
import 'correction_form_screen.dart';

/// Main map screen with MapLibre, geofencing, and parcel rendering.
class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  MaplibreMapController? _mapController;
  bool _mapReady = false;
  bool _sourcesAdded = false;

  bool _isExporting = false;

  // Sénégal / Kédougou-Tambacounda region center
  static const _initialCenter = LatLng(12.8, -12.5);
  static const _initialZoom = 8.0;

  @override
  void initState() {
    super.initState();
    // Initialize map state and start GPS
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(mapProvider.notifier).initialize();
      ref.read(gpsProvider.notifier).startTracking();
    });
  }

  @override
  Widget build(BuildContext context) {
    final mapState = ref.watch(mapProvider);
    final gpsState = ref.watch(gpsProvider);

    // React to GPS changes for geofencing
    ref.listen<GpsState>(gpsProvider, (prev, next) {
      if (next.hasPosition && mapState.currentCommune == null) {
        ref.read(mapProvider.notifier).geofenceWithPosition(
              next.latitude!,
              next.longitude!,
            );
      }
    });

    // React to parcel data changes → update map layers
    ref.listen<MapState>(mapProvider, (prev, next) {
      if (_mapReady && _mapController != null) {
        _updateMapLayers(next);
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('CorrectionFIELD'),
        actions: [
          // Commune count badge
          if (mapState.currentCommune != null)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Center(
                child: Text(
                  '${mapState.filteredParcels.length}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 16,
                  ),
                ),
              ),
            ),
          SyncStatusIndicator(
            pendingCount: 0, // TODO: wire to sync service
            onTap: _onSyncTap,
          ),
          IconButton(
            icon: _isExporting
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.download),
            onPressed: _isExporting ? null : () => _onExportTap(mapState),
            tooltip: 'Exporter corrections (GeoJSON/CSV)',
          ),
          // Commune manual selector
          IconButton(
            icon: const Icon(Icons.list),
            onPressed: () => _showCommuneSelector(mapState.allCommunes),
            tooltip: 'Choisir commune',
          ),
        ],
      ),
      body: Stack(
        children: [
          // ── MapLibre Map ──
          MaplibreMap(
            initialCameraPosition: const CameraPosition(
              target: _initialCenter,
              zoom: _initialZoom,
            ),
            styleString:
                'https://demotiles.maplibre.org/style.json',
            onMapCreated: _onMapCreated,
            onStyleLoadedCallback: _onStyleLoaded,
            myLocationEnabled: true,
            myLocationTrackingMode: MyLocationTrackingMode.tracking,
            trackCameraPosition: true,
            onMapClick: _onMapTap,
          ),

          // ── GPS accuracy badge (top-left) ──
          Positioned(
            top: 16,
            left: 16,
            child: GpsAccuracyBadge(
              accuracyMeters: gpsState.accuracyMeters,
              isTracking: gpsState.isTracking,
            ),
          ),

          // ── Commune chip (top-right) ──
          if (mapState.currentCommune != null)
            Positioned(
              top: 16,
              right: 16,
              child: CommuneChip(
                communeName: mapState.currentCommune!.name,
                parcelCount: mapState.totalCount,
                pendingCount: mapState.pendingCount,
                onTap: () => _showCommuneSelector(mapState.allCommunes),
              ),
            ),

          // ── No commune message + Load Demo button ──
          if (!mapState.isLoading && mapState.currentCommune == null)
            Positioned(
              top: 16,
              right: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 14, vertical: 9),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.95),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                          color: AppTheme.gpsPoor.withOpacity(0.5)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.warning_amber,
                            color: AppTheme.gpsPoor, size: 18),
                        const SizedBox(width: 8),
                        Text(
                          'Hors commune',
                          style: TextStyle(
                            color: AppTheme.gpsPoor,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  // Button to load demo data or select a commune
                  ElevatedButton.icon(
                    onPressed: _onLoadDemoData,
                    icon: const Icon(Icons.download, size: 18),
                    label: const Text('Charger démo'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                    ),
                  ),
                ],
              ),
            ),

          // ── Filter bar (bottom-left) ──
          if (mapState.currentCommune != null)
            Positioned(
              bottom: 90,
              left: 16,
              child: ParcelFilterBar(
                currentFilter: mapState.filterType,
                totalCount: mapState.parcels.length,
                sansEnqueteCount: mapState.parcels
                    .where(
                        (p) => p.parcelType == ParcelType.sansEnquete)
                    .length,
                sansNumeroCount: mapState.parcels
                    .where(
                        (p) => p.parcelType == ParcelType.sansNumero)
                    .length,
                onFilterChanged: (type) {
                  ref.read(mapProvider.notifier).setFilter(type);
                },
              ),
            ),

          // ── FAB: New correction ──
          Positioned(
            bottom: 24,
            right: 16,
            child: FloatingActionButton.extended(
              heroTag: 'correction',
              onPressed: mapState.selectedParcel != null
                  ? () => _openCorrectionForm(mapState.selectedParcel!)
                  : null,
              backgroundColor: mapState.selectedParcel != null
                  ? AppTheme.primary
                  : Colors.grey,
              label: const Text('Corriger'),
              icon: const Icon(Icons.edit_location_alt),
            ),
          ),

          // ── Center on GPS button ──
          Positioned(
            bottom: 90,
            right: 16,
            child: FloatingActionButton.small(
              heroTag: 'center',
              onPressed: _centerOnGps,
              backgroundColor: Colors.white,
              child: const Icon(Icons.my_location, color: AppTheme.primary),
            ),
          ),

          // ── Loading indicator ──
          if (mapState.isLoading)
            const Positioned(
              top: 80,
              left: 0,
              right: 0,
              child: LinearProgressIndicator(
                backgroundColor: Colors.transparent,
                color: AppTheme.accent,
              ),
            ),
        ],
      ),
    );
  }

  // ── Map callbacks ──────────────────────────────────────────

  void _onMapCreated(MaplibreMapController controller) {
    _mapController = controller;
  }

  /// Load demo data into the database and refresh the map.
  Future<void> _onLoadDemoData() async {
    final demoService = ref.read(demoDataServiceProvider);

    // Check if already loaded
    final alreadyLoaded = await demoService.isDemoDataLoaded();
    if (alreadyLoaded) {
      // Just refresh and let user select a commune
      await ref.read(mapProvider.notifier).initialize();
      if (mounted) {
        _showCommuneSelector(ref.read(mapProvider).allCommunes);
      }
      return;
    }

    // Show loading
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Chargement des données démo...'),
        duration: Duration(seconds: 1),
      ),
    );

    try {
      final counts = await demoService.loadDemoData();

      // Reinitialize map state to load new communes
      await ref.read(mapProvider.notifier).initialize();

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '✅ Démo chargée: ${counts['communes']} communes, ${counts['parcels']} parcelles',
          ),
          backgroundColor: AppTheme.gpsExcellent,
        ),
      );

      // Open commune selector so user can pick one
      final allCommunes = ref.read(mapProvider).allCommunes;
      if (allCommunes.isNotEmpty) {
        _showCommuneSelector(allCommunes);
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('❌ Erreur: $e'),
          backgroundColor: AppTheme.gpsPoor,
        ),
      );
    }
  }

  Future<void> _onExportTap(MapState mapState) async {
    final current = mapState.currentCommune;
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Exporter les corrections',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                ),
                const SizedBox(height: 8),
                Text(
                  'Génère 2 fichiers: .geojson + .csv, puis ouvre le partage.',
                  style: TextStyle(color: Colors.grey[700]),
                ),
                const SizedBox(height: 12),
                if (current != null)
                  FilledButton.icon(
                    onPressed: () => Navigator.pop(ctx, 'current'),
                    icon: const Icon(Icons.place),
                    label: Text('Commune: ${current.name}'),
                  ),
                const SizedBox(height: 8),
                OutlinedButton.icon(
                  onPressed: () => Navigator.pop(ctx, 'all'),
                  icon: const Icon(Icons.public),
                  label: const Text('Toutes les communes'),
                ),
                const SizedBox(height: 4),
              ],
            ),
          ),
        );
      },
    );

    if (choice == null) return;

    setState(() => _isExporting = true);
    try {
      final exportService = ref.read(exportServiceProvider);
      final communeRef = (choice == 'current') ? current?.communeRef : null;

      final result = await exportService.exportCorrections(
        communeRef: communeRef,
        share: true,
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '✅ Export terminé: ${result.featureCount} corrections',
          ),
          backgroundColor: AppTheme.gpsExcellent,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('❌ Export impossible: $e'),
          backgroundColor: AppTheme.gpsPoor,
        ),
      );
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  void _onStyleLoaded() {
    _mapReady = true;
    // Add initial layers if data is already loaded
    final mapState = ref.read(mapProvider);
    _updateMapLayers(mapState);
  }

  Future<void> _updateMapLayers(MapState mapState) async {
    if (_mapController == null || !_mapReady) return;

    try {
      // Remove old sources/layers first
      if (_sourcesAdded) {
        try {
          await _mapController!.removeLayer('parcels-fill');
          await _mapController!.removeLayer('parcels-border');
          await _mapController!.removeLayer('commune-border');
          await _mapController!.removeLayer('commune-fill');
          await _mapController!.removeSource('parcels-source');
          await _mapController!.removeSource('commune-source');
        } catch (_) {}
        _sourcesAdded = false;
      }

      // Add commune boundary
      if (mapState.communeGeoJson != null) {
        await _mapController!.addGeoJsonSource(
          'commune-source',
          jsonDecode(mapState.communeGeoJson!),
        );

        await _mapController!.addLayer(
          'commune-source',
          'commune-fill',
          const FillLayerProperties(
            fillColor: '#0C2C52',
            fillOpacity: 0.05,
          ),
        );

        await _mapController!.addLayer(
          'commune-source',
          'commune-border',
          const LineLayerProperties(
            lineColor: '#0C2C52',
            lineWidth: 2.5,
            lineOpacity: 0.7,
          ),
        );
      }

      // Add parcels
      if (mapState.filteredParcels.isNotEmpty) {
        await _mapController!.addGeoJsonSource(
          'parcels-source',
          jsonDecode(mapState.parcelsGeoJson),
        );

        // Fill layer with color based on parcel type
        await _mapController!.addLayer(
          'parcels-source',
          'parcels-fill',
          const FillLayerProperties(
            fillColor: [
              'match',
              ['get', 'parcel_type'],
              'sansEnquete', '#E91E63',
              'sansNumero', '#FF9800',
              '#FF6B35', // default
            ],
            fillOpacity: 0.25,
          ),
        );

        // Border layer
        await _mapController!.addLayer(
          'parcels-source',
          'parcels-border',
          const LineLayerProperties(
            lineColor: [
              'match',
              ['get', 'status'],
              'corrected', '#2196F3',
              'validated', '#0F9D58',
              'synced', '#9E9E9E',
              '#FF6B35', // default = pending
            ],
            lineWidth: 2.0,
            lineOpacity: 0.9,
          ),
        );

        _sourcesAdded = true;
      }

      // Fly to commune if available
      if (mapState.currentCommune != null) {
        final bbox = mapState.currentCommune!.bbox;
        await _mapController!.animateCamera(
          CameraUpdate.newLatLngBounds(
            LatLngBounds(
              southwest: LatLng(bbox[1], bbox[0]),
              northeast: LatLng(bbox[3], bbox[2]),
            ),
            left: 50,
            right: 50,
            top: 80,
            bottom: 120,
          ),
        );
      }
    } catch (e) {
      debugPrint('Error updating map layers: $e');
    }
  }

  void _onMapTap(Point<double> point, LatLng coordinates) async {
    if (_mapController == null) return;

    // Query features near the tap point
    final features = await _mapController!.queryRenderedFeatures(
      point,
      ['parcels-fill'],
      null,
    );

    if (features.isNotEmpty) {
      final feature = features.first;
      final id = feature['properties']?['id'];
      if (id != null) {
        ref.read(mapProvider.notifier).selectParcel(id as int);
        _showParcelSheet();
      }
    } else {
      ref.read(mapProvider.notifier).clearSelection();
    }
  }

  // ── UI actions ─────────────────────────────────────────────

  void _centerOnGps() {
    final gps = ref.read(gpsProvider);
    if (gps.hasPosition && _mapController != null) {
      _mapController!.animateCamera(
        CameraUpdate.newLatLngZoom(
          LatLng(gps.latitude!, gps.longitude!),
          15,
        ),
      );
    }
  }

  void _showParcelSheet() {
    final parcel = ref.read(mapProvider).selectedParcel;
    if (parcel == null) return;

    showModalBottomSheet(
      context: context,
      builder: (_) => ParcelInfoSheet(
        parcel: parcel,
        onCorrect: () {
          Navigator.pop(context);
          _openCorrectionForm(parcel);
        },
        onKobo: () {
          Navigator.pop(context);
          // TODO: open Kobo bridge
        },
      ),
    );
  }

  void _openCorrectionForm(Parcel parcel) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CorrectionFormScreen(parcel: parcel),
      ),
    ).then((_) {
      // Refresh parcels after returning from form
      ref.read(mapProvider.notifier).refresh();
    });
  }

  void _showCommuneSelector(List<Commune> communes) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.5,
        maxChildSize: 0.8,
        expand: false,
        builder: (context, scrollController) {
          return Container(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const Text(
                  'Sélectionner une commune',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppTheme.primary,
                  ),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: ListView.builder(
                    controller: scrollController,
                    itemCount: communes.length,
                    itemBuilder: (context, index) {
                      final c = communes[index];
                      final isSelected = ref.read(mapProvider)
                              .currentCommune
                              ?.communeRef ==
                          c.communeRef;

                      return ListTile(
                        leading: Icon(
                          Icons.location_city,
                          color: isSelected
                              ? AppTheme.accent
                              : AppTheme.primary,
                        ),
                        title: Text(
                          c.name,
                          style: TextStyle(
                            fontWeight: isSelected
                                ? FontWeight.w800
                                : FontWeight.w600,
                            color: isSelected
                                ? AppTheme.accent
                                : AppTheme.primary,
                          ),
                        ),
                        subtitle: Text(
                          '${c.departement ?? ""} · ${c.arrondissement ?? ""}',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey[600],
                          ),
                        ),
                        trailing: isSelected
                            ? const Icon(Icons.check_circle,
                                color: AppTheme.accent)
                            : null,
                        onTap: () {
                          Navigator.pop(context);
                          ref
                              .read(mapProvider.notifier)
                              .selectCommune(c.communeRef);
                        },
                      );
                    },
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _onSyncTap() {
    // TODO: wire to DeltaSyncService
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Synchronisation en cours...'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  void dispose() {
    _mapController = null;
    super.dispose();
  }
}

