// =====================================================
//  FieldCorrect — Bounding box utilities
// =====================================================

import type { Geometry, Position } from 'geojson';

export type BBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

/**
 * Compute bounding box from a GeoJSON geometry.
 */
export function bboxFromGeometry(geom: Geometry): BBox {
  const coords = extractCoordinates(geom);
  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Compute bounding box from an array of features.
 */
export function bboxFromFeatures(features: { geom: Geometry }[]): BBox {
  let minLng = Infinity, minLat = Infinity;
  let maxLng = -Infinity, maxLat = -Infinity;

  for (const f of features) {
    const [a, b, c, d] = bboxFromGeometry(f.geom);
    if (a < minLng) minLng = a;
    if (b < minLat) minLat = b;
    if (c > maxLng) maxLng = c;
    if (d > maxLat) maxLat = d;
  }

  return [minLng, minLat, maxLng, maxLat];
}

/**
 * Expand a bbox by a ratio (e.g. 0.1 = 10% padding).
 */
export function expandBBox(bbox: BBox, ratio: number): BBox {
  const dLng = (bbox[2] - bbox[0]) * ratio;
  const dLat = (bbox[3] - bbox[1]) * ratio;
  return [
    bbox[0] - dLng,
    bbox[1] - dLat,
    bbox[2] + dLng,
    bbox[3] + dLat,
  ];
}

/**
 * Extract all coordinate pairs from any geometry type.
 */
function extractCoordinates(geom: Geometry): Position[] {
  switch (geom.type) {
    case 'Point':
      return [geom.coordinates];
    case 'MultiPoint':
    case 'LineString':
      return geom.coordinates;
    case 'MultiLineString':
    case 'Polygon':
      return geom.coordinates.flat();
    case 'MultiPolygon':
      return geom.coordinates.flat(2);
    case 'GeometryCollection':
      return geom.geometries.flatMap(extractCoordinates);
    default:
      return [];
  }
}
