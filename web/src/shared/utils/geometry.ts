export function geometryToEwkt(geometry: GeoJSON.Geometry, srid = 4326): string {
  return `SRID=${srid};${geometryToWkt(geometry)}`;
}

function geometryToWkt(geometry: GeoJSON.Geometry): string {
  switch (geometry.type) {
    case 'Point':
      return `POINT (${coord(geometry.coordinates)})`;
    case 'MultiPoint':
      return `MULTIPOINT (${geometry.coordinates.map((c) => `(${coord(c)})`).join(', ')})`;
    case 'LineString':
      return `LINESTRING (${geometry.coordinates.map(coord).join(', ')})`;
    case 'MultiLineString':
      return `MULTILINESTRING (${geometry.coordinates.map((line) => `(${line.map(coord).join(', ')})`).join(', ')})`;
    case 'Polygon':
      return `POLYGON (${geometry.coordinates.map((ring) => `(${ring.map(coord).join(', ')})`).join(', ')})`;
    case 'MultiPolygon':
      return `MULTIPOLYGON (${geometry.coordinates
        .map((polygon) => `(${polygon.map((ring) => `(${ring.map(coord).join(', ')})`).join(', ')})`)
        .join(', ')})`;
    case 'GeometryCollection':
      return `GEOMETRYCOLLECTION (${geometry.geometries.map(geometryToWkt).join(', ')})`;
    default:
      throw new Error(`Type de géométrie non supporté: ${(geometry as { type?: string }).type ?? 'inconnu'}`);
  }
}

function coord(position: GeoJSON.Position): string {
  if (position.length < 2) {
    throw new Error('Coordonnée invalide: au moins x et y sont requis');
  }

  const x = Number(position[0]);
  const y = Number(position[1]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error('Coordonnée invalide: x/y doivent être numériques');
  }

  return `${x} ${y}`;
}
