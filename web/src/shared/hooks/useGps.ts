// =====================================================
//  FieldCorrect — GPS Geolocation hook
// =====================================================

import { useState, useEffect, useCallback } from 'react';

interface GpsState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  altitude: number | null;
  timestamp: number | null;
  error: string | null;
  loading: boolean;
}

export function useGps(options?: { watch?: boolean; enableHighAccuracy?: boolean }) {
  const [state, setState] = useState<GpsState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    altitude: null,
    timestamp: null,
    error: null,
    loading: false,
  });

  const capture = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'Geolocation not supported' }));
      return;
    }

    setState((s) => ({ ...s, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          timestamp: pos.timestamp,
          error: null,
          loading: false,
        });
      },
      (err) => {
        setState((s) => ({ ...s, error: err.message, loading: false }));
      },
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  }, [options?.enableHighAccuracy]);

  // Watch mode
  useEffect(() => {
    if (!options?.watch || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          timestamp: pos.timestamp,
          error: null,
          loading: false,
        });
      },
      (err) => {
        setState((s) => ({ ...s, error: err.message, loading: false }));
      },
      {
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: 15000,
        maximumAge: 5000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [options?.watch, options?.enableHighAccuracy]);

  return { ...state, capture };
}
