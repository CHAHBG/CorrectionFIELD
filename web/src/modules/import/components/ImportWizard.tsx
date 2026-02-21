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
  const [parseResults, setParseResults] = useState<ParseResult[]>([]);
  const [layerNames, setLayerNames] = useState<string[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [csvOptions, setCsvOptions] = useState({ latCol: 'latitude', lngCol: 'longitude' });
  const [error, setError] = useState<string | null>(null);
  const [fileTypes, setFileTypes] = useState<string[]>([]);

  // Upload step
  const handleFiles = useCallback(async (files: File[]) => {
    setError(null);

    try {
      const parsed: ParseResult[] = [];
      const errors: string[] = [];
      const exts: string[] = [];

      for (const file of files) {
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        exts.push(ext);

        try {
          if (ext === 'geojson' || ext === 'json') {
            parsed.push(await parseGeoJson(file));
          } else if (ext === 'gpkg') {
            parsed.push(await parseGpkg(file));
          } else if (ext === 'csv' || ext === 'tsv') {
            parsed.push(await parseCsvGeo(file, csvOptions));
          } else {
            errors.push(`${file.name}: format non supporté (.${ext})`);
          }
        } catch (e) {
          errors.push(`${file.name}: ${e instanceof Error ? e.message : 'Erreur de parsing'}`);
        }
      }

      if (parsed.length === 0) {
        throw new Error(errors.join('\n'));
      }

      setFileTypes(exts);
      setParseResults(parsed);
      setLayerNames(parsed.map((p) => p.name));
      setActivePreviewIndex(0);
      setStep('configure');

      if (errors.length > 0) {
        setError(`Fichiers ignorés:\n${errors.join('\n')}`);
      }
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
              onFiles={handleFiles}
              csvOptions={csvOptions}
              setCsvOptions={setCsvOptions}
              hasCsv={fileTypes.some((t) => t === 'csv' || t === 'tsv')}
              error={error}
            />
          )}
          {step === 'configure' && parseResults.length > 0 && (
            <ConfigureStep
              results={parseResults}
              layerNames={layerNames}
              setLayerNameAt={(index, name) => {
                setLayerNames((current) => {
                  const next = [...current];
                  next[index] = name;
                  return next;
                });
              }}
              onBack={() => setStep('upload')}
              onNext={() => setStep('preview')}
            />
          )}
          {step === 'preview' && parseResults.length > 0 && (
            <PreviewStep
              results={parseResults}
              layerNames={layerNames}
              activeIndex={activePreviewIndex}
              setActiveIndex={setActivePreviewIndex}
              onBack={() => setStep('configure')}
              onImport={() => setStep('importing')}
            />
          )}
          {step === 'importing' && parseResults.length > 0 && (
            <ImportingStep
              results={parseResults}
              layerNames={layerNames}
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
  onFiles,
  csvOptions,
  setCsvOptions,
  hasCsv,
  error,
}: {
  onFiles: (f: File[]) => void;
  csvOptions: { latCol: string; lngCol: string };
  setCsvOptions: (o: { latCol: string; lngCol: string }) => void;
  hasCsv: boolean;
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
          const files = Array.from(e.dataTransfer.files ?? []);
          if (files.length > 0) onFiles(files);
        }}
      >
        <p className="text-3xl mb-2">📂</p>
        <p className="text-sm text-gray-600">Glisser-déposer un ou plusieurs fichiers ici</p>
        <p className="text-xs text-gray-400 mb-4">.geojson, .gpkg, .csv</p>
        <label className="cursor-pointer">
          <span className="inline-flex h-8 items-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Parcourir…
          </span>
          <input
            type="file"
            multiple
            accept=".geojson,.json,.gpkg,.csv,.tsv"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) onFiles(files);
            }}
          />
        </label>
      </div>

      {/* CSV options */}
      {hasCsv && (
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
        <div className="rounded bg-red-50 p-3 text-sm text-red-600 whitespace-pre-line">{error}</div>
      )}
    </div>
  );
}

