// =====================================================
//  FieldCorrect — File parsers (GeoJSON, GPKG, CSV, Shapefile)
// =====================================================

import type { GeometryType, FieldSchema } from '@/shared/types';
import { inferFieldsFromProperties } from '@/modules/forms/odk/XlsFormParser';

export interface ParseResult {
  features: GeoJSON.Feature[];
  fields: FieldSchema[];
  geometryType: GeometryType;
  crs?: string;
  name: string;
}

// ── GeoJSON parser ──────────────────────────────────
export async function parseGeoJson(file: File): Promise<ParseResult> {
  const text = await file.text();
  const json = JSON.parse(text) as GeoJSON.FeatureCollection;
  if (!json.features || !Array.isArray(json.features)) {
    throw new Error('Fichier GeoJSON invalide : pas de tableau "features"');
  }

  const geometryType = detectGeometryType(json.features);
  const fields = inferFieldsFromProperties(json.features);
  const name = file.name.replace(/\.(geo)?json$/i, '');

  return { features: json.features, fields, geometryType, name };
}

// ── GeoPackage parser (via sql.js-based gpkg reader) ─
export async function parseGpkg(file: File): Promise<ParseResult> {
  // Dynamic import to avoid bundling sql.js unless needed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { default: initSqlJs } = await import('sql.js' as any) as any;
  const SQL = await initSqlJs({
    locateFile: (f: string) => `https://sql.js.org/dist/${f}`,
  });

  const buffer = await file.arrayBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sqlDb: any = new SQL.Database(new Uint8Array(buffer));

  // Find the first feature table
  const tables = sqlDb
    .exec("SELECT table_name, srs_id FROM gpkg_contents WHERE data_type='features'")[0];
  if (!tables || tables.values.length === 0) throw new Error('Aucune couche trouvée dans le GPKG');

  const tableName = String(tables.values[0][0]);
  const srsId = tables.values[0][1];

  // Discover the geometry column
  const geomColResult = sqlDb.exec(
    `SELECT column_name, geometry_type_name FROM gpkg_geometry_columns WHERE table_name='${tableName}'`
  )[0];
  const geomCol = geomColResult ? String(geomColResult.values[0][0]) : 'geom';
  const geomTypeName = geomColResult ? String(geomColResult.values[0][1]) : 'GEOMETRY';

  // Read columns
  const columnsStmt = sqlDb.exec(`PRAGMA table_info('${tableName}')`)[0];
  const allCols: string[] = columnsStmt.values.map((row: unknown[]) => String(row[1]));
  const propCols: string[] = allCols.filter(
    (c: string) => c !== geomCol && c !== 'fid' && c !== 'id'
  );

  // Read features
  const rows = sqlDb.exec(`SELECT fid, ${geomCol}, ${propCols.join(', ')} FROM "${tableName}"`)[0];
  const features: GeoJSON.Feature[] = [];

  if (rows) {
    for (const row of rows.values) {
      const fid = row[0];
      const geomBlob = row[1] as Uint8Array | null;
      const geometry = geomBlob ? parseGpkgGeometry(geomBlob) : null;
      if (!geometry) continue;

      const props: Record<string, unknown> = {};
      propCols.forEach((col: string, i: number) => {
        props[col] = row[i + 2];
      });

      features.push({
        type: 'Feature',
        id: fid as number,
        geometry,
        properties: props,
      });
    }
  }

  sqlDb.close();

  const geometryType = mapGpkgGeomType(geomTypeName);
  const fields = inferFieldsFromProperties(features);
  const name = file.name.replace(/\.gpkg$/i, '');

  return {
    features,
    fields,
    geometryType,
    crs: srsId ? `EPSG:${srsId}` : undefined,
    name,
  };
}

