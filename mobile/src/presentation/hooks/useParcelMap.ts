/**
 * @deprecated v2 uses `stores/mapStore.ts` and `screens/MapScreen.tsx`.
 */

import { useState, useCallback, useEffect } from 'react';
import { GetParcelsByGeofence } from '../../domain/usecases/GetParcelsByGeofence';
import { Parcel } from '../../domain/models/Parcel';

export function useParcelMap() {
    const [parcels, setParcels] = useState<any>({
        type: 'FeatureCollection',
        features: []
    });
    const [currentCommune, setCurrentCommune] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    // Use Case instance
    const getParcelsUC = new GetParcelsByGeofence();

    const onUserLocationUpdate = useCallback(async (location: any) => {
        if (!location || !location.coords) return;

        const { latitude, longitude } = location.coords;

        // MVP Logic:
        // 1. Find Commune (mocked for now)
        // 2. Fetch Parcels

        // Debounce or check if we moved enough?
        // For now, just trigger fetch if commune changes or first load.

        try {
            // Mock bbox around user
            const delta = 0.005;
            const bbox = [
                longitude - delta,
                latitude - delta,
                longitude + delta,
                latitude + delta
            ] as [number, number, number, number];

            const domainParcels = await getParcelsUC.execute(bbox);

            setParcels({
                type: 'FeatureCollection',
                features: domainParcels.map(p => ({
                    type: 'Feature',
                    id: p.id,
                    geometry: p.geometry,
                    properties: {
                        commune: p.communeRef,
                        num: p.numParcel,
                        status: p.status
                    }
                }))
            });
        } catch (e) {
            console.error(e);
        }
    }, [getParcelsUC]);

    return {
        parcels,
        onUserLocationUpdate
    };
}
