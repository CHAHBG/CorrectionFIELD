import 'dart:convert';

/// Builds GeoJSON Feature / FeatureCollection strings for MapLibre sources.
class GeoJsonBuilder {
  GeoJsonBuilder._();

  /// Wrap a single geometry + properties into a GeoJSON Feature.
  static Map<String, dynamic> feature({
    required Map<String, dynamic> geometry,
    Map<String, dynamic>? properties,
    dynamic id,
  }) {
    return {
      'type': 'Feature',
      if (id != null) 'id': id,
      'geometry': geometry,
      'properties': properties ?? {},
    };
  }

  /// Wrap a list of features into a FeatureCollection.
  static Map<String, dynamic> featureCollection(
      List<Map<String, dynamic>> features) {
    return {
      'type': 'FeatureCollection',
      'features': features,
    };
  }

  /// Convert to JSON string — suitable for MapLibre `addGeoJsonSource`.
  static String toJsonString(Map<String, dynamic> geojson) {
    return jsonEncode(geojson);
  }

  /// Build a MultiPolygon geometry from GeoJSON coordinates.
  static Map<String, dynamic> multiPolygonGeometry(
      List<List<List<List<double>>>> coordinates) {
    return {
      'type': 'MultiPolygon',
      'coordinates': coordinates,
    };
  }

  /// Build a Polygon geometry from GeoJSON coordinates.
  static Map<String, dynamic> polygonGeometry(
      List<List<List<double>>> coordinates) {
    return {
      'type': 'Polygon',
      'coordinates': coordinates,
    };
  }

  /// Build a Point geometry.
  static Map<String, dynamic> pointGeometry(double lng, double lat) {
    return {
      'type': 'Point',
      'coordinates': [lng, lat],
    };
  }
}
