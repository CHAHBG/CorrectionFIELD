// =====================================================
//  FieldCorrect — Dexie.js IndexedDB schema (offline DB)
// =====================================================

import Dexie from 'dexie';
import type { AppFeature, Correction, Layer, SyncOp } from '@/shared/types';

export interface CachedTile {
  key: string;
  data: ArrayBuffer;
  expires: number;
}

export interface LocalFeature extends AppFeature {
  _dirty?: boolean;
}

export interface LocalCorrection extends Correction {
  _dirty?: boolean;
}

export class FieldCorrectDB extends Dexie {
  features!: Dexie.Table<LocalFeature, string>;
  corrections!: Dexie.Table<LocalCorrection, string>;
  layers!: Dexie.Table<Layer, string>;
  syncQueue!: Dexie.Table<SyncOp, number>;
  tiles!: Dexie.Table<CachedTile, string>;

  constructor() {
    super('FieldCorrectDB');
    this.version(1).stores({
      features: 'id, layerId, status, updatedAt',
      corrections: 'id, featureId, dirty, createdAt',
      layers: 'id, projectId',
      syncQueue: '++id, op, entityType, createdAt, attempts',
      tiles: 'key, expires',
    });
  }
}

export const db = new FieldCorrectDB();
