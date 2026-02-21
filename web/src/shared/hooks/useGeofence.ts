// =====================================================
//  FieldCorrect — Geofencing hook
//  Checks if user has an assigned zone and provides
//  zone filtering utilities.
// =====================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/infra/supabase';
import { useProjectStore } from '@/stores/projectStore';
import * as turf from '@turf/turf';
import { useCallback, useMemo } from 'react';

interface GeofenceResult {
  /** The user's zone polygon (null = no zone = unrestricted) */
  zone: GeoJSON.Polygon | null;
  /** Whether the user has a zone restriction */
  isRestricted: boolean;
  /** Check if a point is inside the user's zone */
  isInsideZone: (lng: number, lat: number) => boolean;
  /** Check if a geometry intersects the user's zone */
  intersectsZone: (geometry: GeoJSON.Geometry) => boolean;
  /** Filter features to only those inside the zone */
  filterByZone: <T extends { geom: GeoJSON.Geometry }>(features: T[]) => T[];
  /** Zone as a bounding box [west, south, east, north] or null */
  zoneBbox: [number, number, number, number] | null;
  isLoading: boolean;
}

export function useGeofence(): GeofenceResult {
  const { currentProject } = useProjectStore();

  const { data: zone = null, isLoading } = useQuery({
    queryKey: ['user-zone', currentProject?.id],
    queryFn: async () => {
      if (!currentProject) return null;
      const { data, error } = await supabase.rpc('get_user_zone', {
        p_project_id: currentProject.id,
      });
      if (error || !data) return null;
      // Supabase returns geometry as GeoJSON from PostGIS
      return (typeof data === 'string' ? JSON.parse(data) : data) as GeoJSON.Polygon;
    },
    enabled: !!currentProject,
    staleTime: 5 * 60_000, // 5 min
  });

  const isRestricted = !!zone;

  const zoneTurf = useMemo(() => {
    if (!zone) return null;
    try {
      return turf.polygon(zone.coordinates);
    } catch {
      return null;
    }
  }, [zone]);

  const zoneBbox = useMemo((): [number, number, number, number] | null => {
    if (!zoneTurf) return null;
    const bb = turf.bbox(zoneTurf);
    return [bb[0], bb[1], bb[2], bb[3]];
  }, [zoneTurf]);

  const isInsideZone = useCallback(
    (lng: number, lat: number): boolean => {
      if (!zoneTurf) return true; // no zone = allowed everywhere
      return turf.booleanPointInPolygon(turf.point([lng, lat]), zoneTurf);
    },
    [zoneTurf],
  );

  const intersectsZone = useCallback(
    (geometry: GeoJSON.Geometry): boolean => {
      if (!zoneTurf) return true;
      try {
        const feat = turf.feature(geometry);
        return turf.booleanIntersects(feat, zoneTurf);
      } catch {
        return true;
      }
    },
    [zoneTurf],
  );

  const filterByZone = useCallback(
    <T extends { geom: GeoJSON.Geometry }>(features: T[]): T[] => {
      if (!zoneTurf) return features;
      return features.filter((f) => {
        try {
          return turf.booleanIntersects(turf.feature(f.geom), zoneTurf);
        } catch {
          return true;
        }
      });
    },
    [zoneTurf],
  );

  return {
    zone,
    isRestricted,
    isInsideZone,
    intersectsZone,
    filterByZone,
    zoneBbox,
    isLoading,
  };
}
