// =====================================================
//  FieldCorrect — Map Store (Zustand)
// =====================================================

import { create } from 'zustand';
import type { MapTool, Viewport, OnlineUser, AppFeature } from '@/shared/types';

interface MapState {
  // Viewport
  viewport: Viewport;
  setViewport: (v: Partial<Viewport>) => void;

  // Active tool
  activeTool: MapTool;
  setTool: (tool: MapTool) => void;

  // Selection
  selectedFeatureIds: Set<string>;
  selectFeature: (id: string) => void;
  selectFeatures: (ids: string[]) => void;
  toggleFeatureSelection: (id: string) => void;
  clearSelection: () => void;
  setSelectedFeatureIds: (ids: string[]) => void;

  // Hover
  hoveredFeatureId: string | null;
  setHoveredFeatureId: (id: string | null) => void;

  // Identify panel
  identifiedFeature: AppFeature | null;
  openIdentifyPanel: (feature: AppFeature) => void;
  closeIdentifyPanel: () => void;

  // Panels
  layerPanelOpen: boolean;
  setLayerPanelOpen: (open: boolean) => void;
  attributeTableOpen: boolean;
  setAttributeTableOpen: (open: boolean) => void;
  attributeTableLayerId: string | null;
  setAttributeTableLayerId: (id: string | null) => void;

  // Online users (presence)
  onlineUsers: OnlineUser[];
  setOnlineUsers: (users: OnlineUser[]) => void;

  // Measure
  measurePoints: [number, number][];
  addMeasurePoint: (pt: [number, number]) => void;
  clearMeasurePoints: () => void;
}

export const useMapStore = create<MapState>()((set) => ({
  // Viewport — default Kédougou, Sénégal
  viewport: { latitude: 12.56, longitude: -12.18, zoom: 10 },
  setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),

  // Tool
  activeTool: 'select',
  setTool: (tool) => set({ activeTool: tool }),

  // Selection
  selectedFeatureIds: new Set<string>(),
  selectFeature: (id) => set({ selectedFeatureIds: new Set([id]) }),
  selectFeatures: (ids) => set({ selectedFeatureIds: new Set(ids) }),
  toggleFeatureSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedFeatureIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedFeatureIds: next };
    }),
  clearSelection: () => set({ selectedFeatureIds: new Set() }),
  setSelectedFeatureIds: (ids) => set({ selectedFeatureIds: new Set(ids) }),

  // Hover
  hoveredFeatureId: null,
  setHoveredFeatureId: (id) => set({ hoveredFeatureId: id }),

  // Identify
  identifiedFeature: null,
  openIdentifyPanel: (feature) => set({ identifiedFeature: feature }),
  closeIdentifyPanel: () => set({ identifiedFeature: null }),

  // Panels
  layerPanelOpen: true,
  setLayerPanelOpen: (open) => set({ layerPanelOpen: open }),
  attributeTableOpen: false,
  setAttributeTableOpen: (open) => set({ attributeTableOpen: open }),
  attributeTableLayerId: null,
  setAttributeTableLayerId: (id) => set({ attributeTableLayerId: id }),

  // Online users
  onlineUsers: [],
  setOnlineUsers: (users) => set({ onlineUsers: users }),

  // Measure
  measurePoints: [],
  addMeasurePoint: (pt) => set((s) => ({ measurePoints: [...s.measurePoints, pt] })),
  clearMeasurePoints: () => set({ measurePoints: [] }),
}));
