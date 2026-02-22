// =====================================================
//  FieldCorrect — Map event hooks
// =====================================================

import { useCallback, useEffect } from 'react';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl/maplibre';
import { useMapStore } from '@/stores/mapStore';
import { featuresApi } from '@/infra/api/features.api';
import { useLayerStore } from '@/stores/layerStore';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook for handling map click, hover, selection, drawing, and keyboard shortcuts.
 */
export function useMapEvents(
  mapRef: React.RefObject<MapRef | null>,
  interactiveLayerIds: string[]
) {
  const setHoveredFeatureId = useMapStore((s) => s.setHoveredFeatureId);
  const queryClient = useQueryClient();

  // ─── Finish drawing helper ───────────────────────
  const finishDrawing = useCallback(() => {
    const store = useMapStore.getState();
    const tool = store.activeTool;
    const pts = store.drawingPoints;
    const layers = useLayerStore.getState().layers;
    const editableLayer = layers.find((l) => l.isEditable && l.visible);

    if (!editableLayer || pts.length === 0) {
      store.clearDrawingPoints();
      return;
    }

    let geometry: GeoJSON.Geometry | null = null;
    if (tool === 'draw_point' && pts.length >= 1) {
      geometry = { type: 'Point', coordinates: pts[0] };
    } else if (tool === 'draw_line' && pts.length >= 2) {
      geometry = { type: 'LineString', coordinates: pts };
    } else if (tool === 'draw_polygon' && pts.length >= 3) {
      geometry = { type: 'Polygon', coordinates: [[...pts, pts[0]]] };
    }

    if (geometry) {
      featuresApi
        .bulkInsert([{
          layerId: editableLayer.id,
          geom: geometry,
          props: {},
          status: 'draft',
        }])
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['features', editableLayer.id] });
          store.pushUndo({ type: 'draw', data: { layerId: editableLayer.id } });
        })
        .catch((err) => console.error('Draw feature failed:', err));
    }

    store.clearDrawingPoints();
  }, [queryClient]);

  // ─── Keyboard shortcuts ──────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const store = useMapStore.getState();
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Escape: cancel drawing / measure / deselect
      if (e.key === 'Escape') {
        if (store.drawingPoints.length > 0) {
          store.clearDrawingPoints();
        } else if (store.measurePoints.length > 0) {
          store.clearMeasurePoints();
        } else {
          store.clearSelection();
          store.closeIdentifyPanel();
        }
        return;
      }

      // Enter: finish drawing
      if (e.key === 'Enter' && store.drawingPoints.length > 0) {
        finishDrawing();
        return;
      }

      // Backspace: remove last drawing point
      if (e.key === 'Backspace' && store.drawingPoints.length > 0) {
        e.preventDefault();
        store.removeLastDrawingPoint();
        return;
      }

      // Ctrl+Z / Ctrl+Y: undo/redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        store.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        store.redo();
        return;
      }

      // Shortcut keys for tools
      const shortcuts: Record<string, Parameters<typeof store.setTool>[0]> = {
        s: 'select', h: 'pan', i: 'identify', e: 'edit',
        p: 'draw_polygon', m: 'measure_distance',
      };
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        const tool = shortcuts[e.key.toLowerCase()];
        if (tool) store.setTool(tool);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [finishDrawing]);

  // ─── Map click ───────────────────────────────────
  const handleClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const store = useMapStore.getState();
      const activeTool = store.activeTool;

      // Drawing tools: add vertex
      if (activeTool === 'draw_point') {
        store.addDrawingPoint([event.lngLat.lng, event.lngLat.lat]);
        // Point is a single click — finish immediately
        setTimeout(() => finishDrawing(), 0);
        return;
      }
      if (activeTool === 'draw_line' || activeTool === 'draw_polygon') {
        store.addDrawingPoint([event.lngLat.lng, event.lngLat.lat]);
        return;
      }

      // Measure tools: add point
      if (activeTool === 'measure_distance' || activeTool === 'measure_area') {
        store.addMeasurePoint([event.lngLat.lng, event.lngLat.lat]);
        return;
      }

      // Only identify/select in select or identify mode
      if (activeTool !== 'select' && activeTool !== 'identify') return;

      const features = map.queryRenderedFeatures(event.point, {
        layers: interactiveLayerIds,
      });

      if (features.length === 0) {
        store.clearSelection();
        store.closeIdentifyPanel();
        return;
      }

      const featureId = features[0].properties?.id ?? features[0].id?.toString();

      if (event.originalEvent.ctrlKey || event.originalEvent.metaKey) {
        store.toggleFeatureSelection(featureId);
      } else if (event.originalEvent.shiftKey) {
        store.selectFeature(featureId);
      } else {
        store.selectFeature(featureId);
        store.openIdentifyPanel({
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
    [mapRef, interactiveLayerIds, finishDrawing]
  );

  // ─── Double click — finish line/polygon drawing ──
  const handleDblClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const activeTool = useMapStore.getState().activeTool;
      if (activeTool === 'draw_line' || activeTool === 'draw_polygon') {
        event.preventDefault();
        finishDrawing();
      }
    },
    [finishDrawing]
  );

  // ─── Hover ───────────────────────────────────────
  const handleHover = useCallback(
    (event: MapLayerMouseEvent) => {
      const map = mapRef.current?.getMap();
      if (!map) return;

      const features = map.queryRenderedFeatures(event.point, {
        layers: interactiveLayerIds,
      });

      const featureId = features.length > 0
        ? (features[0].properties?.id ?? features[0].id?.toString() ?? null)
        : null;

      setHoveredFeatureId(featureId);
    },
    [mapRef, interactiveLayerIds, setHoveredFeatureId]
  );

  return { handleClick, handleDblClick, handleHover };
}
