import 'dart:math' as math;

/// Pure-Dart geometry utilities for offline spatial operations.
///
/// Provides point-in-polygon, bounding-box checks, self-intersection
/// detection, and centroid calculation — no native extensions required.
class GeometryUtils {
  GeometryUtils._();

  // ────────────────────────────────────────────────────────────
  // Point-in-polygon (ray-casting algorithm)
  // ────────────────────────────────────────────────────────────

  /// Check if [point] (lng, lat) lies inside a polygon defined by [rings].
  /// First ring = exterior, subsequent = holes.
  /// Each ring is [[lng, lat], [lng, lat], ...].
  static bool pointInPolygon(
      List<double> point, List<List<List<double>>> rings) {
    if (rings.isEmpty) return false;

    // Must be inside exterior ring
    var inside = _raycast(point, rings[0]);

    // Must not be inside any hole
    for (var h = 1; h < rings.length; h++) {
      if (_raycast(point, rings[h])) {
        inside = false;
        break;
      }
    }

    return inside;
  }

  /// Check if [point] lies inside a MultiPolygon.
  static bool pointInMultiPolygon(
      List<double> point, List<List<List<List<double>>>> multiPolygon) {
    for (final polygon in multiPolygon) {
      if (pointInPolygon(point, polygon)) return true;
    }
    return false;
  }

  static bool _raycast(List<double> point, List<List<double>> ring) {
    final px = point[0];
    final py = point[1];
    var inside = false;

    for (int i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      final xi = ring[i][0], yi = ring[i][1];
      final xj = ring[j][0], yj = ring[j][1];

      if (((yi > py) != (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }

    return inside;
  }

  // ────────────────────────────────────────────────────────────
  // Bounding box
  // ────────────────────────────────────────────────────────────

  /// Compute bounding box [minX, minY, maxX, maxY] for a list of rings.
  static List<double> bboxOfRings(List<List<List<double>>> rings) {
    var minX = double.infinity;
    var minY = double.infinity;
    var maxX = double.negativeInfinity;
    var maxY = double.negativeInfinity;

    for (final ring in rings) {
      for (final pt in ring) {
        if (pt[0] < minX) minX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] > maxY) maxY = pt[1];
      }
    }

    return [minX, minY, maxX, maxY];
  }

  /// Compute bounding box for a MultiPolygon.
  static List<double> bboxOfMultiPolygon(
      List<List<List<List<double>>>> multiPolygon) {
    var minX = double.infinity;
    var minY = double.infinity;
    var maxX = double.negativeInfinity;
    var maxY = double.negativeInfinity;

    for (final polygon in multiPolygon) {
      final bbox = bboxOfRings(polygon);
      if (bbox[0] < minX) minX = bbox[0];
      if (bbox[1] < minY) minY = bbox[1];
      if (bbox[2] > maxX) maxX = bbox[2];
      if (bbox[3] > maxY) maxY = bbox[3];
    }

    return [minX, minY, maxX, maxY];
  }

  /// Check if two bounding boxes intersect.
  static bool bboxIntersects(List<double> a, List<double> b) {
    return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
  }

  /// Check if a point is inside a bounding box.
  static bool pointInBbox(List<double> point, List<double> bbox) {
    return point[0] >= bbox[0] &&
        point[0] <= bbox[2] &&
        point[1] >= bbox[1] &&
        point[1] <= bbox[3];
  }

  // ────────────────────────────────────────────────────────────
  // Centroid
  // ────────────────────────────────────────────────────────────

  /// Compute centroid of a polygon (using exterior ring only).
  static List<double> centroidOfRing(List<List<double>> ring) {
    double cx = 0, cy = 0, area = 0;

    for (int i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      final cross = ring[i][0] * ring[j][1] - ring[j][0] * ring[i][1];
      cx += (ring[i][0] + ring[j][0]) * cross;
      cy += (ring[i][1] + ring[j][1]) * cross;
      area += cross;
    }

    area *= 0.5;
    if (area.abs() < 1e-10) {
      // Degenerate polygon — return average of points
      double sx = 0, sy = 0;
      for (final pt in ring) {
        sx += pt[0];
        sy += pt[1];
      }
      return [sx / ring.length, sy / ring.length];
    }

    cx /= (6 * area);
    cy /= (6 * area);
    return [cx, cy];
  }

  // ────────────────────────────────────────────────────────────
  // Self-intersection detection (simplified)
  // ────────────────────────────────────────────────────────────

  /// Returns true if the ring has no self-intersections.
  /// Uses a brute-force segment-vs-segment check (O(n²)).
  /// Fine for typical parcel polygons (< 200 vertices).
  static bool isSimpleRing(List<List<double>> ring) {
    final n = ring.length;
    if (n < 4) return false; // need at least 3 + closing point

    for (var i = 0; i < n - 1; i++) {
      for (var j = i + 2; j < n - 1; j++) {
        // Skip adjacent segments (they share a vertex)
        if (i == 0 && j == n - 2) continue;

        if (_segmentsIntersect(ring[i], ring[i + 1], ring[j], ring[j + 1])) {
          return false;
        }
      }
    }

    return true;
  }

  static bool _segmentsIntersect(
      List<double> a, List<double> b, List<double> c, List<double> d) {
    final d1 = _cross(c, d, a);
    final d2 = _cross(c, d, b);
    final d3 = _cross(a, b, c);
    final d4 = _cross(a, b, d);

    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
        ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
      return true;
    }

    // Collinear checks
    if (d1.abs() < 1e-10 && _onSegment(c, d, a)) return true;
    if (d2.abs() < 1e-10 && _onSegment(c, d, b)) return true;
    if (d3.abs() < 1e-10 && _onSegment(a, b, c)) return true;
    if (d4.abs() < 1e-10 && _onSegment(a, b, d)) return true;

    return false;
  }

  static double _cross(List<double> a, List<double> b, List<double> c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }

  static bool _onSegment(List<double> a, List<double> b, List<double> c) {
    return math.min(a[0], b[0]) <= c[0] &&
        c[0] <= math.max(a[0], b[0]) &&
        math.min(a[1], b[1]) <= c[1] &&
        c[1] <= math.max(a[1], b[1]);
  }

  // ────────────────────────────────────────────────────────────
  // Haversine distance (meters)
  // ────────────────────────────────────────────────────────────

  /// Distance in meters between two WGS84 points.
  static double haversineMeters(
      double lat1, double lon1, double lat2, double lon2) {
    const r = 6371000.0; // Earth radius in meters
    final dLat = _degToRad(lat2 - lat1);
    final dLon = _degToRad(lon2 - lon1);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(_degToRad(lat1)) *
            math.cos(_degToRad(lat2)) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return r * c;
  }

  static double _degToRad(double deg) => deg * math.pi / 180.0;
}
