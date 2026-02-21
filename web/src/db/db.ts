import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface CorrectionDB extends DBSchema {
    communes: {
        key: number;
        value: {
            id?: number;
            code: string;
            name: string;
            region?: string;
            departement?: string;
            arrondissement?: string;
            superficie_ha?: number;
            bbox: [number, number, number, number]; // minX, minY, maxX, maxY
            geometry: unknown; // GeoJSON MultiPolygon
        };
        indexes: { 'by-code': string };
    };
    parcels: {
        key: number;
        value: {
            id?: number;
            communeId: string; // Refers to commune code
            numParcel: string;
            type: 'sans_enquete' | 'sans_numero';
            status: 'pending' | 'corrected' | 'validated' | 'synced';
            bbox: [number, number, number, number];
            geometry: unknown; // GeoJSON MultiPolygon
            properties: Record<string, unknown>;
            updatedAt: string;
            isDeleted: boolean;
        };
        indexes: {
            'by-commune': string;
            'by-status': string;
            'by-num': string;
        };
    };
    corrections: {
        key: number;
        value: {
            id?: number;
            uuid: string;
            parcelId: number; // Refers to parcels.key (id)
            numParcel: string;
            enqueteur: string;
            status: 'draft' | 'submitted' | 'synced';
            notes?: string;
            gpsLatitude: number;
            gpsLongitude: number;
            gpsAccuracy: number;
            geometry?: unknown; // Adjusted geometry
            dirty: number; // 1 = needs sync
            createdAt: string;
            updatedAt: string;
        };
        indexes: {
            'by-uuid': string;
            'by-parcel': number;
            'by-dirty': number;
        };
    };
    sync_log: {
        key: number;
        value: {
            id?: number;
            entityType: 'correction' | 'parcel';
            entityId: number;
            action: 'create' | 'update' | 'delete';
            payload: Record<string, unknown>;
            createdAt: string;
            syncedAt?: string;
        };
        indexes: { 'by-synced': string }; // Indexing on syncedAt usually needs map/reduce or just scan nulls. 
        // IDB doesn't index null well directly in all browsers but we can use an index.
    };
    app_meta: {
        key: string;
        value: {
            key: string;
            value: unknown;
        };
    };
}

const DB_NAME = 'correction-field-db';
const DB_VERSION = 1;

export const initDB = async (): Promise<IDBPDatabase<CorrectionDB>> => {
    return openDB<CorrectionDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Communes
            if (!db.objectStoreNames.contains('communes')) {
                const store = db.createObjectStore('communes', { keyPath: 'id', autoIncrement: true });
                store.createIndex('by-code', 'code', { unique: true });
            }

            // Parcels
            if (!db.objectStoreNames.contains('parcels')) {
                const store = db.createObjectStore('parcels', { keyPath: 'id', autoIncrement: true });
                store.createIndex('by-commune', 'communeId', { unique: false });
                store.createIndex('by-status', 'status', { unique: false });
                store.createIndex('by-num', 'numParcel', { unique: false });
            }

            // Corrections
            if (!db.objectStoreNames.contains('corrections')) {
                const store = db.createObjectStore('corrections', { keyPath: 'id', autoIncrement: true });
                store.createIndex('by-uuid', 'uuid', { unique: true });
                store.createIndex('by-parcel', 'parcelId', { unique: false });
                store.createIndex('by-dirty', 'dirty', { unique: false });
            }

            // Sync Log
            if (!db.objectStoreNames.contains('sync_log')) {
                db.createObjectStore('sync_log', { keyPath: 'id', autoIncrement: true });
                // We might want to find pending items.
                // store.createIndex('by-synced', 'syncedAt', { unique: false });
            }

            // App Meta
            if (!db.objectStoreNames.contains('app_meta')) {
                db.createObjectStore('app_meta', { keyPath: 'key' });
            }
        },
    });
};

export const getDB = async () => initDB();
