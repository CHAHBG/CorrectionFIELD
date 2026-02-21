// =====================================================
//  FieldCorrect Mobile — Map Store (Zustand)
// =====================================================

import { create } from 'zustand';
import { MapTool } from '@/types';

interface Viewport {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

interface MapState {
  viewport: Viewport;
  activeTool: MapTool;
  selectedFeatureIds: string[];
  gpsEnabled: boolean;
  followGps: boolean;
  currentPosition: { latitude: number; longitude: number } | null;

  setViewport: (v: Partial<Viewport>) => void;
  setActiveTool: (t: MapTool) => void;
  selectFeatures: (ids: string[]) => void;
  clearSelection: () => void;
  toggleFeatureSelection: (id: string) => void;
  setGpsEnabled: (on: boolean) => void;
  setFollowGps: (on: boolean) => void;
  setCurrentPosition: (pos: { latitude: number; longitude: number } | null) => void;
}

export const useMapStore = create<MapState>((set) => ({
  viewport: {
    latitude: 12.85,
    longitude: -12.15,
    zoom: 10,
    bearing: 0,
    pitch: 0,
  },
  activeTool: 'pan',
  selectedFeatureIds: [],
  gpsEnabled: false,
  followGps: false,
  currentPosition: null,

  setViewport: (v) =>
    set((s) => ({ viewport: { ...s.viewport, ...v } })),

  setActiveTool: (t) => set({ activeTool: t }),

  selectFeatures: (ids) => set({ selectedFeatureIds: ids }),

  clearSelection: () => set({ selectedFeatureIds: [] }),

  toggleFeatureSelection: (id) =>
    set((s) => {
      const idx = s.selectedFeatureIds.indexOf(id);
      if (idx >= 0) {
        return { selectedFeatureIds: s.selectedFeatureIds.filter((x) => x !== id) };
      }
      return { selectedFeatureIds: [...s.selectedFeatureIds, id] };
    }),

  setGpsEnabled: (on) => set({ gpsEnabled: on }),
  setFollowGps: (on) => set({ followGps: on }),
  setCurrentPosition: (pos) => set({ currentPosition: pos }),
}));
