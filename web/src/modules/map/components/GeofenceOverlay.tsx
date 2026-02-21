// =====================================================
//  FieldCorrect — GeofenceOverlay
//  Shows the current user's assigned zone on the map.
// =====================================================

import { useMemo } from 'react';
import { Source, Layer } from 'react-map-gl/maplibre';
import { useGeofence } from '@/shared/hooks/useGeofence';

export function GeofenceOverlay() {
  const { zone, isRestricted } = useGeofence();

  const geojson = useMemo((): GeoJSON.FeatureCollection => {
    if (!zone) return { type: 'FeatureCollection', features: [] };
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: zone,
          properties: {},
        },
      ],
    };
  }, [zone]);

  if (!isRestricted) return null;

  return (
    <Source id="geofence-zone" type="geojson" data={geojson}>
      <Layer
        id="geofence-zone-fill"
        type="fill"
        paint={{
          'fill-color': '#10b981',
          'fill-opacity': 0.08,
        }}
      />
      <Layer
        id="geofence-zone-stroke"
        type="line"
        paint={{
          'line-color': '#10b981',
          'line-width': 2,
          'line-dasharray': [6, 3],
        }}
      />
    </Source>
  );
}
