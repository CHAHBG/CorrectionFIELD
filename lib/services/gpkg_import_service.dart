import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:logger/logger.dart';
import 'package:sqflite/sqflite.dart';

import '../utils/geometry_utils.dart';
import '../utils/gpkg_binary_parser.dart';
import '../utils/utm_converter.dart';
import '../data/local/db/app_database.dart';

final _log = Logger(printer: PrettyPrinter(methodCount: 0));

/// Imports GeoPackage (.gpkg) files into the local SQLite database.
///
/// Handles:
///   1. Reading GPKG files (which are SQLite databases)
///   2. Parsing GeoPackage Binary geometries
///   3. Converting UTM 28N → WGS84 coordinates
///   4. Inserting into communes / parcels tables with R-Tree indexing
class GpkgImportService {
  GpkgImportService(this.appDb);

  final AppDatabase appDb;

  // ── Import communes ────────────────────────────────────────

  /// Import a single commune GeoPackage file.
  /// The file contains a table like `CCRCA_BALA` with a MULTIPOLYGON geom.
  Future<int> importCommuneGpkg(String gpkgPath) async {
    final communeName = _communeNameFromPath(gpkgPath);
    _log.i('Importing commune: $communeName from $gpkgPath');

    final gpkgDb = await openReadOnlyDatabase(gpkgPath);

    try {
      // Discover the feature table name
      final featureTable = await _getFeatureTableName(gpkgDb);
      if (featureTable == null) {
        _log.w('No feature table found in $gpkgPath');
        return 0;
      }

      // Read all rows
      final rows = await gpkgDb.rawQuery('SELECT * FROM "$featureTable"');
      var imported = 0;

      for (final row in rows) {
        final geomBlob = row['geom'];
        if (geomBlob == null) continue;

        final Uint8List geomBytes;
        if (geomBlob is Uint8List) {
          geomBytes = geomBlob;
        } else if (geomBlob is List<int>) {
          geomBytes = Uint8List.fromList(geomBlob);
        } else {
          continue;
        }

        // Parse GPKB → geometry structure
        final geom = GpkgGeometryParser.parseGpkgBinary(geomBytes);
        if (geom == null) continue;

        // Convert UTM 28N → WGS84
        final wgs84Geom = _convertGeometryToWgs84(geom);
        if (wgs84Geom == null) continue;

        // Compute bounding box
        final bbox = _computeBbox(wgs84Geom);
        if (bbox == null) continue;

        final geomJson = jsonEncode(wgs84Geom);
        final communeRef = (row['COD_ENTITE'] as String?) ?? communeName;
        final name = (row['CCRCA'] as String?) ?? communeName;

        final id = await appDb.db.insert('communes', {
          'commune_ref': communeRef,
          'name': name,
          'region': row['REG'] as String?,
          'departement': row['DEPT'] as String?,
          'arrondissement': row['CAV'] as String?,
          'superficie_ha': row['SUP_HA'] as double?,
          'min_x': bbox[0],
          'min_y': bbox[1],
          'max_x': bbox[2],
          'max_y': bbox[3],
          'geom_json': geomJson,
        }, conflictAlgorithm: ConflictAlgorithm.replace);

        // R-Tree entry
        await appDb.insertCommuneRTree(
          id: id,
          minX: bbox[0],
          maxX: bbox[2],
          minY: bbox[1],
          maxY: bbox[3],
        );

        imported++;
      }

      _log.i('Imported $imported commune features from $communeName');
      return imported;
    } finally {
      await gpkgDb.close();
    }
  }

  // ── Import parcels ─────────────────────────────────────────

