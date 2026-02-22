// =====================================================
//  FieldCorrect — Coordinate Display
// =====================================================

import { useState, useCallback } from 'react';
import type { MapLayerMouseEvent } from 'react-map-gl/maplibre';

export function CoordinateDisplay() {
  const [coords] = useState<{ lng: number; lat: number } | null>(null);

  return (
    <div className="absolute bottom-2 left-2 z-10 rounded bg-white/90 px-2 py-1 text-xs font-mono text-slate-600 shadow-sm border border-slate-200">
      {coords
        ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)} · WGS84`
        : 'Survolez la carte'}
    </div>
  );
}

/**
 * Hook to track mouse coordinates for the display.
 */
export function useCoordinateTracker() {
  const [coords, setCoords] = useState<{ lng: number; lat: number } | null>(null);

  const onMouseMove = useCallback((e: MapLayerMouseEvent) => {
    setCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
  }, []);

  return { coords, onMouseMove };
}
