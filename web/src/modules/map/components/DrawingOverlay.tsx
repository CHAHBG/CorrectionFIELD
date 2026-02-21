// =====================================================
//  FieldCorrect — DrawingOverlay (point/line/polygon)
// =====================================================

import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import { useMapStore } from '@/stores/mapStore';

export function DrawingOverlay() {
  const activeTool = useMapStore((s) => s.activeTool);
  const drawingPoints = useMapStore((s) => s.drawingPoints);

  const isDrawing =
    activeTool === 'draw_point' ||
    activeTool === 'draw_line' ||
    activeTool === 'draw_polygon';

  const geojson = useMemo((): GeoJSON.FeatureCollection => {
    if (drawingPoints.length === 0)
      return { type: 'FeatureCollection', features: [] };

    const features: GeoJSON.Feature[] = [];

    // Vertex points
    drawingPoints.forEach((pt) => {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: {},
      });
    });

    // Line connecting vertices
    if (drawingPoints.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: drawingPoints },
        properties: {},
      });
    }

    // Polygon preview (close the ring)
    if (activeTool === 'draw_polygon' && drawingPoints.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[...drawingPoints, drawingPoints[0]]],
        },
        properties: {},
      });
    }

    return { type: 'FeatureCollection', features };
  }, [drawingPoints, activeTool]);

  if (!isDrawing || drawingPoints.length === 0) return null;

  return (
    <>
      <Source id="drawing-source" type="geojson" data={geojson}>
        <Layer
          id="drawing-fill"
          type="fill"
          paint={{ 'fill-color': '#f59e0b', 'fill-opacity': 0.15 }}
          filter={['==', '$type', 'Polygon']}
        />
        <Layer
          id="drawing-line"
          type="line"
          paint={{
            'line-color': '#f59e0b',
            'line-width': 2,
            'line-dasharray': [4, 2],
          }}
          filter={['==', '$type', 'LineString']}
        />
        <Layer
          id="drawing-points"
          type="circle"
          paint={{
            'circle-radius': 5,
            'circle-color': '#f59e0b',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          }}
          filter={['==', '$type', 'Point']}
        />
      </Source>

      {/* Drawing instructions */}
      <div className="absolute top-14 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-white px-4 py-2 shadow-lg border border-amber-300 text-xs space-y-0.5">
        <span className="font-semibold text-amber-700">
          {activeTool === 'draw_point' && 'Cliquez pour placer un point'}
          {activeTool === 'draw_line' && `Tracé ligne — ${drawingPoints.length} point(s)`}
          {activeTool === 'draw_polygon' && `Tracé polygone — ${drawingPoints.length} point(s)`}
        </span>
        {(activeTool === 'draw_line' || activeTool === 'draw_polygon') && drawingPoints.length >= 2 && (
          <span className="block text-gray-500">
            Double-clic ou Entrée pour terminer · Échap pour annuler
          </span>
        )}
      </div>
    </>
  );
}
