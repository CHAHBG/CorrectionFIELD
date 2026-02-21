import { useState, useEffect } from 'react';

interface LocationState {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    timestamp: number | null;
    error: string | null;
}

export function useGeolocation(enableHighAccuracy = true) {
    const [location, setLocation] = useState<LocationState>(() => ({
        latitude: null,
        longitude: null,
        accuracy: null,
        timestamp: null,
        error: typeof navigator !== 'undefined' && !navigator.geolocation
            ? 'Geolocation not supported'
            : null,
    }));

    useEffect(() => {
        if (!navigator.geolocation) {
            return;
        }

        const success = (position: GeolocationPosition) => {
            setLocation({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                timestamp: position.timestamp,
                error: null,
            });
        };

        const error = (err: GeolocationPositionError) => {
            setLocation(prev => ({ ...prev, error: err.message }));
        };

        const options = {
            enableHighAccuracy,
            timeout: 20000,
            maximumAge: 1000,
        };

        const id = navigator.geolocation.watchPosition(success, error, options);

        return () => navigator.geolocation.clearWatch(id);
    }, [enableHighAccuracy]);

    return location;
}
