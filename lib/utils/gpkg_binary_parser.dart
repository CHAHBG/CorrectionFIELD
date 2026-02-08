import 'dart:typed_data';

/// Parses GeoPackage Binary (GPKB) geometry blobs.
///
/// GeoPackage Binary format:
///   - 2 bytes: magic "GP" (0x47, 0x50)
///   - 1 byte : version
///   - 1 byte : flags (bit 0 = byte order, bits 1-3 = envelope type)
///   - 4 bytes: SRID (int32)
///   - envelope (variable, depending on envelope type)
///   - WKB geometry
///
/// We extract WKB and parse it into coordinate arrays.
class GpkgGeometryParser {
  GpkgGeometryParser._();

  /// Parse a GPKB blob into a GeoJSON-compatible coordinate structure.
  /// Returns a Map with 'type' and 'coordinates'.
  static Map<String, dynamic>? parseGpkgBinary(Uint8List bytes) {
    if (bytes.length < 8) return null;

    // Verify magic bytes "GP"
    if (bytes[0] != 0x47 || bytes[1] != 0x50) return null;

    // Flags byte
    final flags = bytes[3];
    final byteOrder = flags & 0x01; // 0 = big-endian, 1 = little-endian
    final envelopeType = (flags >> 1) & 0x07;
    final isEmpty = (flags >> 4) & 0x01;

    if (isEmpty == 1) return null;

    // Calculate envelope size in bytes
    int envelopeSize;
    switch (envelopeType) {
      case 0:
        envelopeSize = 0;
        break;
      case 1:
        envelopeSize = 32; // minx, maxx, miny, maxy (4 doubles)
        break;
      case 2:
        envelopeSize = 48; // + minz, maxz
        break;
      case 3:
        envelopeSize = 48; // + minm, maxm
        break;
      case 4:
        envelopeSize = 64; // + minz, maxz, minm, maxm
        break;
      default:
        envelopeSize = 0;
    }

    final wkbOffset = 8 + envelopeSize;
    if (wkbOffset >= bytes.length) return null;

    final wkbBytes = bytes.sublist(wkbOffset);
    return _parseWkb(wkbBytes);
  }

  /// Parse WKB into a GeoJSON-like structure.
  static Map<String, dynamic>? _parseWkb(Uint8List bytes) {
    if (bytes.length < 5) return null;

    final byteData = ByteData.sublistView(bytes);
    final endian =
        bytes[0] == 1 ? Endian.little : Endian.big;

    // WKB type (uint32) — may include Z/M flags in high bytes
    final rawType = byteData.getUint32(1, endian);
    // Strip Z/M flags: types can be 1xxx (Z), 2xxx (M), 3xxx (ZM)
    final wkbType = rawType % 1000;

    var offset = 5;

    switch (wkbType) {
      case 1: // Point
        final coords = _readPoint(byteData, offset, endian, rawType >= 1000);
        return {'type': 'Point', 'coordinates': coords.point};

      case 2: // LineString
        final result =
            _readLineString(byteData, offset, endian, rawType >= 1000);
        return {'type': 'LineString', 'coordinates': result.coords};

      case 3: // Polygon
        final result =
            _readPolygon(byteData, offset, endian, rawType >= 1000);
        return {'type': 'Polygon', 'coordinates': result.coords};

      case 6: // MultiPolygon
        final numGeoms = byteData.getUint32(offset, endian);
        offset += 4;
        final polygons = <List<List<List<double>>>>[];
        for (var i = 0; i < numGeoms; i++) {
          // Each sub-geometry has its own byte-order + type header
          final subEndian =
              bytes[offset] == 1 ? Endian.little : Endian.big;
          final subRawType = byteData.getUint32(offset + 1, subEndian);
          offset += 5;
          final hasZ = subRawType >= 1000;
          final result = _readPolygon(byteData, offset, subEndian, hasZ);
          polygons.add(result.coords);
          offset = result.nextOffset;
        }
        return {'type': 'MultiPolygon', 'coordinates': polygons};

      case 5: // MultiLineString
        final numGeoms = byteData.getUint32(offset, endian);
        offset += 4;
        final lines = <List<List<double>>>[];
        for (var i = 0; i < numGeoms; i++) {
          final subEndian =
              bytes[offset] == 1 ? Endian.little : Endian.big;
          final subRawType = byteData.getUint32(offset + 1, subEndian);
          offset += 5;
          final hasZ = subRawType >= 1000;
          final result = _readLineString(byteData, offset, subEndian, hasZ);
          lines.add(result.coords);
          offset = result.nextOffset;
        }
        return {'type': 'MultiLineString', 'coordinates': lines};

      default:
        return null;
    }
  }

  static _PointResult _readPoint(
      ByteData bd, int offset, Endian endian, bool hasZ) {
    final x = bd.getFloat64(offset, endian);
    final y = bd.getFloat64(offset + 8, endian);
    offset += 16;
    if (hasZ) offset += 8; // skip Z
    return _PointResult([x, y], offset);
  }

  static _LineResult _readLineString(
      ByteData bd, int offset, Endian endian, bool hasZ) {
    final numPoints = bd.getUint32(offset, endian);
    offset += 4;
    final coords = <List<double>>[];
    for (var i = 0; i < numPoints; i++) {
      final x = bd.getFloat64(offset, endian);
      final y = bd.getFloat64(offset + 8, endian);
      coords.add([x, y]);
      offset += 16;
      if (hasZ) offset += 8;
    }
    return _LineResult(coords, offset);
  }

  static _PolygonResult _readPolygon(
      ByteData bd, int offset, Endian endian, bool hasZ) {
    final numRings = bd.getUint32(offset, endian);
    offset += 4;
    final rings = <List<List<double>>>[];
    for (var r = 0; r < numRings; r++) {
      final numPoints = bd.getUint32(offset, endian);
      offset += 4;
      final ring = <List<double>>[];
      for (var i = 0; i < numPoints; i++) {
        final x = bd.getFloat64(offset, endian);
        final y = bd.getFloat64(offset + 8, endian);
        ring.add([x, y]);
        offset += 16;
        if (hasZ) offset += 8;
      }
      rings.add(ring);
    }
    return _PolygonResult(rings, offset);
  }
}

class _PointResult {
  final List<double> point;
  final int nextOffset;
  _PointResult(this.point, this.nextOffset);
}

class _LineResult {
  final List<List<double>> coords;
  final int nextOffset;
  _LineResult(this.coords, this.nextOffset);
}

class _PolygonResult {
  final List<List<List<double>>> coords;
  final int nextOffset;
  _PolygonResult(this.coords, this.nextOffset);
}
