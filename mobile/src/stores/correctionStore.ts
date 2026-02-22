// =====================================================
//  FieldCorrect Mobile — Correction Store (Zustand)
// =====================================================

import { create } from 'zustand';
import { Correction, CorrectionStatus } from '@/types';
import { localDB } from '@/infra/db/LocalDB';
import uuid from 'react-native-uuid';

interface CorrectionState {
  corrections: Correction[];
  loading: boolean;

  loadByFeature: (featureId: string) => Promise<void>;
  loadAll: () => Promise<void>;
  addCorrection: (c: Omit<Correction, 'id' | 'created_at' | 'updated_at'>) => Promise<Correction>;
  updateStatus: (correctionId: string, status: CorrectionStatus) => Promise<void>;
}

export const useCorrectionStore = create<CorrectionState>((set) => ({
  corrections: [],
  loading: false,

  loadByFeature: async (featureId) => {
    set({ loading: true });
    const rows = await localDB.getCorrectionsByFeature(featureId);
    set({ corrections: rows, loading: false });
  },

  loadAll: async () => {
    set({ loading: true });
    const db = localDB.getDB();
    const result = await db.execute('SELECT * FROM corrections ORDER BY created_at DESC LIMIT 500');
    const rows: Correction[] = (result.rows ?? []).map((r: any) => ({
      ...r,
      props_patch: r.props_patch ? JSON.parse(r.props_patch) : {},
      geom_corrected: r.geom_corrected ? JSON.parse(r.geom_corrected) : null,
      media_urls: r.media_urls ? JSON.parse(r.media_urls) : [],
    }));
    set({ corrections: rows, loading: false });
  },

  addCorrection: async (c) => {
    const correction: Correction = {
      ...c,
      id: String(uuid.v4()),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await localDB.insertCorrection(correction);

    // Mark parent feature as "pending"
    const db = localDB.getDB();
    await db.execute("UPDATE features SET status = 'pending', dirty = 1 WHERE id = ?", [c.feature_id]);

    // get updated feature to enqueue
    const updatedFeature = await localDB.getFeatureById(c.feature_id);
    if (updatedFeature) {
      await localDB.enqueueSyncOp('UPDATE', 'feature', updatedFeature.id, {
        id: updatedFeature.id,
        status: 'pending',
        updated_at: new Date().toISOString(),
      });
    }

    // enqueue for sync
    await localDB.enqueueSyncOp('INSERT', 'correction', correction.id, correction);

    set((s) => ({ corrections: [correction, ...s.corrections] }));
    return correction;
  },

  updateStatus: async (correctionId, status) => {
    const db = localDB.getDB();
    await db.execute('UPDATE corrections SET status = ?, dirty = 1 WHERE id = ?', [status, correctionId]);
    set((s) => ({
      corrections: s.corrections.map((c) =>
        c.id === correctionId ? { ...c, status } : c,
      ),
    }));
  },
}));