  /// Import a single parcel GeoPackage file.
  /// [parcelType] is 'sans_enquete' or 'sans_numero'.
  /// [communeRef] is looked up from the commune name in the filename.
  Future<int> importParcelGpkg(
    String gpkgPath, {
    required String parcelType,
  }) async {
    final communeName = _communeNameFromParcelPath(gpkgPath);
    _log.i('Importing $parcelType parcels for $communeName');

    // Find the commune_ref by name
    final communeRow = await appDb.db.query(
      'communes',
      where: 'UPPER(name) = UPPER(?)',
      whereArgs: [communeName],
    );

    String communeRef;
    if (communeRow.isNotEmpty) {
      communeRef = communeRow.first['commune_ref'] as String;
    } else {
      // Fallback: use the commune name itself
      _log.w('Commune "$communeName" not found in DB, using name as ref');
      communeRef = communeName;
    }

    final gpkgDb = await openReadOnlyDatabase(gpkgPath);

    try {
      final featureTable = await _getFeatureTableName(gpkgDb);
      if (featureTable == null) return 0;

      final rows = await gpkgDb.rawQuery('SELECT * FROM "$featureTable"');
      final now = DateTime.now().toUtc().toIso8601String();
      var imported = 0;

      // Use a batch for performance
      final batch = appDb.db.batch();

      for (final row in rows) {
        final geomBlob = row['geom'];
        if (geomBlob == null) continue;

        final Uint8List geomBytes;
        if (geomBlob is Uint8List) {
          geomBytes = geomBlob;
        } else if (geomBlob is List<int>) {
          geomBytes = Uint8List.fromList(geomBlob);
        } else {
          continue;
        }

        final geom = GpkgGeometryParser.parseGpkgBinary(geomBytes);
        if (geom == null) continue;

        final wgs84Geom = _convertGeometryToWgs84(geom);
        if (wgs84Geom == null) continue;

        final bbox = _computeBbox(wgs84Geom);
        if (bbox == null) continue;

        final numParcel = row['Num_parcel'] as String?;
        final sourceFile = row['source_file'] as String?;
        final layer = row['layer'] as String?;

        // For sans_numero, num_parcel is '0' or null — normalize to null
        final effectiveNum =
            (numParcel == null || numParcel == '0') ? null : numParcel;

        batch.insert('parcels', {
          'num_parcel': effectiveNum,
          'commune_ref': communeRef,
          'parcel_type': parcelType,
          'source_file': sourceFile,
          'layer': layer,
          'min_x': bbox[0],
          'min_y': bbox[1],
          'max_x': bbox[2],
          'max_y': bbox[3],
          'geom_json': jsonEncode(wgs84Geom),
          'status': 'pending',
          'updated_at': now,
          'is_deleted': 0,
        });

        imported++;
      }

      // Execute batch
      final ids = await batch.commit();

      // Build R-Tree entries (need actual IDs from the inserts)
      // Re-read the inserted parcels for this commune to get their IDs
      final insertedParcels = await appDb.db.rawQuery('''
        SELECT id, min_x, min_y, max_x, max_y FROM parcels
        WHERE commune_ref = ? AND parcel_type = ?
        AND id NOT IN (SELECT id FROM rtree_parcels)
      ''', [communeRef, parcelType]);

      for (final p in insertedParcels) {
        try {
          await appDb.insertParcelRTree(
            id: p['id'] as int,
            minX: p['min_x'] as double,
            maxX: p['max_x'] as double,
            minY: p['min_y'] as double,
            maxY: p['max_y'] as double,
          );
        } catch (_) {
          // R-Tree entry might already exist
        }
      }

      _log.i('Imported $imported parcels ($parcelType) for $communeName');
      return imported;
    } finally {
      await gpkgDb.close();
    }
  }

  // ── Batch import all data from a directory ─────────────────

  /// Import all GeoPackage files from the data/ directory structure.
  /// [dataDir] should point to the folder containing:
  ///   - Communes Boundou Procasef/
  ///   - Parcelles_sans_Enquete/
  ///   - Parcelles_sans_Numero/
  ///
  /// Returns a summary map with counts.
  Future<Map<String, int>> importAllFromDirectory(String dataDir) async {
    final counts = <String, int>{
      'communes': 0,
      'sans_enquete': 0,
      'sans_numero': 0,
    };

    // 1) Import communes first (parcels reference them)
    final communesDir = Directory('$dataDir/Communes Boundou Procasef');
    if (await communesDir.exists()) {
      final gpkgFiles = communesDir
          .listSync()
          .whereType<File>()
          .where((f) => f.path.endsWith('.gpkg'));

      for (final file in gpkgFiles) {
        final n = await importCommuneGpkg(file.path);
        counts['communes'] = counts['communes']! + n;
      }
    }

    // 2) Import parcelles sans enquête
    final sansEnqueteDir = Directory('$dataDir/Parcelles_sans_Enquete');
    if (await sansEnqueteDir.exists()) {
      final gpkgFiles = sansEnqueteDir
          .listSync()
          .whereType<File>()
          .where((f) => f.path.endsWith('.gpkg'));

      for (final file in gpkgFiles) {
        final n = await importParcelGpkg(
          file.path,
          parcelType: 'sans_enquete',
        );
        counts['sans_enquete'] = counts['sans_enquete']! + n;
      }
    }

    // 3) Import parcelles sans numéro
    final sansNumeroDir = Directory('$dataDir/Parcelles_sans_Numero');
    if (await sansNumeroDir.exists()) {
      final gpkgFiles = sansNumeroDir
          .listSync()
          .whereType<File>()
          .where((f) => f.path.endsWith('.gpkg'));

      for (final file in gpkgFiles) {
        final n = await importParcelGpkg(
          file.path,
          parcelType: 'sans_numero',
        );
        counts['sans_numero'] = counts['sans_numero']! + n;
      }
    }

    final version = DateTime.now().millisecondsSinceEpoch.toString();
    await appDb.setMeta('import_version', version);

    _log.i('Import complete: $counts');
    return counts;
  }

  // ── Geometry conversion helpers ────────────────────────────

