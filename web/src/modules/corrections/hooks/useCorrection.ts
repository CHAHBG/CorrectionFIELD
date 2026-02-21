// =====================================================
//  FieldCorrect — Correction hooks
// =====================================================

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { correctionsApi } from '@/infra/api/corrections.api';
import { featuresApi } from '@/infra/api/features.api';
import type { Geometry } from '@/shared/types';

/**
 * Submit a correction for a feature.
 */
export function useSubmitCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      featureId,
      layerId,
      userId,
      propsPatch,
      geomCorrected,
      notes,
      gpsPoint,
      gpsAccuracy,
      mediaUrls,
    }: {
      featureId: string;
      layerId: string;
      userId: string;
      propsPatch?: Record<string, unknown>;
      geomCorrected?: Geometry;
      notes?: string;
      gpsPoint?: [number, number];
      gpsAccuracy?: number;
      mediaUrls?: string[];
    }) => {
      // 1. Submit the correction
      const correction = await correctionsApi.submit({
        featureId,
        layerId,
        userId,
        propsPatch,
        geomCorrected,
        notes,
        gpsPoint: gpsPoint ?? undefined,
        gpsAccuracy,
        mediaUrls: mediaUrls ?? [],
      });

      // 2. Update feature status
      await featuresApi.updateStatus(featureId, 'corrected');

      // 3. If props were patched, apply them
      if (propsPatch) {
        const currentFeature = await featuresApi.getById(featureId);
        if (currentFeature) {
          const merged = { ...currentFeature.props, ...propsPatch };
          await featuresApi.updateProps(featureId, merged);
        }
      }

      // 4. If geometry corrected, apply it
      if (geomCorrected) {
        await featuresApi.updateGeometry(featureId, geomCorrected);
      }

      return correction;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
      queryClient.invalidateQueries({ queryKey: ['corrections', variables.featureId] });
      queryClient.invalidateQueries({ queryKey: ['feature', variables.featureId] });
    },
  });
}

/**
 * Lock a feature before editing.
 */
export function useLockAndEdit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ featureId, userId }: { featureId: string; userId: string }) => {
      const success = await featuresApi.lockFeature(featureId, userId);
      if (!success) throw new Error('Feature already locked by another user');
      return success;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
    },
  });
}

/**
 * Unlock a feature.
 */
export function useUnlockFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (featureId: string) => featuresApi.unlockFeature(featureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
    },
  });
}

/**
 * Validate a correction.
 */
export function useValidateCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ correctionId, featureId }: { correctionId: string; featureId: string }) => {
      await correctionsApi.validate(correctionId);
      await featuresApi.updateStatus(featureId, 'validated');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
      queryClient.invalidateQueries({ queryKey: ['corrections'] });
    },
  });
}

/**
 * Reject a correction.
 */
export function useRejectCorrection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ correctionId, featureId }: { correctionId: string; featureId: string }) => {
      await correctionsApi.reject(correctionId);
      await featuresApi.updateStatus(featureId, 'pending');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
      queryClient.invalidateQueries({ queryKey: ['corrections'] });
    },
  });
}
