// =====================================================
//  FieldCorrect — Export Panel
// =====================================================

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Spinner } from '@/shared/ui/components';
import { exportApi } from '@/infra/api/export.api';
import { useLayerStore } from '@/stores/layerStore';

type ExportFormat = 'geojson' | 'gpkg' | 'shapefile' | 'csv' | 'kml';

const FORMATS: { value: ExportFormat; label: string; ext: string }[] = [
  { value: 'geojson', label: 'GeoJSON', ext: '.geojson' },
  { value: 'gpkg', label: 'GeoPackage', ext: '.gpkg' },
  { value: 'shapefile', label: 'Shapefile (ZIP)', ext: '.zip' },
  { value: 'csv', label: 'CSV', ext: '.csv' },
  { value: 'kml', label: 'KML', ext: '.kml' },
];

export function ExportPanel({ onClose }: { onClose: () => void }) {
  const { layers } = useLayerStore();
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [format, setFormat] = useState<ExportFormat>('geojson');
  const [crs, setCrs] = useState('EPSG:4326');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const downloadMutation = useMutation({
    mutationFn: async () => {
      const blob = await exportApi.download({
        layer_ids: selectedLayers,
        format,
        crs,
        filter_status: filterStatus === 'all' ? undefined : filterStatus,
      });

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = FORMATS.find((f) => f.value === format)?.ext ?? '';
      a.download = `export_${new Date().toISOString().slice(0, 10)}${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const toggleLayer = (id: string) => {
    setSelectedLayers((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Exporter des données</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="space-y-4 p-6">
          {/* Layer selection */}
          <div>
            <label className="text-sm font-medium text-gray-700">Couches à exporter</label>
            <div className="mt-1 max-h-40 overflow-y-auto space-y-1">
              {layers.map((layer) => (
                <label key={layer.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 rounded p-1">
                  <input
                    type="checkbox"
                    checked={selectedLayers.includes(layer.id)}
                    onChange={() => toggleLayer(layer.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  {layer.name}
                </label>
              ))}
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-sm font-medium text-gray-700">Format</label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
            >
              {FORMATS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* CRS */}
          <div>
            <label className="text-sm font-medium text-gray-700">Système de coordonnées</label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
              value={crs}
              onChange={(e) => setCrs(e.target.value)}
            >
              <option value="EPSG:4326">WGS 84 (EPSG:4326)</option>
              <option value="EPSG:32628">UTM Zone 28N (EPSG:32628)</option>
              <option value="EPSG:32629">UTM Zone 29N (EPSG:32629)</option>
            </select>
          </div>

          {/* Status filter */}
          <div>
            <label className="text-sm font-medium text-gray-700">Filtrer par statut</label>
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Tous les statuts</option>
              <option value="validated">Validé uniquement</option>
              <option value="corrected">Corrigé</option>
              <option value="pending">En attente</option>
              <option value="draft">Brouillon</option>
            </select>
          </div>

          {downloadMutation.isError && (
            <div className="rounded bg-red-50 p-3 text-sm text-red-600">
              {downloadMutation.error instanceof Error
                ? downloadMutation.error.message
                : "Erreur lors de l'export"}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button
            disabled={selectedLayers.length === 0 || downloadMutation.isPending}
            onClick={() => downloadMutation.mutate()}
          >
            {downloadMutation.isPending ? <Spinner className="mr-2" /> : null}
            Télécharger
          </Button>
        </div>
      </div>
    </div>
  );
}
