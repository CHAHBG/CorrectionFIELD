// =====================================================
//  FieldCorrect — CRS / Projection helpers (proj4)
// =====================================================

import proj4 from 'proj4';

// Register common projections
proj4.defs('EPSG:32628', '+proj=utm +zone=28 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:32629', '+proj=utm +zone=29 +datum=WGS84 +units=m +no_defs');

/**
 * Reproject coordinates from source CRS to target CRS.
 */
export function reproject(
  coords: [number, number],
  fromCrs: string,
  toCrs: string = 'EPSG:4326'
): [number, number] {
  if (fromCrs === toCrs) return coords;
  return proj4(fromCrs, toCrs, coords) as [number, number];
}

/**
 * Reproject a GeoJSON FeatureCollection.
 */
export function reprojectFeatureCollection(
  fc: GeoJSON.FeatureCollection,
  fromCrs: string,
  toCrs: string = 'EPSG:4326'
): GeoJSON.FeatureCollection {
  if (fromCrs === toCrs) return fc;

  return {
    ...fc,
    features: fc.features.map((f) => ({
      ...f,
      geometry: reprojectGeometry(f.geometry, fromCrs, toCrs),
    })),
  };
}

function reprojectGeometry(
  geom: GeoJSON.Geometry,
  fromCrs: string,
  toCrs: string
): GeoJSON.Geometry {
  switch (geom.type) {
    case 'Point':
      return {
        ...geom,
        coordinates: reproject(geom.coordinates as [number, number], fromCrs, toCrs),
      };
    case 'MultiPoint':
    case 'LineString':
      return {
        ...geom,
        coordinates: (geom.coordinates as [number, number][]).map((c) =>
          reproject(c, fromCrs, toCrs)
        ),
      };
    case 'MultiLineString':
    case 'Polygon':
      return {
        ...geom,
        coordinates: (geom.coordinates as [number, number][][]).map((ring) =>
          ring.map((c) => reproject(c, fromCrs, toCrs))
        ),
      };
    case 'MultiPolygon':
      return {
        ...geom,
        coordinates: (geom.coordinates as [number, number][][][]).map((poly) =>
          poly.map((ring) => ring.map((c) => reproject(c, fromCrs, toCrs)))
        ),
      };
    case 'GeometryCollection':
      return {
        ...geom,
        geometries: geom.geometries.map((g) => reprojectGeometry(g, fromCrs, toCrs)),
      };
    default:
      return geom;
  }
}

/**
 * Get human-readable CRS name.
 */
export function crsLabel(code: string): string {
  const labels: Record<string, string> = {
    'EPSG:4326': 'WGS 84 (GPS)',
    'EPSG:32628': 'UTM Zone 28N',
    'EPSG:32629': 'UTM Zone 29N',
    'EPSG:3857': 'Web Mercator',
  };
  return labels[code] ?? code;
}