  /// Convert a parsed geometry from UTM 28N to WGS84.
  Map<String, dynamic>? _convertGeometryToWgs84(Map<String, dynamic> geom) {
    final type = geom['type'] as String;
    final coords = geom['coordinates'];

    try {
      switch (type) {
        case 'MultiPolygon':
          final converted = (coords as List).map((polygon) {
            return (polygon as List).map((ring) {
              return (ring as List).map((pt) {
                final point = (pt as List).cast<double>();
                return UtmConverter.toWgs84(point[0], point[1]);
              }).toList();
            }).toList();
          }).toList();
          return {'type': 'MultiPolygon', 'coordinates': converted};

        case 'Polygon':
          final converted = (coords as List).map((ring) {
            return (ring as List).map((pt) {
              final point = (pt as List).cast<double>();
              return UtmConverter.toWgs84(point[0], point[1]);
            }).toList();
          }).toList();
          return {'type': 'Polygon', 'coordinates': converted};

        case 'MultiLineString':
          // Convert lines to polygon rings (close them)
          final converted = (coords as List).map((line) {
            final ring = (line as List).map((pt) {
              final point = (pt as List).cast<double>();
              return UtmConverter.toWgs84(point[0], point[1]);
            }).toList();
            // Close ring if not already closed
            if (ring.length > 2 &&
                (ring.first[0] != ring.last[0] ||
                    ring.first[1] != ring.last[1])) {
              ring.add([ring.first[0], ring.first[1]]);
            }
            return [ring]; // each linestring becomes a polygon ring
          }).toList();
          return {'type': 'MultiPolygon', 'coordinates': converted};

        case 'LineString':
          final ring = (coords as List).map((pt) {
            final point = (pt as List).cast<double>();
            return UtmConverter.toWgs84(point[0], point[1]);
          }).toList();
          if (ring.length > 2 &&
              (ring.first[0] != ring.last[0] ||
                  ring.first[1] != ring.last[1])) {
            ring.add([ring.first[0], ring.first[1]]);
          }
          return {
            'type': 'Polygon',
            'coordinates': [ring]
          };

        default:
          _log.w('Unsupported geometry type: $type');
          return null;
      }
    } catch (e) {
      _log.e('Error converting geometry: $e');
      return null;
    }
  }

  /// Compute [minX, minY, maxX, maxY] bounding box from WGS84 GeoJSON geom.
  List<double>? _computeBbox(Map<String, dynamic> geom) {
    final type = geom['type'] as String;
    final coords = geom['coordinates'];

    try {
      if (type == 'MultiPolygon') {
        return GeometryUtils.bboxOfMultiPolygon(
          (coords as List)
              .map((p) => (p as List)
                  .map((r) => (r as List)
                      .map((c) => (c as List).cast<double>().toList())
                      .toList())
                  .toList())
              .toList(),
        );
      } else if (type == 'Polygon') {
        return GeometryUtils.bboxOfRings(
          (coords as List)
              .map((r) => (r as List)
                  .map((c) => (c as List).cast<double>().toList())
                  .toList())
              .toList(),
        );
      }
    } catch (e) {
      _log.e('Error computing bbox: $e');
    }
    return null;
  }

  // ── Filename parsing helpers ───────────────────────────────

  /// Extract commune name from a commune GPKG path.
  /// e.g., ".../BALA.gpkg" → "BALA"
  String _communeNameFromPath(String path) {
    final filename = path.split('/').last;
    return filename.replaceAll('.gpkg', '');
  }

  /// Extract commune name from a parcel GPKG filename.
  /// e.g., "NO_SURVEY_NOT_JOINED_BALA_LineStringZ_final_PROCESSED.gpkg" → "BALA"
  /// e.g., "NO_NUM_NOT_JOINED_MEDINA_BAFFE_LineStringZ_final_PROCESSED.gpkg" → "MEDINA BAFFE"
  String _communeNameFromParcelPath(String path) {
    final filename = path.split('/').last.replaceAll('.gpkg', '');

    // Remove known prefixes and suffix
    var name = filename
        .replaceFirst(RegExp(r'^NO_SURVEY_NOT_JOINED_'), '')
        .replaceFirst(RegExp(r'^NO_NUM_NOT_JOINED_'), '')
        .replaceFirst(RegExp(r'_LineStringZ_final_PROCESSED$'), '');

    // Replace underscores with spaces (for names like MEDINA_BAFFE)
    name = name.replaceAll('_', ' ');

    return name;
  }

  /// Get the feature table name from a GeoPackage.
  Future<String?> _getFeatureTableName(Database gpkgDb) async {
    try {
      final contents = await gpkgDb.rawQuery(
        "SELECT table_name FROM gpkg_contents WHERE data_type = 'features' LIMIT 1",
      );
      if (contents.isNotEmpty) {
        return contents.first['table_name'] as String;
      }
    } catch (_) {}

    // Fallback: try gpkg_contents without filter
    try {
      final contents = await gpkgDb.rawQuery(
        'SELECT table_name FROM gpkg_contents LIMIT 1',
      );
      if (contents.isNotEmpty) {
        return contents.first['table_name'] as String;
      }
    } catch (_) {}

    return null;
  }
}
