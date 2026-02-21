// =====================================================
//  FieldCorrect — Measure hook (distance/area)
// =====================================================

import { useMemo, useState, useCallback } from 'react';
import * as turf from '@turf/turf';

type MeasureMode = 'distance' | 'area';

export function useMeasure() {
  const [points, setPoints] = useState<[number, number][]>([]);
  const [mode, setMode] = useState<MeasureMode>('distance');

  const result = useMemo(() => {
    if (mode === 'distance' && points.length >= 2) {
      const line = turf.lineString(points);
      const dist = turf.length(line, { units: 'meters' });
      return formatDistance(dist);
    }
    if (mode === 'area' && points.length >= 3) {
      const poly = turf.polygon([[...points, points[0]]]);
      const m2 = turf.area(poly);
      return formatArea(m2);
    }
    return null;
  }, [points, mode]);

  // Segment distances for showing intermediate measurements
  const segments = useMemo(() => {
    if (points.length < 2) return [];
    return points.slice(1).map((pt, i) => {
      const from = turf.point(points[i]);
      const to = turf.point(pt);
      return turf.distance(from, to, { units: 'meters' });
    });
  }, [points]);

  const addPoint = useCallback((lngLat: { lng: number; lat: number }) => {
    setPoints((pts) => [...pts, [lngLat.lng, lngLat.lat]]);
  }, []);

  const reset = useCallback(() => {
    setPoints([]);
  }, []);

  return { points, result, segments, addPoint, setMode, mode, reset };
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${meters.toFixed(1)} m`;
}

function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
  return `${m2.toFixed(1)} m²`;
}
