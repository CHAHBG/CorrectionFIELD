/**
 * @deprecated v2 queries features via `infra/db/LocalDB.ts` and Supabase.
 * See `stores/layerStore.ts` → `fetchFeatures()`.
 */

import { GeoPkgDataSource } from '../../data/sources/GeoPkgDataSource';
import { Parcel } from '../models/Parcel';

export class GetParcelsByGeofence {
    private dataSource: GeoPkgDataSource;

    constructor() {
        this.dataSource = new GeoPkgDataSource();
    }

    async execute(bbox: [number, number, number, number]): Promise<Parcel[]> {
        // 1. Identify which Communes overlap with bbox (using R-Tree of Communes if available)
        // 2. Query specific GeoPackages for parcels in bbox

        // For MVP, we will query a hardcoded alias or loop through attached DBs.
        // Let's assume we are attached to 'BALLOU' for testing.

        // Convert GeoPkg result to Domain Model
        // TODO: Implementation of query
        return [];
    }
}
