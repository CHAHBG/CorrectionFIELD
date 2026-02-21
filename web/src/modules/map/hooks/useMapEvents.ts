// =====================================================
//  FieldCorrect — Map event hooks
// =====================================================

import { useCallback } from 'react';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import { useMapStore } from '@/stores/mapStore';

/**
 * Hook for handling map click, hover, and selection events.
 */
export function useMapEvents(
  mapRef: React.RefObject<MapRef | null>,
  interactiveLayerIds: string[]
) {
  const setHoveredFeatureId = useMapStore((s) => s.setHoveredFeatureId);

  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const activeTool = useMapStore.getState().activeTool;

      // Measure tools: add point
      if (activeTool === 'measure_distance' || activeTool === 'measure_area') {
        useMapStore.getState().addMeasurePoint([event.lngLat.lng, event.lngLat.lat]);
        return;
      }

      // Only identify/select in select or identify mode
      if (activeTool !== 'select' && activeTool !== 'identify') return;

      const features = map.queryRenderedFeatures(event.point, {
        layers: interactiveLayerIds,
      });

      if (features.length === 0) {
        useMapStore.getState().clearSelection();
        useMapStore.getState().closeIdentifyPanel();
        return;
      }

      const featureId = features[0].id?.toString() ?? features[0].properties?.id;

      if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
        // Multi-select with Ctrl
        useMapStore.getState().toggleFeatureSelection(featureId);
      } else if (event.originalEvent.shiftKey) {
        // Add to selection with Shift
        useMapStore.getState().selectFeature(featureId);
      } else {
        // Single select
        useMapStore.getState().selectFeature(featureId);
        useMapStore.getState().openIdentifyPanel({
          id: featureId,
          layerId: features[0].layer?.id?.replace(/-fill|-stroke|-circle|-labels$/, '') ?? '',
          geom: features[0].geometry,
          props: features[0].properties ?? {},
          status: (features[0].properties?.status as 'pending') ?? 'pending',
          createdAt: '',
          updatedAt: '',
        });
      }
    },
    [mapRef, interactiveLayerIds]
  );

  const handleHover = useCallback(
    (event: MapLayerMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const features = map.queryRenderedFeatures(event.point, {
        layers: interactiveLayerIds,
      });

      const featureId = features.length > 0
        ? (features[0].id?.toString() ?? features[0].properties?.id ?? null)
        : null;

      setHoveredFeatureId(featureId);

      // Cursor
      map.getCanvas().style.cursor = features.length > 0 ? 'pointer' : '';
    },
    [mapRef, interactiveLayerIds, setHoveredFeatureId]
  );

  return { handleClick, handleHover };
}
