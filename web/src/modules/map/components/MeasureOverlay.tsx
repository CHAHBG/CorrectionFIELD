// =====================================================
//  FieldCorrect — MeasureOverlay (distance/area display)
// =====================================================

import { Source, Layer } from 'react-map-gl/maplibre';
import { useMapStore } from '@/stores/mapStore';
import { useMeasure } from '@/modules/map/hooks/useMeasure';
import { useMemo } from 'react';

export function MeasureOverlay() {
  const activeTool = useMapStore((s) => s.activeTool);
  const measurePoints = useMapStore((s) => s.measurePoints);
  const { result } = useMeasure();

  const isMeasuring = activeTool === 'measure_distance' || activeTool === 'measure_area';

  const geojson = useMemo((): GeoJSON.FeatureCollection => {
    if (measurePoints.length === 0) {
      return { type: 'FeatureCollection', features: [] };
    }

    const features: GeoJSON.Feature[] = [];

    // Points
    for (const pt of measurePoints) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: {},
      });
    }

    // Line connecting points
    if (measurePoints.length >= 2) {
      const coords = activeTool === 'measure_area' && measurePoints.length >= 3
        ? [...measurePoints, measurePoints[0]]
        : measurePoints;

      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {},
      });
    }

    // Polygon for area
    if (activeTool === 'measure_area' && measurePoints.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[...measurePoints, measurePoints[0]]],
        },
        properties: {},
      });
    }

    return { type: 'FeatureCollection', features };
  }, [measurePoints, activeTool]);

  if (!isMeasuring) return null;

  return (
    <>
      <Source id="measure-source" type="geojson" data={geojson}>
        <Layer
          id="measure-fill"
          type="fill"
          paint={{
            'fill-color': '#3b82f6',
            'fill-opacity': 0.15,
          }}
          filter={['==', '$type', 'Polygon']}
        />
        <Layer
          id="measure-line"
          type="line"
          paint={{
            'line-color': '#3b82f6',
            'line-width': 2,
            'line-dasharray': [4, 2],
          }}
          filter={['==', '$type', 'LineString']}
        />
        <Layer
          id="measure-points"
          type="circle"
          paint={{
            'circle-radius': 5,
            'circle-color': '#3b82f6',
            'circle-stroke-color': '#fff',
            'circle-stroke-width': 2,
          }}
          filter={['==', '$type', 'Point']}
        />
      </Source>

      {/* Result display */}
      {result && (
        <div className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-white px-4 py-2 shadow-lg border border-gray-200">
          <span className="text-sm font-semibold text-gray-900">{result}</span>
          <span className="ml-2 text-xs text-gray-500">
            {activeTool === 'measure_distance' ? 'distance totale' : 'surface'}
          </span>
        </div>
      )}
    </>
  );
}
