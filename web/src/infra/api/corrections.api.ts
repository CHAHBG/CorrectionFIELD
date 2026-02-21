// =====================================================
//  FieldCorrect — Corrections API (Supabase)
// =====================================================

import { supabase } from '@/infra/supabase';
import type { Correction, CorrectionStatus } from '@/shared/types';
import { geometryToEwkt } from '@/shared/utils/geometry';

function snakeToCorrection(row: Record<string, unknown>): Correction {
  return {
    id: row.id as string,
    featureId: row.feature_id as string,
    layerId: row.layer_id as string,
    userId: row.user_id as string,
    deviceId: row.device_id as string | undefined,
    propsPatch: row.props_patch as Record<string, unknown> | undefined,
    geomCorrected: row.geom_corrected as Correction['geomCorrected'],
    koboSubmissionId: row.kobo_submission_id as string | undefined,
    koboFormId: row.kobo_form_id as string | undefined,
    enketoSubmission: row.enketo_submission as Record<string, unknown> | undefined,
    notes: row.notes as string | undefined,
    gpsPoint: row.gps_point as Correction['gpsPoint'],
    gpsAccuracy: row.gps_accuracy as number | undefined,
    mediaUrls: (row.media_urls ?? []) as string[],
    status: (row.status ?? 'submitted') as CorrectionStatus,
    conflictOf: row.conflict_of as string | null,
    dirty: (row.dirty ?? false) as boolean,
    createdAt: row.created_at as string,
  };
}

export const correctionsApi = {
  async getByFeature(featureId: string): Promise<Correction[]> {
    const { data, error } = await supabase
      .from('corrections')
      .select('*')
      .eq('feature_id', featureId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(snakeToCorrection);
  },

  async submit(correction: Partial<Correction>): Promise<Correction> {
    const row = {
      feature_id: correction.featureId,
      layer_id: correction.layerId,
      user_id: correction.userId,
      device_id: correction.deviceId,
      props_patch: correction.propsPatch,
      geom_corrected: correction.geomCorrected ? geometryToEwkt(correction.geomCorrected as GeoJSON.Geometry) : null,
      notes: correction.notes,
      gps_point: correction.gpsPoint
        ? geometryToEwkt({ type: 'Point', coordinates: correction.gpsPoint } as GeoJSON.Point)
        : null,
      gps_accuracy: correction.gpsAccuracy,
      media_urls: correction.mediaUrls ?? [],
      status: 'submitted',
      dirty: false,
    };

    const { data, error } = await supabase
      .from('corrections')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return snakeToCorrection(data);
  },

  async validate(id: string): Promise<void> {
    const { error } = await supabase
      .from('corrections')
      .update({ status: 'validated' })
      .eq('id', id);
    if (error) throw error;
  },

  async reject(id: string): Promise<void> {
    const { error } = await supabase
      .from('corrections')
      .update({ status: 'rejected' })
      .eq('id', id);
    if (error) throw error;
  },

  async getStatsByLayer(layerId: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .rpc('stats_by_layer', { p_layer_id: layerId });

    if (error) throw error;
    return data ?? {};
  },
};
