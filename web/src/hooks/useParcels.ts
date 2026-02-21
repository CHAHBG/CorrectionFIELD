import { useState, useEffect, useCallback } from 'react';
import { getDB } from '../db/db';

export interface Parcel {
    id?: number;
    communeId: string;
    numParcel: string;
    type: string;
    status: string;
    geometry: GeoJSON.Geometry;
    // ... other fields
}

export function useParcels(communeId?: string) {
    const [parcels, setParcels] = useState<Parcel[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchParcels = useCallback(async () => {
        if (!communeId) {
            setParcels([]);
            return;
        }

        setLoading(true);
        try {
            const db = await getDB();
            // Use the index to get parcels by commune
            const results = await db.getAllFromIndex('parcels', 'by-commune', communeId);
            setParcels(results as Parcel[]);
        } catch (error) {
            console.error('Failed to fetch parcels', error);
        } finally {
            setLoading(false);
        }
    }, [communeId]);

    useEffect(() => {
        fetchParcels();
    }, [fetchParcels]);

    return { parcels, loading, refresh: fetchParcels };
}
