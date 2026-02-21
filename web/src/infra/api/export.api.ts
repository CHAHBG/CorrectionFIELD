// =====================================================
//  FieldCorrect — Export API client (FastAPI)
// =====================================================

const EXPORT_API_URL = import.meta.env.VITE_EXPORT_API_URL ?? 'http://localhost:8001';
const EXPORT_API_KEY = import.meta.env.VITE_EXPORT_API_KEY ?? '';

export type ExportFormat = 'geojson' | 'gpkg' | 'csv' | 'shp' | 'shapefile' | 'kml';

export interface ExportOptions {
  projectSlug?: string;
  layer_ids?: string[];
  layerId?: string;
  format: ExportFormat;
  status?: string;
  filter_status?: string;
  corrected?: boolean;
  crs?: string;
}

export const exportApi = {
  async download(options: ExportOptions): Promise<Blob> {
    const params = new URLSearchParams({
      fmt: options.format === 'shapefile' ? 'shp' : options.format,
      status: options.filter_status ?? options.status ?? 'all',
      corrected: String(options.corrected ?? true),
      crs: options.crs ?? 'EPSG:4326',
    });

    if (options.layer_ids) {
      options.layer_ids.forEach((id) => params.append('layer_id', id));
    }

    const layerId = options.layerId ?? options.layer_ids?.[0] ?? '';
    const slug = options.projectSlug ?? 'default';
    const url = `${EXPORT_API_URL}/export/${slug}/${layerId}?${params}`;

    const res = await fetch(url, {
      headers: { 'X-API-Key': EXPORT_API_KEY },
    });

    if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
    return res.blob();
  },

  getDownloadUrl(options: ExportOptions): string {
    const params = new URLSearchParams({
      fmt: options.format,
      status: options.status ?? 'all',
      corrected: String(options.corrected ?? true),
      crs: options.crs ?? 'EPSG:4326',
      api_key: EXPORT_API_KEY,
    });
    return `${EXPORT_API_URL}/export/${options.projectSlug}/${options.layerId}?${params}`;
  },
};
