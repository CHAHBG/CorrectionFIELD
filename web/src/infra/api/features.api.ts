// =====================================================
//  FieldCorrect — Features API (Supabase)
// =====================================================

import { supabase } from '@/infra/supabase';
import type { AppFeature, FeatureStatus } from '@/shared/types';
import { geometryToEwkt } from '@/shared/utils/geometry';

function parseGeometryValue(value: unknown): GeoJSON.Geometry {
  if (value && typeof value === 'object' && 'type' in (value as Record<string, unknown>)) {
    return value as GeoJSON.Geometry;
  }

  if (typeof value !== 'string') {
    throw new Error('Format géométrique non supporté');
  }

  const text = value.trim();
  if (!text) throw new Error('Géométrie vide');

  if (text.startsWith('{') || text.startsWith('[')) {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === 'object' && 'type' in (parsed as Record<string, unknown>)) {
      return parsed as GeoJSON.Geometry;
    }
  }

  // PostGIS via PostgREST frequently returns EWKB hex (sometimes prefixed by "\\x")
  const hex = text.startsWith('\\x') ? text.slice(2) : text;
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length >= 10) {
    const geometry = parseEwkbHex(hex);
    if (geometry) return geometry;
  }

  throw new Error('Impossible de parser la géométrie retournée par la base');
}

function parseEwkbHex(hex: string): GeoJSON.Geometry | null {
  if (hex.length % 2 !== 0) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  const parsed = parseWkbAt(bytes, 0);
  return parsed?.geometry ?? null;
}

type ParsedWkb = { geometry: GeoJSON.Geometry; nextOffset: number };

function parseWkbAt(blob: Uint8Array, offset: number): ParsedWkb | null {
  if (offset + 5 > blob.length) return null;

  const littleEndian = blob[offset] === 1;
  const typeRaw = readUint32(blob, offset + 1, littleEndian);
  const { baseType, hasZ, hasM, hasSrid } = decodeWkbType(typeRaw);
  const pointStride = 16 + (hasZ ? 8 : 0) + (hasM ? 8 : 0);
  let cursor = offset + 5;

  // EWKB with SRID stores 4 extra bytes right after type word
  if (hasSrid) {
    if (cursor + 4 > blob.length) return null;
    cursor += 4;
  }

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

function decodeWkbType(raw: number): { baseType: number; hasZ: boolean; hasM: boolean; hasSrid: boolean } {
  const hasZFlag = (raw & 0x80000000) !== 0;
  const hasMFlag = (raw & 0x40000000) !== 0;
  const hasSridFlag = (raw & 0x20000000) !== 0;
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

  return { baseType: base, hasZ, hasM, hasSrid: hasSridFlag };
}

function readUint32(blob: Uint8Array, offset: number, littleEndian: boolean): number {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  return view.getUint32(offset, littleEndian);
}

function readFloat64(blob: Uint8Array, offset: number, littleEndian: boolean): number {
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  return view.getFloat64(offset, littleEndian);
}

function snakeToFeature(row: Record<string, unknown>): AppFeature {
  return {
    id: row.id as string,
    layerId: row.layer_id as string,
    geom: parseGeometryValue(row.geom),
    props: (row.props ?? {}) as Record<string, unknown>,
    status: (row.status ?? 'pending') as FeatureStatus,
    lockedBy: row.locked_by as string | null ?? null,
    lockedAt: row.locked_at as string | null ?? null,
    lockExpires: row.lock_expires as string | null ?? null,
    correctedBy: row.corrected_by as string | null ?? null,
    correctedAt: row.corrected_at as string | null ?? null,
    validatedBy: row.validated_by as string | null ?? null,
    validatedAt: row.validated_at as string | null ?? null,
    sourceFile: row.source_file as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const featuresApi = {
  async getByLayer(layerId: string): Promise<AppFeature[]> {
    const { data, error } = await supabase
      .from('features')
      .select('*')
      .eq('layer_id', layerId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(snakeToFeature);
  },

  async getInViewport(layerIds: string[], bbox: [number, number, number, number]): Promise<AppFeature[]> {
    const { data, error } = await supabase
      .rpc('features_in_viewport', {
        p_layer_ids: layerIds,
        p_bbox: `SRID=4326;POLYGON((${bbox[0]} ${bbox[1]},${bbox[2]} ${bbox[1]},${bbox[2]} ${bbox[3]},${bbox[0]} ${bbox[3]},${bbox[0]} ${bbox[1]}))`,
      });

    if (error) throw error;
    return (data ?? []).map(snakeToFeature);
  },

  async getById(id: string): Promise<AppFeature | null> {
    const { data, error } = await supabase
      .from('features')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data ? snakeToFeature(data) : null;
  },

  async updateProps(id: string, props: Record<string, unknown>): Promise<void> {
    const { error } = await supabase
      .from('features')
      .update({ props, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async updateGeometry(id: string, geom: unknown): Promise<void> {
    const geometry = geom as GeoJSON.Geometry;
    const { error } = await supabase
      .from('features')
      .update({ geom: geometryToEwkt(geometry), updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async updateStatus(id: string, status: FeatureStatus): Promise<void> {
    const { error } = await supabase
      .from('features')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  async lockFeature(featureId: string, userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .rpc('lock_feature', { p_feature_id: featureId, p_user_id: userId });

    if (error) throw error;
    return data?.success ?? false;
  },

  async unlockFeature(featureId: string): Promise<void> {
    const { error } = await supabase
      .rpc('unlock_feature', { p_feature_id: featureId });

    if (error) throw error;
  },

  async bulkInsert(features: Partial<AppFeature>[]): Promise<void> {
    const rows = features.map((f) => {
      const row: Record<string, unknown> = {
        layer_id: f.layerId,
        geom: f.geom ? geometryToEwkt(f.geom as GeoJSON.Geometry) : null,
        props: f.props ?? {},
        status: f.status ?? 'pending',
      };
      // Only include optional fields when they have real values.
      // Including undefined keys causes Supabase JS to list them in
      // the ?columns= query param while JSON.stringify omits them,
      // resulting in PostgREST returning 400.
      if (f.id) row.id = f.id;
      if (f.sourceFile) row.source_file = f.sourceFile;
      return row;
    });

    const { error } = await supabase.from('features').insert(rows);
    if (error) throw error;
  },
};
