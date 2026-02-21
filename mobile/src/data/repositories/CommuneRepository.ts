/**
 * @deprecated v2 manages layers & boundaries via Supabase `layers` table.
 * See `stores/layerStore.ts` and `infra/api` for the v2 approach.
 */

import { Database } from '../sources/Database';
import { GeoPkgDataSource } from '../sources/GeoPkgDataSource';
import RNFS from 'react-native-fs';

export interface Commune {
    id: string; // Filename without extension
    name: string;
    bbox: [number, number, number, number]; // minX, minY, maxX, maxY
}

export class CommuneRepository {
    private db: Database;
    private communes: Commune[] = [];
    private loaded = false;

    constructor() {
        this.db = Database.getInstance();
    }

    /**
     * Scans the assets/data folder (which we copied to Documents/data) to find all Commune GPKGs.
     * Reads their extent from the 'gpkg_contents' table.
     */
    async loadCommunes(): Promise<void> {
        if (this.loaded) return;

        const dataPath = `${RNFS.DocumentDirectoryPath}/data/Communes Boundou Procasef`;
        // Check if folder exists
        if (!await RNFS.exists(dataPath)) {
            console.warn('Communes data folder not found at', dataPath);
            return;
        }

        const files = await RNFS.readDir(dataPath);
        const gpkgFiles = files.filter(f => f.name.endsWith('.gpkg'));

        for (const file of gpkgFiles) {
            const name = file.name.replace('.gpkg', '');

            // We need to open the DB to read bbox.
            // Since opening 17 DBs is expensive, we might do it lazily or just once.
            // For now, let's try to attach it temporarily or open a separate connection?
            // op-sqlite open() returns a connection. We can open multiple.

            // TODO: Optimize this. For MVP, we might hardcode or rely on file names.
            // Let's assume we just store the file paths and load on demand.

            this.communes.push({
                id: file.path,
                name: name,
                bbox: [0, 0, 0, 0], // Placeholder, need to query gpkg_contents
            });
        }

        this.loaded = true;
        console.log(`Loaded ${this.communes.length} communes`);
    }

    async findCommuneByLocation(lat: number, lng: number): Promise<Commune | null> {
        if (!this.loaded) await this.loadCommunes();

        // 1. naive loop features?
        // real implementation requires reading geometry.
        // For MVP, just return the first one or logic based on name?
        // Let's implement a real check if possible.

        // Return first for testing
        return this.communes.length > 0 ? this.communes[0] : null;
    }
}
