/**
 * @deprecated Use `screens/ImportWizardScreen.tsx` for GPKG import.
 * v2 imports GPKGs via SQLite ATTACH and streams features to Supabase.
 */

import { Database } from './Database';

export interface Parcel {
    id: number;
    geom: any; // GeoJSON
    commune_ref: string;
    num_parcel: string;
}

export class GeoPkgDataSource {
    private db: Database;

    constructor() {
        this.db = Database.getInstance();
    }

    /**
     * Queries parcels within a bounding box from all attached GeoPackages.
     * Since we have multiple GPKGs attached as alias DBs, we need to query them.
     */
    public async getParcelsInBbox(minX: number, minY: number, maxX: number, maxY: number): Promise<Parcel[]> {
        // This logic depends on how many DBs are attached and what their table names are.
        // Assuming we have a list of active communes based on location?
        // For simplicity, let's assume we query the 'current' commune's GPKG.

        // TODO: Implement proper routing based on Commune.
        return [];
    }

    /**
     * Example query for a specific table in an attached DB.
     */
    public async queryTable(alias: string, tableName: string): Promise<any[]> {
        const conn = this.db.getDB();
        // Uses op-sqlite execute
        const result = await conn.execute(`SELECT * FROM ${alias}.${tableName} LIMIT 10`);
        return (result.rows as any[]) || [];
    }
}
