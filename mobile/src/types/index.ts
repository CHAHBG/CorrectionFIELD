// =====================================================
//  FieldCorrect Mobile — Core type definitions
// =====================================================

import type { Feature as GeoFeature, Geometry, Position, FeatureCollection } from 'geojson';

// Re-export GeoJSON types for convenience
export type { Geometry, Position, FeatureCollection, GeoFeature };

// ── Geometry types ─────────────────────────────────
export type GeometryType = 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';

// ── Feature status ─────────────────────────────────
export type FeatureStatus = 'draft' | 'pending' | 'locked' | 'corrected' | 'validated' | 'rejected';

// ── Correction status ──────────────────────────────
export type CorrectionStatus = 'pending' | 'submitted' | 'validated' | 'rejected';

// ── Member roles ───────────────────────────────────
export type MemberRole = 'owner' | 'admin' | 'supervisor' | 'corrector' | 'editor' | 'viewer';

// ── Field types (XLSForm compatible) ───────────────
export type FieldType =
  | 'text' | 'string' | 'integer' | 'float' | 'number' | 'decimal'
  | 'select_one' | 'select_multiple'
  | 'date' | 'datetime' | 'geopoint' | 'image' | 'note'
  | 'calculate' | 'repeat' | 'boolean' | 'enum';

// ── Field schema ───────────────────────────────────
export interface FieldSchema {
  name: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  editable?: boolean;
  relevant?: string;
  constraint?: string;
  calculate?: string;
  hint?: string;
  enum_values?: EnumValue[];
}

export interface EnumValue {
  value: string;
  label: string;
  list_name?: string;
}

// ── Style types (simplified for mobile) ────────────
export interface LayerStyle {
  fill_color?: string;
  stroke_color?: string;
  stroke_width?: number;
  opacity?: number;
  point_radius?: number;
  rules?: StyleRule[];
  labels?: LabelConfig;
}

export interface StyleRule {
  value: string;
  label?: string;
  color: string;
  opacity?: number;
}

export interface LabelConfig {
  enabled: boolean;
  field: string;
  fontSize?: number;
  color?: string;
}

// ── Layer ──────────────────────────────────────────
export interface Layer {
  id: string;
  project_id?: string;
  name: string;
  geometry_type: string;
  source_crs?: string;
  fields: FieldSchema[];
  style: LayerStyle;
  visible: boolean;
  sort_order: number;
}

// ── App Feature ────────────────────────────────────
export interface AppFeature {
  id: string;
  layer_id: string;
  geom: Geometry | null;
  props: Record<string, any>;
  status: FeatureStatus;
  dirty: boolean;
}

// ── Correction ─────────────────────────────────────
export interface Correction {
  id: string;
  feature_id: string;
  layer_id: string;
  user_id: string;
  status: CorrectionStatus;
  props_patch: Record<string, any>;
  geom_corrected?: Geometry | null;
  comment?: string;
  media_urls: string[];
  dirty: boolean;
  created_at: string;
  updated_at: string;
}

// ── Organization ───────────────────────────────────
export interface Organization {
  id: string;
  slug: string;
  name: string;
  billing_plan: string;
  role: 'owner' | 'admin' | 'member';
}

// ── Project ────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  slug: string;
  description?: string;
  settings: ProjectSettings;
  created_at: string;
  updated_at: string;
  role?: MemberRole; // User's role in this project
}

export interface ProjectSettings {
  default_crs: string;
  snap_tolerance: number;
  auto_lock: boolean;
  require_validation: boolean;
  offline_enabled: boolean;
  kobo_server_url?: string;
}

// ── User Profile ───────────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: MemberRole;
  avatar_url?: string;
}

// ── Sync operation ─────────────────────────────────
export interface SyncOp {
  id: number;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  entity_type: 'feature' | 'correction' | 'layer';
  entity_id: string;
  payload: any;
  created_at?: string;
  attempts: number;
}

// ── Map tool ───────────────────────────────────────
export type MapTool =
  | 'select' | 'pan' | 'identify' | 'correct' | 'info'
  | 'edit' | 'draw_polygon' | 'draw_point' | 'draw_line'
  | 'measure_distance' | 'measure_area';

// ── Navigation types ───────────────────────────────
export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  Projects: undefined;
  Main: undefined;
  CorrectionForm: { featureId: string; layerId: string };
  Settings: undefined;
  Sync: undefined;
  ConflictMerge: {
    featureId: string;
    localData: { props: Record<string, any>; geom: any; layer_id: string; status: string };
    serverData: { props: Record<string, any>; geom: any; layer_id: string; status: string };
  };
};

export type MainTabParamList = {
  Map: undefined;
  Layers: undefined;
  Corrections: undefined;
  Profile: undefined;
};
