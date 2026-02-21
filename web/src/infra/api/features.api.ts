// =====================================================
//  FieldCorrect — Features API (Supabase)
// =====================================================

import { supabase } from '@/infra/supabase';
import type { AppFeature, FeatureStatus } from '@/shared/types';
import { geometryToEwkt } from '@/shared/utils/geometry';

function snakeToFeature(row: Record<string, unknown>): AppFeature {
  return {
    id: row.id as string,
    layerId: row.layer_id as string,
    geom: typeof row.geom === 'string' ? JSON.parse(row.geom as string) : row.geom as AppFeature['geom'],
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
