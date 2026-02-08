import 'dart:convert';

import '../utils/geometry_utils.dart';

/// Topological validation service for parcel geometries.
///
/// Prevents saving geometries with:
///   - Self-intersections
///   - Insufficient vertices
///   - Degenerate (zero-area) polygons
///   - Unclosed rings
class TopoValidator {
  const TopoValidator();

  /// Validate a polygon geometry stored as GeoJSON.
  /// Returns a [ValidationResult] with details.
  ValidationResult validateGeoJson(String geomJson) {
    final errors = <String>[];

    try {
      final geom = jsonDecode(geomJson) as Map<String, dynamic>;
      final type = geom['type'] as String;

      if (type == 'Polygon') {
        _validatePolygonCoords(geom['coordinates'] as List, errors);
      } else if (type == 'MultiPolygon') {
        final polygons = geom['coordinates'] as List;
        for (var i = 0; i < polygons.length; i++) {
          _validatePolygonCoords(
            polygons[i] as List,
            errors,
            prefix: 'Polygone ${i + 1}',
          );
        }
      } else {
        errors.add('Type de géométrie non supporté: $type');
      }
    } catch (e) {
      errors.add('GeoJSON invalide: $e');
    }

    return ValidationResult(
      isValid: errors.isEmpty,
      errors: errors,
    );
  }

  /// Validate raw coordinate rings.
  ValidationResult validateRings(List<List<List<double>>> rings) {
    final errors = <String>[];
    _validateRingsList(rings, errors);
    return ValidationResult(isValid: errors.isEmpty, errors: errors);
  }

  void _validatePolygonCoords(
    List coords,
    List<String> errors, {
    String prefix = '',
  }) {
    final p = prefix.isNotEmpty ? '$prefix: ' : '';

    final rings = coords
        .map((r) => (r as List)
            .map((c) => (c as List).cast<double>().toList())
            .toList())
        .toList();

    _validateRingsList(rings, errors, prefix: p);
  }

  void _validateRingsList(
    List<List<List<double>>> rings,
    List<String> errors, {
    String prefix = '',
  }) {
    if (rings.isEmpty) {
      errors.add('${prefix}Polygone vide (aucun anneau)');
      return;
    }

    for (var i = 0; i < rings.length; i++) {
      final ring = rings[i];
      final ringLabel = i == 0 ? 'Anneau extérieur' : 'Trou $i';

      // Minimum 4 points (3 vertices + closing point)
      if (ring.length < 4) {
        errors.add('$prefix$ringLabel: trop peu de sommets '
            '(${ring.length}, minimum 4)');
        continue;
      }

      // Ring must be closed
      if (ring.first[0] != ring.last[0] || ring.first[1] != ring.last[1]) {
        errors.add('$prefix$ringLabel: anneau non fermé');
      }

      // Self-intersection check
      if (!GeometryUtils.isSimpleRing(ring)) {
        errors.add('$prefix$ringLabel: auto-intersection détectée');
      }

      // Area check (degenerate polygon)
      final area = _computeRingArea(ring);
      if (area.abs() < 1e-12) {
        errors.add('$prefix$ringLabel: surface nulle (polygone dégénéré)');
      }
    }
  }

  /// Shoelace formula for ring area (in coordinate units).
  double _computeRingArea(List<List<double>> ring) {
    double area = 0;
    for (int i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      area += ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
    }
    return area / 2;
  }
}

/// Result of a topological validation.
class ValidationResult {
  const ValidationResult({
    required this.isValid,
    this.errors = const [],
  });

  final bool isValid;
  final List<String> errors;

  String get errorSummary => errors.join('\n');
}

