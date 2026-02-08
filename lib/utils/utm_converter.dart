import 'dart:math' as math;

/// Converts UTM (EPSG:32628 — zone 28N) coordinates to WGS84 (EPSG:4326).
///
/// All PROCASEF GeoPackage data is in UTM zone 28N. GPS positions and
/// MapLibre require WGS84 lat/lng, so we convert at import time.
class UtmConverter {
  UtmConverter._();

  // WGS84 ellipsoid constants
  static const double _a = 6378137.0; // semi-major axis
  static const double _f = 1 / 298.257223563; // flattening
  static const double _e = 0.0818191908426; // eccentricity
  static const double _e2 = 0.00669437999014; // e²
  static const double _ePrime2 = 0.00673949674228; // e'²
  static const double _k0 = 0.9996; // scale factor
  static const double _falseEasting = 500000.0;
  static const double _falseNorthing = 0.0; // northern hemisphere

  /// Central meridian for UTM zone 28: -15°
  static const double _lon0 = -15.0 * math.pi / 180.0;

  /// Convert a single UTM 28N point → (longitude, latitude) in degrees.
  static List<double> toWgs84(double easting, double northing) {
    final x = easting - _falseEasting;
    final y = northing - _falseNorthing;

    final m = y / _k0;
    final mu = m /
        (_a *
            (1 -
                _e2 / 4 -
                3 * _e2 * _e2 / 64 -
                5 * _e2 * _e2 * _e2 / 256));

    final e1 =
        (1 - math.sqrt(1 - _e2)) / (1 + math.sqrt(1 - _e2));
    final phi1 = mu +
        (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * math.sin(2 * mu) +
        (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) *
            math.sin(4 * mu) +
        (151 * e1 * e1 * e1 / 96) * math.sin(6 * mu) +
        (1097 * e1 * e1 * e1 * e1 / 512) * math.sin(8 * mu);

    final sinPhi1 = math.sin(phi1);
    final cosPhi1 = math.cos(phi1);
    final tanPhi1 = math.tan(phi1);
    final n1 = _a / math.sqrt(1 - _e2 * sinPhi1 * sinPhi1);
    final t1 = tanPhi1 * tanPhi1;
    final c1 = _ePrime2 * cosPhi1 * cosPhi1;
    final r1 =
        _a * (1 - _e2) / math.pow(1 - _e2 * sinPhi1 * sinPhi1, 1.5);
    final d = x / (n1 * _k0);

    final lat = phi1 -
        (n1 * tanPhi1 / r1) *
            (d * d / 2 -
                (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * _ePrime2) *
                    d *
                    d *
                    d *
                    d /
                    24 +
                (61 +
                        90 * t1 +
                        298 * c1 +
                        45 * t1 * t1 -
                        252 * _ePrime2 -
                        3 * c1 * c1) *
                    d *
                    d *
                    d *
                    d *
                    d *
                    d /
                    720);

    final lon = _lon0 +
        (d -
                (1 + 2 * t1 + c1) * d * d * d / 6 +
                (5 -
                        2 * c1 +
                        28 * t1 -
                        3 * c1 * c1 +
                        8 * _ePrime2 +
                        24 * t1 * t1) *
                    d *
                    d *
                    d *
                    d *
                    d /
                    120) /
            cosPhi1;

    return [lon * 180.0 / math.pi, lat * 180.0 / math.pi];
  }

  /// Convert an entire coordinate ring [[easting, northing, ...], ...]
  /// to [[longitude, latitude], ...].
  static List<List<double>> convertRing(List<List<double>> ring) {
    return ring.map((pt) => toWgs84(pt[0], pt[1])).toList();
  }
}
