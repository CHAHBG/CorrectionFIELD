/**
 * @deprecated Use `infra/db/LocalDB.ts` instead.
 * This file is kept for reference only — all v2 code uses LocalDB.
 */

import { open, type DB } from '@op-engineering/op-sqlite';
import RNFS from 'react-native-fs';

const DB_NAME = 'CorrectionField.db';

export class Database {
    private static instance: Database;
    private db: DB | null = null;

    private constructor() { }

    public static getInstance(): Database {
        if (!Database.instance) {
            Database.instance = new Database();
        }
        return Database.instance;
    }

    public async init(): Promise<void> {
        if (this.db) return;

        // Check if DB exists in Documents folder
        const dbPath = `${RNFS.DocumentDirectoryPath}/${DB_NAME}`;
        const exists = await RNFS.exists(dbPath);

        if (!exists) {
            console.log('Database not found, initializing...');
            // In a real scenario, we might import from assets or create a fresh one.
            // For now, let's create a fresh one and attach the GeoPackages later.
        }

        try {
            this.db = open({
                name: DB_NAME,
            });
            console.log('Database opened successfully');

            await this.runMigrations();
        } catch (e) {
            console.error('Failed to open database', e);
            throw e;
        }
    }

    private async runMigrations() {
        if (!this.db) return;

        // Create Metadata table
        this.db.execute(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);

        // Create Corrections table
        this.db.execute(`
      CREATE TABLE IF NOT EXISTS corrections (
        uuid TEXT PRIMARY KEY,
        parcel_id TEXT,
        commune_code TEXT,
        new_num_parcel TEXT,
        status TEXT DEFAULT 'draft',
        gps_lat REAL,
        gps_lng REAL,
        synced_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    }

    public getDB(): DB {
        if (!this.db) {
            throw new Error('Database not initialized');
        }
        return this.db;
    }

    /**
     * Imports a GeoPackage from assets into the main DB or attaches it.
     * Since we have multiple GPKGs, attaching them might be better for read-only layers.
     */
    public async attachGeoPackage(filename: string, alias: string): Promise<void> {
        // Copy GPKG from assets to DocumentDirectory
        const sourcePath = `${RNFS.DocumentDirectoryPath}/${filename}`; // Assuming we copied it there
        // Actually, we need to copy from assets first.

        // copyFileAssets supports plain files.
        // We need to implement asset copying logic first.

        const dbPath = `${RNFS.DocumentDirectoryPath}/${filename}`;
        // Check if exists
        if (!await RNFS.exists(dbPath)) {
            try {
                // Android only: "data/filename"
                await RNFS.copyFileAssets(`data/${filename}`, dbPath);
            } catch (e) {
                console.error(`Failed to copy asset ${filename}`, e);
                return;
            }
        }

        // Attach
        try {
            this.db?.execute(`ATTACH DATABASE '${dbPath}' AS ${alias}`);
            console.log(`Attached ${alias}`);
        } catch (e) {
            console.error(`Failed to attach ${alias}`, e);
        }
    }
}
