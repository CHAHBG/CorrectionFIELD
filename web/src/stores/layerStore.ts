// =====================================================
//  FieldCorrect — Layer Store (Zustand)
// =====================================================

import { create } from 'zustand';
import type { Layer, LayerStyle } from '@/shared/types';

interface LayerState {
  layers: Layer[];
  setLayers: (layers: Layer[]) => void;
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  reorderLayers: (ids: string[]) => void;
  toggleVisibility: (id: string) => void;
  setLayerStyle: (id: string, style: LayerStyle) => void;
  getVisibleLayers: () => Layer[];
}

export const useLayerStore = create<LayerState>()((set, get) => ({
  layers: [],

  setLayers: (layers) => set({ layers }),

  addLayer: (layer) =>
    set((s) => ({ layers: [...s.layers, layer] })),

  removeLayer: (id) =>
    set((s) => ({ layers: s.layers.filter((l) => l.id !== id) })),

  updateLayer: (id, updates) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    })),

  reorderLayers: (ids) =>
    set((s) => {
      const layerMap = new Map(s.layers.map((l) => [l.id, l]));
      const ordered = ids
        .map((id) => layerMap.get(id))
        .filter(Boolean) as Layer[];
      // Any layers not in ids are appended at the end
      const remaining = s.layers.filter((l) => !ids.includes(l.id));
      return { layers: [...ordered, ...remaining] };
    }),

  toggleVisibility: (id) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l
      ),
    })),

  setLayerStyle: (id, style) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, style } : l)),
    })),

  getVisibleLayers: () => get().layers.filter((l) => l.visible),
}));
