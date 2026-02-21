// =====================================================
//  FieldCorrect — Layer hooks (TanStack Query)
// =====================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { layersApi } from '@/infra/api/layers.api';
import { useLayerStore } from '@/stores/layerStore';
import type { Layer, LayerStyle } from '@/shared/types';
import { useEffect } from 'react';

/**
 * Fetch layers for a project and sync to Zustand store.
 */
export function useLayers(projectId: string | undefined) {
  const setLayers = useLayerStore((s) => s.setLayers);

  const query = useQuery({
    queryKey: ['layers', projectId],
    queryFn: () => layersApi.getByProject(projectId!),
    enabled: !!projectId,
    staleTime: 60_000,
  });

  // Sync to Zustand store
  useEffect(() => {
    if (query.data) {
      setLayers(query.data);
    }
  }, [query.data, setLayers]);

  return query;
}

/**
 * Create a new layer.
 */
export function useCreateLayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (layer: Partial<Layer>) => layersApi.create(layer),
    onSuccess: (newLayer) => {
      queryClient.invalidateQueries({ queryKey: ['layers'] });
      useLayerStore.getState().addLayer(newLayer);
    },
  });
}

/**
 * Update layer properties.
 */
export function useUpdateLayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<Layer> & { id: string }) =>
      layersApi.update(id, updates),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['layers'] });
      const { id, ...updates } = variables;
      useLayerStore.getState().updateLayer(id, updates);
    },
  });
}

/**
 * Delete a layer.
 */
export function useDeleteLayer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => layersApi.delete(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['layers'] });
      useLayerStore.getState().removeLayer(id);
    },
  });
}

/**
 * Update layer style and push to store.
 */
export function useLayerStyle(layerId: string) {
  const updateLayerMutation = useUpdateLayer();

  const setStyle = (style: LayerStyle) => {
    // Optimistic update in store
    useLayerStore.getState().setLayerStyle(layerId, style);
    // Persist to server
    updateLayerMutation.mutate({ id: layerId, style });
  };

  return { setStyle };
}
