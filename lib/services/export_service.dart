import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../data/local/dao/corrections_dao.dart';

class ExportResult {
  ExportResult({
    required this.geoJsonPath,
    required this.csvPath,
    required this.featureCount,
  });

  final String geoJsonPath;
  final String csvPath;
  final int featureCount;
}

/// Exports corrected parcels from local SQLite to GeoJSON/CSV files.
///
/// Files are written to the app documents directory (sandbox-safe on iOS/Android)
/// and optionally shared via the platform share sheet.
class ExportService {
  ExportService({required this.correctionsDao});

  final CorrectionsDao correctionsDao;

  Future<ExportResult> exportCorrections({
    String? communeRef,
    bool share = true,
  }) async {
    final rows = await correctionsDao.findCorrectionsWithParcels(
      communeRef: communeRef,
    );

    final now = DateTime.now().toUtc();
    final stamp = _timestamp(now);
    final dir = await getApplicationDocumentsDirectory();
    final exportDir = Directory(p.join(dir.path, 'exports'));
    if (!exportDir.existsSync()) {
      exportDir.createSync(recursive: true);
    }

    final baseName = communeRef == null
        ? 'corrections_all_$stamp'
        : 'corrections_${communeRef}_$stamp';

    final geoJsonPath = p.join(exportDir.path, '$baseName.geojson');
    final csvPath = p.join(exportDir.path, '$baseName.csv');

    final featureCollection = <String, Object?>{
      'type': 'FeatureCollection',
      'name': baseName,
      'exported_at': now.toIso8601String(),
      'features': rows.map(_toFeature).toList(),
    };

    await File(geoJsonPath).writeAsString(
      const JsonEncoder.withIndent('  ').convert(featureCollection),
      flush: true,
    );

    await File(csvPath).writeAsString(
      _toCsv(rows),
      flush: true,
    );

    final result = ExportResult(
      geoJsonPath: geoJsonPath,
      csvPath: csvPath,
      featureCount: rows.length,
    );

    if (share) {
      await Share.shareXFiles(
        [XFile(geoJsonPath), XFile(csvPath)],
        text: communeRef == null
            ? 'Exports CorrectionFIELD (toutes communes)'
            : 'Exports CorrectionFIELD (commune: $communeRef)',
      );
    }

    return result;
  }

  Map<String, Object?> _toFeature(Map<String, Object?> row) {
    final parcelGeom = row['parcel_geom_json'] as String?;
    final correctionGeom = row['correction_geom_json'] as String?;

    // Prefer corrected geometry if present; fallback to parcel geometry.
    final geomJson = (correctionGeom != null && correctionGeom.trim().isNotEmpty)
        ? correctionGeom
        : (parcelGeom ?? '{"type":"Polygon","coordinates":[]}');

    final geometry = jsonDecode(geomJson) as Map<String, dynamic>;

    return <String, Object?>{
      'type': 'Feature',
      'id': row['parcel_id'],
      'geometry': geometry,
      'properties': <String, Object?>{
        'parcel_id': row['parcel_id'],
        'commune_ref': row['commune_ref'],
        'parcel_type': row['parcel_type'],
        'parcel_status': row['parcel_status'],
        'original_num_parcel': row['original_num_parcel'],
        'corrected_num_parcel': row['corrected_num_parcel'],
        'enqueteur': row['enqueteur'],
        'survey_status': row['survey_status'],
        'notes': row['notes'],
        'gps_latitude': row['gps_latitude'],
        'gps_longitude': row['gps_longitude'],
        'gps_accuracy': row['gps_accuracy'],
        'correction_uuid': row['correction_uuid'],
        'correction_created_at': row['correction_created_at'],
        'correction_updated_at': row['correction_updated_at'],
        'dirty': row['dirty'],
        'source_file': row['source_file'],
      },
    };
  }

  String _toCsv(List<Map<String, Object?>> rows) {
    const headers = <String>[
      'parcel_id',
      'commune_ref',
      'parcel_type',
      'parcel_status',
      'original_num_parcel',
      'corrected_num_parcel',
      'enqueteur',
      'survey_status',
      'notes',
      'gps_latitude',
      'gps_longitude',
      'gps_accuracy',
      'correction_uuid',
      'correction_created_at',
      'correction_updated_at',
      'dirty',
      'source_file',
    ];

    final buffer = StringBuffer();
    buffer.writeln(headers.join(','));

    for (final row in rows) {
      final values = <Object?>[
        row['parcel_id'],
        row['commune_ref'],
        row['parcel_type'],
        row['parcel_status'],
        row['original_num_parcel'],
        row['corrected_num_parcel'],
        row['enqueteur'],
        row['survey_status'],
        row['notes'],
        row['gps_latitude'],
        row['gps_longitude'],
        row['gps_accuracy'],
        row['correction_uuid'],
        row['correction_created_at'],
        row['correction_updated_at'],
        row['dirty'],
        row['source_file'],
      ];

      buffer.writeln(values.map(_csvEscape).join(','));
    }

    return buffer.toString();
  }

  String _csvEscape(Object? value) {
    if (value == null) return '';
    final text = value.toString();
    final mustQuote =
        text.contains(',') || text.contains('\n') || text.contains('"');
    if (!mustQuote) return text;
    final escaped = text.replaceAll('"', '""');
    return '"$escaped"';
  }

  String _timestamp(DateTime dt) {
    String two(int v) => v.toString().padLeft(2, '0');
    return '${dt.year}${two(dt.month)}${two(dt.day)}_${two(dt.hour)}${two(dt.minute)}${two(dt.second)}Z';
  }
}
