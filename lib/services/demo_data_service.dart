import 'dart:convert';
import '../data/local/db/app_database.dart';

/// Service to load demo/test data into the database for testing purposes.
/// This creates sample communes and parcels so the app can be tested
/// without needing to import GeoPackage files manually.
class DemoDataService {
  DemoDataService(this.appDb);

  final AppDatabase appDb;

  /// Check if demo data has already been loaded.
  Future<bool> isDemoDataLoaded() async {
    final count = await appDb.db.rawQuery(
      "SELECT COUNT(*) as cnt FROM communes WHERE commune_ref LIKE 'DEMO_%'",
    );
    return (count.first['cnt'] as int) > 0;
  }

  /// Load demo data: 2 communes with several parcels each.
  /// These are sample polygons in the Kédougou region of Senegal.
  Future<Map<String, int>> loadDemoData() async {
    final counts = {'communes': 0, 'parcels': 0};

    // ══════════════════════════════════════════════════════════
    // Demo Commune 1: BALA (approximate boundaries)
    // ══════════════════════════════════════════════════════════
    final balaGeom = {
      'type': 'MultiPolygon',
      'coordinates': [
        [
          [
            [-12.35, 12.75],
            [-12.25, 12.75],
            [-12.25, 12.85],
            [-12.35, 12.85],
            [-12.35, 12.75],
          ]
        ]
      ],
    };

    final balaId = await appDb.db.insert('communes', {
      'commune_ref': 'DEMO_BALA',
      'name': 'BALA (Démo)',
      'region': 'Tambacounda',
      'departement': 'Goudiry',
      'min_x': -12.35,
      'min_y': 12.75,
      'max_x': -12.25,
      'max_y': 12.85,
      'geom_json': jsonEncode(balaGeom),
    });

    await appDb.insertCommuneRTree(
      id: balaId,
      minX: -12.35,
      maxX: -12.25,
      minY: 12.75,
      maxY: 12.85,
    );
    counts['communes'] = counts['communes']! + 1;

    // ══════════════════════════════════════════════════════════
    // Demo Commune 2: MISSIRAH (approximate boundaries)
    // ══════════════════════════════════════════════════════════
    final missirahGeom = {
      'type': 'MultiPolygon',
      'coordinates': [
        [
          [
            [-12.50, 12.60],
            [-12.40, 12.60],
            [-12.40, 12.70],
            [-12.50, 12.70],
            [-12.50, 12.60],
          ]
        ]
      ],
    };

    final missirahId = await appDb.db.insert('communes', {
      'commune_ref': 'DEMO_MISSIRAH',
      'name': 'MISSIRAH (Démo)',
      'region': 'Tambacounda',
      'departement': 'Tambacounda',
      'min_x': -12.50,
      'min_y': 12.60,
      'max_x': -12.40,
      'max_y': 12.70,
      'geom_json': jsonEncode(missirahGeom),
    });

    await appDb.insertCommuneRTree(
      id: missirahId,
      minX: -12.50,
      maxX: -12.40,
      minY: 12.60,
      maxY: 12.70,
    );
    counts['communes'] = counts['communes']! + 1;

    // ══════════════════════════════════════════════════════════
    // Demo Parcels for BALA (sans enquête)
    // ══════════════════════════════════════════════════════════
    final now = DateTime.now().toUtc().toIso8601String();

    final balaParcels = [
      _makeParcelGeom(-12.32, 12.78, 0.01, 0.008),
      _makeParcelGeom(-12.30, 12.78, 0.012, 0.009),
      _makeParcelGeom(-12.28, 12.79, 0.011, 0.007),
      _makeParcelGeom(-12.31, 12.80, 0.009, 0.01),
      _makeParcelGeom(-12.29, 12.81, 0.013, 0.008),
    ];

    for (var i = 0; i < balaParcels.length; i++) {
      final geom = balaParcels[i];
      final bbox = _bboxFromPolygon(geom);
      
      final parcelId = await appDb.db.insert('parcels', {
        'num_parcel': null, // sans enquête = no number yet
        'commune_ref': 'DEMO_BALA',
        'parcel_type': 'sans_enquete',
        'status': 'pending',
        'min_x': bbox[0],
        'min_y': bbox[1],
        'max_x': bbox[2],
        'max_y': bbox[3],
        'geom_json': jsonEncode(geom),
        'source_file': 'demo_data',
        'updated_at': now,
        'is_deleted': 0,
      });

      await appDb.insertParcelRTree(
        id: parcelId,
        minX: bbox[0],
        maxX: bbox[2],
        minY: bbox[1],
        maxY: bbox[3],
      );
      counts['parcels'] = counts['parcels']! + 1;
    }

    // ══════════════════════════════════════════════════════════
    // Demo Parcels for BALA (sans numéro)
    // ══════════════════════════════════════════════════════════
    final balaSansNumeroParcels = [
      _makeParcelGeom(-12.33, 12.76, 0.008, 0.006),
      _makeParcelGeom(-12.31, 12.77, 0.01, 0.007),
      _makeParcelGeom(-12.27, 12.78, 0.009, 0.008),
    ];

    for (var i = 0; i < balaSansNumeroParcels.length; i++) {
      final geom = balaSansNumeroParcels[i];
      final bbox = _bboxFromPolygon(geom);

      final parcelId = await appDb.db.insert('parcels', {
        'num_parcel': '0', // sans numéro = has a '0' placeholder
        'commune_ref': 'DEMO_BALA',
        'parcel_type': 'sans_numero',
        'status': 'pending',
        'min_x': bbox[0],
        'min_y': bbox[1],
        'max_x': bbox[2],
        'max_y': bbox[3],
        'geom_json': jsonEncode(geom),
        'source_file': 'demo_data',
        'updated_at': now,
        'is_deleted': 0,
      });

      await appDb.insertParcelRTree(
        id: parcelId,
        minX: bbox[0],
        maxX: bbox[2],
        minY: bbox[1],
        maxY: bbox[3],
      );
      counts['parcels'] = counts['parcels']! + 1;
    }

    // ══════════════════════════════════════════════════════════
    // Demo Parcels for MISSIRAH
    // ══════════════════════════════════════════════════════════
    final missirahParcels = [
      _makeParcelGeom(-12.47, 12.63, 0.012, 0.009),
      _makeParcelGeom(-12.45, 12.64, 0.01, 0.008),
      _makeParcelGeom(-12.43, 12.65, 0.011, 0.01),
      _makeParcelGeom(-12.46, 12.66, 0.009, 0.007),
    ];

    for (var i = 0; i < missirahParcels.length; i++) {
      final geom = missirahParcels[i];
      final bbox = _bboxFromPolygon(geom);

      final parcelId = await appDb.db.insert('parcels', {
        'num_parcel': null,
        'commune_ref': 'DEMO_MISSIRAH',
        'parcel_type': 'sans_enquete',
        'status': 'pending',
        'min_x': bbox[0],
        'min_y': bbox[1],
        'max_x': bbox[2],
        'max_y': bbox[3],
        'geom_json': jsonEncode(geom),
        'source_file': 'demo_data',
        'updated_at': now,
        'is_deleted': 0,
      });

      await appDb.insertParcelRTree(
        id: parcelId,
        minX: bbox[0],
        maxX: bbox[2],
        minY: bbox[1],
        maxY: bbox[3],
      );
      counts['parcels'] = counts['parcels']! + 1;
    }

    return counts;
  }

  /// Create a simple rectangular polygon geometry.
  Map<String, dynamic> _makeParcelGeom(
    double lng,
    double lat,
    double width,
    double height,
  ) {
    return {
      'type': 'Polygon',
      'coordinates': [
        [
          [lng, lat],
          [lng + width, lat],
          [lng + width, lat + height],
          [lng, lat + height],
          [lng, lat],
        ]
      ],
    };
  }

  /// Extract bounding box from a polygon geometry.
  List<double> _bboxFromPolygon(Map<String, dynamic> geom) {
    final coords = geom['coordinates'] as List;
    final ring = coords[0] as List;

    double minX = double.infinity;
    double minY = double.infinity;
    double maxX = double.negativeInfinity;
    double maxY = double.negativeInfinity;

    for (final pt in ring) {
      final coord = pt as List;
      final x = (coord[0] as num).toDouble();
      final y = (coord[1] as num).toDouble();
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }

    return [minX, minY, maxX, maxY];
  }
}