// ── CSV with coordinates parser ─────────────────────
export async function parseCsvGeo(
  file: File,
  options: { latCol: string; lngCol: string; separator?: string }
): Promise<ParseResult> {
  const text = await file.text();
  const sep = options.separator ?? (file.name.endsWith('.tsv') ? '\t' : ',');
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('CSV vide ou invalide');

  const headers = lines[0].split(sep).map((h) => h.trim().replace(/^"(.*)"$/, '$1'));
  const latIdx = headers.findIndex((h) => h.toLowerCase() === options.latCol.toLowerCase());
  const lngIdx = headers.findIndex((h) => h.toLowerCase() === options.lngCol.toLowerCase());
  if (latIdx < 0 || lngIdx < 0) throw new Error('Colonnes lat/lng introuvables');

  const propHeaders = headers.filter((_, i) => i !== latIdx && i !== lngIdx);
  const features: GeoJSON.Feature[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(sep).map((v) => v.trim().replace(/^"(.*)"$/, '$1'));
    const lat = parseFloat(vals[latIdx]);
    const lng = parseFloat(vals[lngIdx]);
    if (isNaN(lat) || isNaN(lng)) continue;

    const props: Record<string, unknown> = {};
    propHeaders.forEach((h) => {
      const idx = headers.indexOf(h);
      const v = vals[idx];
      props[h] = isNaN(Number(v)) ? v : Number(v);
    });

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: props,
    });
  }

  const fields = inferFieldsFromProperties(features);
  const name = file.name.replace(/\.(csv|tsv)$/i, '');

  return { features, fields, geometryType: 'Point', name };
}

// ── Helpers ─────────────────────────────────────────

function detectGeometryType(features: GeoJSON.Feature[]): GeometryType {
  const types = new Set(features.map((f) => f.geometry?.type).filter(Boolean));
  if (types.has('Polygon') || types.has('MultiPolygon')) return 'Polygon';
  if (types.has('LineString') || types.has('MultiLineString')) return 'LineString';
  return 'Point';
}

function mapGpkgGeomType(gpkgType: string): GeometryType {
  const upper = gpkgType.toUpperCase();
  if (upper.includes('POLYGON')) return 'Polygon';
  if (upper.includes('LINE')) return 'LineString';
  return 'Point';
}

/**
 * Minimal GPKG binary geometry parser → GeoJSON Geometry.
 * Handles standard GPKG binary header + WKB payload.
 */
function parseGpkgGeometry(blob: Uint8Array): GeoJSON.Geometry | null {
  try {
    if (blob.length < 8) return null;
    // GPKG binary header: magic 0x4750, version, flags, srs_id
    const magic = (blob[0] << 8) | blob[1];
    if (magic !== 0x4750) {
      // Try direct WKB
      return parseWkbGeometry(blob, 0);
    }

    const flags = blob[3];
    const envelopeType = (flags >> 1) & 0x07;
    const envelopeSizes: Record<number, number> = { 0: 0, 1: 32, 2: 48, 3: 48, 4: 64 };
    const headerSize = 8 + (envelopeSizes[envelopeType] ?? 0);

    return parseWkbGeometry(blob, headerSize);
  } catch {
    return null;
  }
}

function parseWkbGeometry(blob: Uint8Array, offset: number): GeoJSON.Geometry | null {
  if (offset >= blob.length) return null;
  const dv = new DataView(blob.buffer, blob.byteOffset + offset);
  const littleEndian = dv.getUint8(0) === 1;
  const typeRaw = littleEndian ? dv.getUint32(1, true) : dv.getUint32(1, false);
  const wkbType = typeRaw & 0xff; // Mask out Z/M flags

  const readDouble = (off: number) => dv.getFloat64(off, littleEndian);

  if (wkbType === 1) {
    // Point
    const x = readDouble(5);
    const y = readDouble(13);
    return { type: 'Point', coordinates: [x, y] };
  }
  if (wkbType === 2) {
    // LineString
    const numPts = littleEndian ? dv.getUint32(5, true) : dv.getUint32(5, false);
    const coords: number[][] = [];
    let p = 9;
    for (let i = 0; i < numPts; i++) {
      coords.push([readDouble(p), readDouble(p + 8)]);
      p += 16 + (typeRaw >= 1000 ? 8 : 0); // Skip Z if present
    }
    return { type: 'LineString', coordinates: coords };
  }
  if (wkbType === 3) {
    // Polygon
    const numRings = littleEndian ? dv.getUint32(5, true) : dv.getUint32(5, false);
    const rings: number[][][] = [];
    let p = 9;
    for (let r = 0; r < numRings; r++) {
      const numPts = littleEndian ? dv.getUint32(p, true) : dv.getUint32(p, false);
      p += 4;
      const ring: number[][] = [];
      for (let i = 0; i < numPts; i++) {
        ring.push([readDouble(p), readDouble(p + 8)]);
        p += 16 + (typeRaw >= 1000 ? 8 : 0);
      }
      rings.push(ring);
    }
    return { type: 'Polygon', coordinates: rings };
  }

  // MultiPolygon (6), MultiLineString (5), MultiPoint (4) — simplified fallback
  return null;
}
