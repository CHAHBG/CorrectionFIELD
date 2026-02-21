// =====================================================
//  FieldCorrect Mobile — Layer Store (Zustand)
// =====================================================

import { create } from 'zustand';
import { Layer } from '@/types';
import { localDB } from '@/infra/db/LocalDB';

interface LayerState {
  layers: Layer[];
  loading: boolean;

  loadLayers: () => Promise<void>;
  toggleVisibility: (layerId: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  reorderLayers: (ordered: Layer[]) => void;
  addLayer: (layer: Layer) => Promise<void>;
  removeLayer: (layerId: string) => Promise<void>;
}

export const useLayerStore = create<LayerState>((set) => ({
  layers: [],
  loading: false,

  loadLayers: async () => {
    set({ loading: true });
    try {
      const rows = await localDB.getLayers();
      set({ layers: rows, loading: false });
    } catch (e) {
      console.error('[LayerStore] loadLayers', e);
      set({ loading: false });
    }
  },

  toggleVisibility: (layerId) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } : l,
      ),
    })),

  setLayerOpacity: (layerId, opacity) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === layerId
          ? { ...l, style: { ...l.style, opacity } }
          : l,
      ),
    })),

  reorderLayers: (ordered) => set({ layers: ordered }),

  addLayer: async (layer) => {
    await localDB.upsertLayer(layer);
    const rows = await localDB.getLayers();
    set({ layers: rows });
  },

  removeLayer: async (layerId) => {
    const db = localDB.getDB();
    await db.execute('DELETE FROM layers WHERE id = ?', [layerId]);
    await db.execute('DELETE FROM features WHERE layer_id = ?', [layerId]);
    const rows = await localDB.getLayers();
    set({ layers: rows });
  },
}));
