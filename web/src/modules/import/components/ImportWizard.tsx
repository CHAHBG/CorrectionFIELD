// =====================================================
//  FieldCorrect — Import Wizard (step-by-step data import)
// =====================================================

import { useState, useCallback, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input, Spinner } from '@/shared/ui/components';
import { parseGeoJson, parseCsvGeo, parseGpkg, type ParseResult } from '../parsers';
import { layersApi } from '@/infra/api/layers.api';
import { featuresApi } from '@/infra/api/features.api';
import { useProjectStore } from '@/stores/projectStore';
import type { FeatureStatus } from '@/shared/types';

type Step = 'upload' | 'configure' | 'preview' | 'importing';

export function ImportWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('upload');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [layerName, setLayerName] = useState('');
  const [csvOptions, setCsvOptions] = useState({ latCol: 'latitude', lngCol: 'longitude' });
  const [error, setError] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string>('');

  // Upload step
  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    setFileType(ext);

    try {
      let result: ParseResult;

      if (ext === 'geojson' || ext === 'json') {
        result = await parseGeoJson(file);
      } else if (ext === 'gpkg') {
        result = await parseGpkg(file);
      } else if (ext === 'csv' || ext === 'tsv') {
        result = await parseCsvGeo(file, csvOptions);
      } else {
        throw new Error(`Format non supporté : .${ext}. Utilisez .geojson, .gpkg ou .csv`);
      }

      setParseResult(result);
      setLayerName(result.name);
      setStep('configure');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur lors du parsing');
    }
  }, [csvOptions]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Importer des données</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {/* Steps indicator */}
        <div className="flex gap-1 px-6 pt-4">
          {(['upload', 'configure', 'preview', 'importing'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded ${
                i <= (['upload', 'configure', 'preview', 'importing'].indexOf(step))
                  ? 'bg-blue-500'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-6 min-h-[300px]">
          {step === 'upload' && (
            <UploadStep
              onFile={handleFile}
              csvOptions={csvOptions}
              setCsvOptions={setCsvOptions}
              fileType={fileType}
              error={error}
            />
          )}
          {step === 'configure' && parseResult && (
            <ConfigureStep
              result={parseResult}
              layerName={layerName}
              setLayerName={setLayerName}
              onBack={() => setStep('upload')}
              onNext={() => setStep('preview')}
            />
          )}
          {step === 'preview' && parseResult && (
            <PreviewStep
              result={parseResult}
              layerName={layerName}
              onBack={() => setStep('configure')}
              onImport={() => setStep('importing')}
            />
          )}
          {step === 'importing' && parseResult && (
            <ImportingStep
              result={parseResult}
              layerName={layerName}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step components ─────────────────────────────────

function UploadStep({
  onFile,
  csvOptions,
  setCsvOptions,
  fileType,
  error,
}: {
  onFile: (f: File) => void;
  csvOptions: { latCol: string; lngCol: string };
  setCsvOptions: (o: { latCol: string; lngCol: string }) => void;
  fileType: string;
  error: string | null;
}) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="space-y-4">
      <div
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition ${
          dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        <p className="text-3xl mb-2">📂</p>
        <p className="text-sm text-gray-600">Glisser-déposer un fichier ici</p>
        <p className="text-xs text-gray-400 mb-4">.geojson, .gpkg, .csv</p>
        <label className="cursor-pointer">
          <span className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Parcourir…
          </span>
          <input
            type="file"
            accept=".geojson,.json,.gpkg,.csv,.tsv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
            }}
          />
        </label>
      </div>

      {/* CSV options */}
      {(fileType === 'csv' || fileType === 'tsv') && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500">Colonne latitude</label>
            <Input
              value={csvOptions.latCol}
              onChange={(e) => setCsvOptions({ ...csvOptions, latCol: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Colonne longitude</label>
            <Input
              value={csvOptions.lngCol}
              onChange={(e) => setCsvOptions({ ...csvOptions, lngCol: e.target.value })}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}
    </div>
  );
}

function ConfigureStep({
  result,
  layerName,
  setLayerName,
  onBack,
  onNext,
}: {
  result: ParseResult;
  layerName: string;
  setLayerName: (n: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700">Nom de la couche</label>
        <Input value={layerName} onChange={(e) => setLayerName(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-50 rounded p-3">
          <span className="text-gray-500">Type de géométrie</span>
          <p className="font-medium">{result.geometryType}</p>
        </div>
        <div className="bg-gray-50 rounded p-3">
          <span className="text-gray-500">Features</span>
          <p className="font-medium">{result.features.length.toLocaleString()}</p>
        </div>
        {result.crs && (
          <div className="bg-gray-50 rounded p-3">
            <span className="text-gray-500">CRS</span>
            <p className="font-medium">{result.crs}</p>
          </div>
        )}
        <div className="bg-gray-50 rounded p-3">
          <span className="text-gray-500">Attributs</span>
          <p className="font-medium">{result.fields.length}</p>
        </div>
      </div>

      <div className="max-h-40 overflow-y-auto text-xs">
        <table className="w-full">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="pb-1">Champ</th>
              <th className="pb-1">Type</th>
              <th className="pb-1">Requis</th>
            </tr>
          </thead>
          <tbody>
            {result.fields.map((f) => (
              <tr key={f.name} className="border-t">
                <td className="py-1">{f.label ?? f.name}</td>
                <td className="py-1 text-gray-500">{f.type}</td>
                <td className="py-1">{f.required ? '✓' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>← Retour</Button>
        <Button onClick={onNext}>Aperçu →</Button>
      </div>
    </div>
  );
}

function PreviewStep({
  result,
  layerName,
  onBack,
  onImport,
}: {
  result: ParseResult;
  layerName: string;
  onBack: () => void;
  onImport: () => void;
}) {
  const preview = result.features.slice(0, 5);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Aperçu (5 premières features)</h3>

      <div className="max-h-48 overflow-auto rounded border text-xs">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left">#</th>
              {result.fields.slice(0, 6).map((f) => (
                <th key={f.name} className="px-2 py-1 text-left">{f.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.map((feat, i) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1 text-gray-400">{i + 1}</td>
                {result.fields.slice(0, 6).map((f) => (
                  <td key={f.name} className="px-2 py-1 max-w-[120px] truncate">
                    {String(feat.properties?.[f.name] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded bg-blue-50 p-3 text-sm text-blue-800">
        <strong>{layerName}</strong> — {result.features.length.toLocaleString()} features,{' '}
        {result.fields.length} attributs, géométrie {result.geometryType}
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>← Retour</Button>
        <Button onClick={onImport}>Importer</Button>
      </div>
    </div>
  );
}

function ImportingStep({
  result,
  layerName,
  onClose,
}: {
  result: ParseResult;
  layerName: string;
  onClose: () => void;
}) {
  const { currentProject } = useProjectStore();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject) throw new Error('Aucun projet actif');

      // 1. Create the layer
      const layer = await layersApi.create({
        projectId: currentProject.id,
        name: layerName,
        geometryType: result.geometryType,
        sourceCrs: result.crs ?? 'EPSG:4326',
        fields: result.fields,
        style: {
          mode: 'simple',
          simple: {
            fillColor: '#3b82f6',
            fillOpacity: 0.4,
            strokeColor: '#1d4ed8',
            strokeWidth: 1.5,
            strokeOpacity: 1,
          },
        },
      });

      // 2. Insert features in batches
      const BATCH_SIZE = 500;
      const total = result.features.length;

      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = result.features.slice(i, i + BATCH_SIZE).map((f) => ({
          layerId: layer.id,
          geom: f.geometry,
          props: (f.properties ?? {}) as Record<string, unknown>,
          status: 'draft' as FeatureStatus,
        }));

        await featuresApi.bulkInsert(batch);
        setProgress(Math.min(100, Math.round(((i + BATCH_SIZE) / total) * 100)));
      }

      return layer;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['layers'] });
    },
  });

  // Auto-start import
  useEffect(() => {
    importMutation.mutate();
  }, [importMutation]);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-8">
      {importMutation.isPending && (
        <>
          <Spinner />
          <p className="text-sm text-gray-600">Import en cours… {progress}%</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 rounded-full h-2 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}

      {importMutation.isSuccess && (
        <>
          <p className="text-4xl">✅</p>
          <p className="text-sm text-gray-600">
            <strong>{layerName}</strong> importé avec{' '}
            {result.features.length.toLocaleString()} features
          </p>
          <Button onClick={onClose}>Fermer</Button>
        </>
      )}

      {importMutation.isError && (
        <>
          <p className="text-4xl">❌</p>
          <p className="text-sm text-red-600">
            {importMutation.error instanceof Error
              ? importMutation.error.message
              : "Erreur lors de l'import"}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Fermer</Button>
            <Button onClick={() => importMutation.mutate()}>Réessayer</Button>
          </div>
        </>
      )}
    </div>
  );
}
