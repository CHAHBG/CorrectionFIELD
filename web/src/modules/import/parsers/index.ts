// =====================================================
//  FieldCorrect — File parsers (GeoJSON, GPKG, CSV, Shapefile)
// =====================================================

import type { GeometryType, FieldSchema } from '@/shared/types';
import { inferFieldsFromProperties } from '@/modules/forms/odk/XlsFormParser';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

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
    locateFile: () => sqlWasmUrl,
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
  const quotedTableName = `"${tableName.replace(/"/g, '""')}"`;

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
  const idCol = allCols.includes('fid') ? 'fid' : (allCols.includes('id') ? 'id' : null);

  const quotedGeomCol = `"${geomCol.replace(/"/g, '""')}"`;
  const quotedPropCols = propCols.map((c: string) => `"${c.replace(/"/g, '""')}"`);
  const selectedColumns = [idCol ? `"${idCol}"` : 'rowid as __rowid__', quotedGeomCol, ...quotedPropCols].join(', ');

  // Read features
  const rows = sqlDb.exec(`SELECT ${selectedColumns} FROM ${quotedTableName}`)[0];
  const features: GeoJSON.Feature[] = [];

  if (rows) {
    for (const [index, row] of rows.values.entries()) {
      const fid = row[0] ?? index + 1;
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
  const parsed = parseWkbAt(blob, offset);
  return parsed?.geometry ?? null;
}

type ParsedWkb = { geometry: GeoJSON.Geometry; nextOffset: number };

function parseWkbAt(blob: Uint8Array, offset: number): ParsedWkb | null {
  if (offset + 5 > blob.length) return null;

  const littleEndian = blob[offset] === 1;
  const typeRaw = readUint32(blob, offset + 1, littleEndian);
  const { baseType, hasZ, hasM } = decodeWkbType(typeRaw);
  const pointStride = 16 + (hasZ ? 8 : 0) + (hasM ? 8 : 0);
  let cursor = offset + 5;

  const readPoint = (): [number, number] | null => {
    if (cursor + pointStride > blob.length) return null;
    const x = readFloat64(blob, cursor, littleEndian);
    const y = readFloat64(blob, cursor + 8, littleEndian);
    cursor += pointStride;
    return [x, y];
  };

  if (baseType === 1) {
    const point = readPoint();
    if (!point) return null;
    return { geometry: { type: 'Point', coordinates: point }, nextOffset: cursor };
  }

  if (baseType === 2) {
    if (cursor + 4 > blob.length) return null;
    const numPts = readUint32(blob, cursor, littleEndian);
    cursor += 4;
    const coords: number[][] = [];
    for (let i = 0; i < numPts; i++) {
      const point = readPoint();
      if (!point) return null;
      coords.push(point);
    }
    return { geometry: { type: 'LineString', coordinates: coords }, nextOffset: cursor };
  }

  if (baseType === 3) {
    if (cursor + 4 > blob.length) return null;
    const numRings = readUint32(blob, cursor, littleEndian);
    cursor += 4;
    const rings: number[][][] = [];
    for (let r = 0; r < numRings; r++) {
      if (cursor + 4 > blob.length) return null;
      const numPts = readUint32(blob, cursor, littleEndian);
      cursor += 4;
      const ring: number[][] = [];
      for (let i = 0; i < numPts; i++) {
        const point = readPoint();
        if (!point) return null;
        ring.push(point);
      }
      rings.push(ring);
    }
    return { geometry: { type: 'Polygon', coordinates: rings }, nextOffset: cursor };
  }

  if (baseType === 4 || baseType === 5 || baseType === 6) {
    if (cursor + 4 > blob.length) return null;
    const numGeoms = readUint32(blob, cursor, littleEndian);
    cursor += 4;

    if (baseType === 4) {
      const coords: number[][] = [];
      for (let i = 0; i < numGeoms; i++) {
        const parsed = parseWkbAt(blob, cursor);
        if (!parsed || parsed.geometry.type !== 'Point') return null;
        coords.push(parsed.geometry.coordinates as number[]);
        cursor = parsed.nextOffset;
      }
      return { geometry: { type: 'MultiPoint', coordinates: coords }, nextOffset: cursor };
    }

    if (baseType === 5) {
      const lines: number[][][] = [];
      for (let i = 0; i < numGeoms; i++) {
        const parsed = parseWkbAt(blob, cursor);
        if (!parsed || parsed.geometry.type !== 'LineString') return null;
        lines.push(parsed.geometry.coordinates as number[][]);
        cursor = parsed.nextOffset;
      }
      return { geometry: { type: 'MultiLineString', coordinates: lines }, nextOffset: cursor };
    }

    const polygons: number[][][][] = [];
    for (let i = 0; i < numGeoms; i++) {
      const parsed = parseWkbAt(blob, cursor);
      if (!parsed || parsed.geometry.type !== 'Polygon') return null;
      polygons.push(parsed.geometry.coordinates as number[][][]);
      cursor = parsed.nextOffset;
    }
    return { geometry: { type: 'MultiPolygon', coordinates: polygons }, nextOffset: cursor };
  }

  return null;
}

function decodeWkbType(raw: number): { baseType: number; hasZ: boolean; hasM: boolean } {
  const hasZFlag = (raw & 0x80000000) !== 0;
  const hasMFlag = (raw & 0x40000000) !== 0;
  let base = raw & 0x0fffffff;

  let hasZ = hasZFlag;
  let hasM = hasMFlag;

  if (base >= 3000) {
    hasZ = true;
    hasM = true;
    base -= 3000;
  } else if (base >= 2000) {
    hasM = true;
    base -= 2000;
  } else if (base >= 1000) {
    hasZ = true;
    base -= 1000;
  }

  return { baseType: base, hasZ, hasM };
}

function readUint32(blob: Uint8Array, offset: number, littleEndian: boolean): number {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  return view.getUint32(offset, littleEndian);
}

function readFloat64(blob: Uint8Array, offset: number, littleEndian: boolean): number {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  return view.getFloat64(offset, littleEndian);
}
