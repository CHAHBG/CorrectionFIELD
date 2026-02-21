// =====================================================
//  FieldCorrect — Core type definitions
// =====================================================

import type { Feature as GeoFeature, Geometry, Position, FeatureCollection } from 'geojson';

// ── Geometry types ─────────────────────────────────
export type GeometryType = 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';

// ── Feature status ─────────────────────────────────
export type FeatureStatus = 'draft' | 'pending' | 'locked' | 'corrected' | 'validated' | 'rejected';

// ── Correction status ──────────────────────────────
export type CorrectionStatus = 'submitted' | 'validated' | 'rejected';

// ── Member roles ───────────────────────────────────
export type MemberRole = 'owner' | 'admin' | 'supervisor' | 'corrector' | 'editor' | 'viewer';

// ── Field types (XLSForm compatible) ───────────────
export type FieldType =
  | 'text' | 'integer' | 'decimal' | 'select_one' | 'select_multiple'
  | 'date' | 'datetime' | 'geopoint' | 'image' | 'note'
  | 'calculate' | 'repeat' | 'boolean';

// ── Field schema ───────────────────────────────────
export interface FieldSchema {
  name: string;
  type: FieldType;
  label?: string;
  required?: boolean;
  editable?: boolean;
  relevant?: string;        // XLSForm relevance expression
  constraint?: string;      // XLSForm constraint expression
  calculate?: string;       // XLSForm calculate expression
  hint?: string;
  enumValues?: EnumValue[];
  koboQuestionName?: string;
  validation?: Record<string, unknown>;
}

export interface EnumValue {
  name: string;
  label: string;
  list_name?: string;
}

// ── Style types ────────────────────────────────────
export interface SimpleStyle {
  fillColor: string;
  fillOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  pointRadius?: number;
  pointShape?: 'circle' | 'square' | 'triangle';
}

export interface StyleRule {
  value: string;
  label?: string;
  style: Partial<SimpleStyle>;
}

export interface LabelConfig {
  enabled: boolean;
  field: string;
  fontSize: number;
  fontColor: string;
  halo: boolean;
  minZoom: number;
  placement: 'center' | 'above' | 'line';
}

export interface LayerStyle {
  mode: 'simple' | 'rule-based' | 'graduated' | 'heatmap';

  simple?: SimpleStyle;

  ruleBased?: {
    field: string;
    defaultStyle: SimpleStyle;
    rules: StyleRule[];
  };

  graduated?: {
    field: string;
    colorRamp: string[];
    breaks: number[];
  };

  labels?: LabelConfig;
}

// ── Form config ────────────────────────────────────
export interface FormConfig {
  enketoUrl?: string;
  koboAssetId?: string;
  xlsFormPath?: string;
  xlsFormId?: string;
  fieldMapping?: Record<string, string>;
}

// ── Layer ──────────────────────────────────────────
export interface Layer {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  geometryType: GeometryType;
  sourceCrs: string;
  isReference: boolean;
  isEditable: boolean;
  displayOrder: number;
  groupName?: string;
  visible: boolean;
  fields: FieldSchema[];
  style: LayerStyle;
  formConfig: FormConfig;
  minZoom: number;
  maxZoom: number;
  cluster?: boolean;
  createdAt: string;
}

// ── AppFeature (internal, not GeoJSON Feature) ────
export interface AppFeature {
  id: string;
  layerId: string;
  geom: Geometry;
  props: Record<string, unknown>;
  status: FeatureStatus;
  lockedBy?: string | null;
  lockedAt?: string | null;
  lockExpires?: string | null;
  correctedBy?: string | null;
  correctedAt?: string | null;
  validatedBy?: string | null;
  validatedAt?: string | null;
  sourceFile?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Correction ─────────────────────────────────────
export interface Correction {
  id: string;
  featureId: string;
  layerId: string;
  userId: string;
  deviceId?: string;
  propsPatch?: Record<string, unknown>;
  geomCorrected?: Geometry | null;
  koboSubmissionId?: string;
  koboFormId?: string;
  enketoSubmission?: Record<string, unknown>;
  notes?: string;
  gpsPoint?: Position | null;
  gpsAccuracy?: number;
  mediaUrls: string[];
  status: CorrectionStatus;
  conflictOf?: string | null;
  dirty: boolean;
  createdAt: string;
}

// ── Project ────────────────────────────────────────
export interface Project {
  id: string;
  slug: string;
  name: string;
  description?: string;
  ownerId: string;
  bbox?: GeoFeature['geometry'] | null;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  defaultCrs?: string;
  default_crs?: string;
  snap_tolerance?: number;
  auto_lock?: boolean;
  require_validation?: boolean;
  offline_enabled?: boolean;
  koboAssetId?: string;
  kobo_server_url?: string;
  enketoUrl?: string;
  [key: string]: unknown;
}

// ── Project Member ─────────────────────────────────
export interface ProjectMember {
  id: string;
  projectId?: string;
  project_id?: string;
  userId?: string;
  user_id?: string;
  role: MemberRole;
  assignedZone?: Geometry | null;
  joinedAt?: string;
  profile?: UserProfile;
}

// ── User Profile ───────────────────────────────────
export interface UserProfile {
  id: string;
  fullName?: string;
  full_name?: string;
  email?: string;
  avatarUrl?: string;
  avatar_url?: string;
  createdAt?: string;
}

// ── Online user (presence) ─────────────────────────
export interface OnlineUser {
  userId: string;
  name: string;
  viewport?: Viewport;
  activeTool?: string;
}

// ── Viewport ───────────────────────────────────────
export interface Viewport {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

// ── Query filter ───────────────────────────────────
export interface QueryRule {
  field: string;
  op: string;
  value: unknown;
}

export interface QueryFilterGroup {
  operator: 'AND' | 'OR';
  rules: (QueryRule | QueryFilterGroup)[];
}

export type QueryFilter = QueryFilterGroup;

// ── Sync operation ─────────────────────────────────
export interface SyncOp {
  id?: number;
  op: 'INSERT' | 'UPDATE' | 'DELETE';
  entityType: 'feature' | 'correction' | 'layer';
  entityId: string;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
}

// ── Print layout ───────────────────────────────────
export type PrintFormat = 'A4' | 'A3' | 'A2' | 'letter' | 'custom';
export type PrintOrientation = 'portrait' | 'landscape';
export type PrintDpi = 96 | 150 | 300;
export type PrintExportFormat = 'png' | 'svg' | 'pdf';

export type PrintElement = {
  id: string;
  type: 'map' | 'title' | 'legend' | 'scalebar' | 'north_arrow' | 'text_box' | 'image' | 'overview_map';
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  fontSize?: number;
  viewport?: Viewport;
  scale?: number;
  src?: string;
  layers?: string[];
};

export interface PrintLayout {
  id: string;
  name: string;
  paperSize: string;
  orientation: string;
  dpi: number;
  elements: PrintElement[];
}

// ── Tool types ─────────────────────────────────────
export type MapTool =
  | 'select' | 'pan' | 'identify'
  | 'edit' | 'edit_vertices' | 'add_vertex' | 'delete_vertex'
  | 'draw_polygon' | 'draw_point' | 'draw_line'
  | 'split' | 'snap'
  | 'measure_distance' | 'measure_area'
  | 'select_rectangle' | 'select_polygon';

// ── Re-exports from GeoJSON ────────────────────────
export type { Geometry, Position, FeatureCollection, GeoFeature };