function ConfigureStep({
  results,
  layerNames,
  setLayerNameAt,
  onBack,
  onNext,
}: {
  results: ParseResult[];
  layerNames: string[];
  setLayerNameAt: (index: number, n: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const totalFeatures = results.reduce((acc, result) => acc + result.features.length, 0);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700">Configuration des couches</h3>

      <div className="max-h-44 overflow-y-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left text-gray-500">
              <th className="px-2 py-2">Couche</th>
              <th className="px-2 py-2">Géométrie</th>
              <th className="px-2 py-2">Features</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr key={`${result.name}-${index}`} className="border-t">
                <td className="px-2 py-2 min-w-[220px]">
                  <Input
                    value={layerNames[index] ?? ''}
                    onChange={(e) => setLayerNameAt(index, e.target.value)}
                  />
                </td>
                <td className="px-2 py-2">{result.geometryType}</td>
                <td className="px-2 py-2">{result.features.length.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-50 rounded p-3">
          <span className="text-gray-500">Couches</span>
          <p className="font-medium">{results.length}</p>
        </div>
        <div className="bg-gray-50 rounded p-3">
          <span className="text-gray-500">Total features</span>
          <p className="font-medium">{totalFeatures.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 rounded p-3">
          <span className="text-gray-500">Attributs max</span>
          <p className="font-medium">{Math.max(...results.map((r) => r.fields.length))}</p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>← Retour</Button>
        <Button onClick={onNext}>Aperçu →</Button>
      </div>
    </div>
  );
}

function PreviewStep({
  results,
  layerNames,
  activeIndex,
  setActiveIndex,
  onBack,
  onImport,
}: {
  results: ParseResult[];
  layerNames: string[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onBack: () => void;
  onImport: () => void;
}) {
  const result = results[activeIndex];
  const layerName = layerNames[activeIndex] ?? result.name;
  const preview = result.features.slice(0, 5);
  const totalFeatures = results.reduce((acc, item) => acc + item.features.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700">Couche à prévisualiser</label>
        <select
          className="mt-1 w-full rounded border border-gray-300 px-2 py-2 text-sm"
          value={activeIndex}
          onChange={(e) => setActiveIndex(Number(e.target.value))}
        >
          {results.map((item, index) => (
            <option key={`${item.name}-${index}`} value={index}>
              {layerNames[index] ?? item.name} ({item.features.length.toLocaleString()} features)
            </option>
          ))}
        </select>
      </div>

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
        <strong>{results.length}</strong> couche(s) — {totalFeatures.toLocaleString()} features au total
        <br />
        Aperçu actuel: <strong>{layerName}</strong> ({result.features.length.toLocaleString()} features, {result.fields.length} attributs, géométrie {result.geometryType})
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>← Retour</Button>
        <Button onClick={onImport}>Importer</Button>
      </div>
    </div>
  );
}

function ImportingStep({
  results,
  layerNames,
  onClose,
}: {
  results: ParseResult[];
  layerNames: string[];
  onClose: () => void;
}) {
  const { currentProject } = useProjectStore();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(0);
  const [currentLayer, setCurrentLayer] = useState('');

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject) throw new Error('Aucun projet actif');

      const BATCH_SIZE = 500;
      const totalFeatures = results.reduce((acc, result) => acc + result.features.length, 0);
      let importedFeatures = 0;

      for (let layerIndex = 0; layerIndex < results.length; layerIndex++) {
        const result = results[layerIndex];
        const layerName = layerNames[layerIndex] ?? result.name;
        setCurrentLayer(layerName);

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

        for (let i = 0; i < result.features.length; i += BATCH_SIZE) {
          const batch = result.features.slice(i, i + BATCH_SIZE).map((f) => ({
            layerId: layer.id,
            geom: f.geometry,
            props: (f.properties ?? {}) as Record<string, unknown>,
            status: 'draft' as FeatureStatus,
          }));

          await featuresApi.bulkInsert(batch);
          importedFeatures += batch.length;
          setProgress(Math.min(100, Math.round((importedFeatures / Math.max(1, totalFeatures)) * 100)));
        }
      }

      return { layers: results.length, features: totalFeatures };
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
          {currentLayer && <p className="text-xs text-gray-500">Couche en cours: {currentLayer}</p>}
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
            <strong>{results.length}</strong> couche(s) importée(s) avec{' '}
            {results.reduce((acc, result) => acc + result.features.length, 0).toLocaleString()} features
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
