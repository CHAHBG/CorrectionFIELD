// =====================================================
//  FieldCorrect — useFeatures hook (TanStack Query)
// =====================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { featuresApi } from '@/infra/api/features.api';
import type { AppFeature, FeatureStatus, Geometry } from '@/shared/types';

/**
 * Fetch features for a layer.
 */
export function useFeatures(layerId: string | undefined) {
  return useQuery({
    queryKey: ['features', layerId],
    queryFn: () => featuresApi.getByLayer(layerId!),
    enabled: !!layerId,
    staleTime: 30_000,
  });
}

/**
 * Fetch a single feature.
 */
export function useFeature(featureId: string | undefined) {
  return useQuery({
    queryKey: ['feature', featureId],
    queryFn: () => featuresApi.getById(featureId!),
    enabled: !!featureId,
  });
}

/**
 * Mutation: update feature properties.
 */
export function useUpdateFeatureProps() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, props }: { id: string; props: Record<string, unknown> }) =>
      featuresApi.updateProps(id, props),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
      queryClient.invalidateQueries({ queryKey: ['feature', variables.id] });
    },
  });
}

/**
 * Mutation: update feature geometry.
 */
export function useUpdateFeatureGeometry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, geom }: { id: string; geom: Geometry }) =>
      featuresApi.updateGeometry(id, geom),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
      queryClient.invalidateQueries({ queryKey: ['feature', variables.id] });
    },
  });
}

/**
 * Mutation: update feature status.
 */
export function useUpdateFeatureStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: FeatureStatus }) =>
      featuresApi.updateStatus(id, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
      queryClient.invalidateQueries({ queryKey: ['feature', variables.id] });
    },
  });
}

/**
 * Mutation: lock a feature.
 */
export function useLockFeature() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ featureId, userId }: { featureId: string; userId: string }) =>
      featuresApi.lockFeature(featureId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] });
    },
  });
}

/**
 * Mutation: unlock a feature.
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
 * Convert AppFeatures to a GeoJSON FeatureCollection for MapLibre.
 */
export function featuresToGeoJSON(features: AppFeature[] | undefined): GeoJSON.FeatureCollection {
  if (!features) return { type: 'FeatureCollection', features: [] };

  return {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature' as const,
      id: f.id,
      geometry: f.geom,
      properties: {
        ...f.props,
        id: f.id,
        status: f.status,
        lockedBy: f.lockedBy,
      },
    })),
  };
}
