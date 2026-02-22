// =====================================================
//  FieldCorrect — Import Wizard (step-by-step data import)
// =====================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Input, Spinner } from '@/shared/ui/components';
import { parseGeoJson, parseCsvGeo, parseGpkg, type ParseResult } from '../parsers';
import { layersApi } from '@/infra/api/layers.api';
import { featuresApi } from '@/infra/api/features.api';
import { useProjectStore } from '@/stores/projectStore';
import { useLayerStore } from '@/stores/layerStore';
import { reprojectFeatureCollection } from '@/shared/utils/crs';
import type { FeatureStatus } from '@/shared/types';

type Step = 'upload' | 'configure' | 'preview' | 'importing';

export function ImportWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('upload');
  const [parseResults, setParseResults] = useState<ParseResult[]>([]);
  const [configs, setConfigs] = useState<{ name: string; crs: string }[]>([]);
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
      setConfigs(parsed.map(p => ({
        name: p.name,
        crs: p.crs ?? 'EPSG:4326'
      })));
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
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
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
              className={`h-1 flex-1 rounded ${i <= (['upload', 'configure', 'preview', 'importing'].indexOf(step))
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
              configs={configs}
              setConfigs={setConfigs}
              onBack={() => setStep('upload')}
              onNext={() => setStep('preview')}
            />
          )}
          {step === 'preview' && parseResults.length > 0 && (
            <PreviewStep
              results={parseResults}
              configs={configs}
              activeIndex={activePreviewIndex}
              setActiveIndex={setActivePreviewIndex}
              onBack={() => setStep('configure')}
              onImport={() => setStep('importing')}
            />
          )}
          {step === 'importing' && parseResults.length > 0 && (
            <ImportingStep
              results={parseResults}
              configs={configs}
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
        className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
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

const COMMON_CRSS = [
  { value: 'EPSG:4326', label: 'WGS 84 (GPS)' },
  { value: 'EPSG:32628', label: 'UTM Zone 28N' },
  { value: 'EPSG:32629', label: 'UTM Zone 29N' },
  { value: 'EPSG:3857', label: 'Web Mercator' },
];

function ConfigureStep({
  results,
  configs,
  setConfigs,
  onBack,
  onNext,
}: {
  results: ParseResult[];
  configs: { name: string; crs: string }[];
  setConfigs: React.Dispatch<React.SetStateAction<{ name: string; crs: string }[]>>;
  onBack: () => void;
  onNext: () => void;
}) {
  const totalFeatures = results.reduce((acc, result) => acc + result.features.length, 0);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-700">Configuration des couches</h3>

      <div className="max-h-60 overflow-y-auto rounded border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr className="text-left text-gray-500">
              <th className="px-2 py-2">Nom de la couche</th>
              <th className="px-2 py-2">Projection (CRS)</th>
              <th className="px-2 py-2">Features</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => (
              <tr key={`${result.name}-${index}`} className="border-t">
                <td className="px-2 py-2 min-w-[200px]">
                  <Input
                    value={configs[index]?.name ?? ''}
                    onChange={(e) => {
                      const next = [...configs];
                      next[index] = { ...next[index], name: e.target.value };
                      setConfigs(next);
                    }}
                  />
                </td>
                <td className="px-2 py-2">
                  <select
                    className="w-full rounded border border-gray-300 px-1 py-1 text-xs"
                    value={configs[index]?.crs ?? 'EPSG:4326'}
                    onChange={(e) => {
                      const next = [...configs];
                      next[index] = { ...next[index], crs: e.target.value };
                      setConfigs(next);
                    }}
                  >
                    {COMMON_CRSS.map(crs => (
                      <option key={crs.value} value={crs.value}>{crs.label}</option>
                    ))}
                    {configs[index] && !COMMON_CRSS.find(c => c.value === configs[index].crs) && (
                      <option value={configs[index].crs}>{configs[index].crs}</option>
                    )}
                  </select>
                </td>
                <td className="px-2 py-2 text-gray-500 whitespace-nowrap">
                  {result.geometryType} ({result.features.length.toLocaleString()})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-3 gap-4 text-xs">
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

      <div className="rounded bg-amber-50 p-2 text-[11px] text-amber-700">
        📌 <strong>Conseil :</strong> Si vos données s'affichent au mauvais endroit (ex: coordonnées &gt; 180), changez la projection vers <strong>UTM Zone 28N</strong>.
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
  configs,
  activeIndex,
  setActiveIndex,
  onBack,
  onImport,
}: {
  results: ParseResult[];
  configs: { name: string; crs: string }[];
  activeIndex: number;
  setActiveIndex: (index: number) => void;
  onBack: () => void;
  onImport: () => void;
}) {
  const result = results[activeIndex];
  const config = configs[activeIndex];
  const layerName = config?.name ?? result.name;
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
              {configs[index]?.name ?? item.name} ({item.features.length.toLocaleString()} features)
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
  configs,
  onClose,
}: {
  results: ParseResult[];
  configs: { name: string; crs: string }[];
  onClose: () => void;
}) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const addLayer = useLayerStore((s) => s.addLayer);
  const queryClient = useQueryClient();
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);
  const [progress, setProgress] = useState(0);
  const [currentLayer, setCurrentLayer] = useState('');
  const [currentStep, setCurrentStep] = useState('Préparation de l\'import…');
  const [status, setStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const hasStarted = useRef(false);

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`${label} trop lente (> ${Math.round(ms / 1000)}s). Réessayez avec moins de fichiers.`));
          }, ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const runImport = useCallback(async () => {
    if (!currentProject) throw new Error('Aucun projet actif');

    const BATCH_SIZE = 50;
    const REQUEST_TIMEOUT_MS = 45000;
    const totalFeatures = results.reduce((acc, result) => acc + result.features.length, 0);
    let importedFeatures = 0;

    if (totalFeatures === 0) {
      throw new Error('Aucune feature détectée dans les fichiers sélectionnés');
    }

    for (let layerIndex = 0; layerIndex < results.length; layerIndex++) {
      const result = results[layerIndex];
      const config = configs[layerIndex];
      const layerName = config?.name ?? result.name;
      const sourceCrs = config?.crs ?? 'EPSG:4326';
      setCurrentLayer(layerName);
      setCurrentStep(`Création de la couche ${layerIndex + 1}/${results.length}…`);

      const layer = await withTimeout(layersApi.create({
        projectId: currentProject.id,
        name: layerName,
        geometryType: result.geometryType,
        sourceCrs,
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
      }), REQUEST_TIMEOUT_MS, `Création de couche (${layerName})`);

      addLayer(layer);

      setProgress(Math.max(1, Math.round((importedFeatures / totalFeatures) * 100)));

      let featuresForInsert = result.features;
      if (sourceCrs !== 'EPSG:4326') {
        try {
          featuresForInsert = reprojectFeatureCollection(
            { type: 'FeatureCollection', features: result.features },
            sourceCrs,
            'EPSG:4326'
          ).features;
        } catch (e) {
          console.error('[ImportingStep] Reprojection failed', e);
          throw new Error(`Impossible de reprojeter ${layerName} depuis ${sourceCrs} vers EPSG:4326. Vérifiez que la projection est enregistrée.`);
        }
      }

      for (let i = 0; i < featuresForInsert.length; i += BATCH_SIZE) {
        setCurrentStep(
          `Import batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(featuresForInsert.length / BATCH_SIZE)} (${layerIndex + 1}/${results.length})`
        );

        const batch = featuresForInsert.slice(i, i + BATCH_SIZE).map((f) => ({
          layerId: layer.id,
          geom: f.geometry,
          props: (f.properties ?? {}) as Record<string, unknown>,
          status: 'draft' as FeatureStatus,
        }));

        await withTimeout(featuresApi.bulkInsert(batch), REQUEST_TIMEOUT_MS, `Import features (${layerName})`);
        importedFeatures += batch.length;
        setProgress(Math.min(100, Math.round((importedFeatures / Math.max(1, totalFeatures)) * 100)));
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    setCurrentStep('Finalisation…');
    await Promise.race([
      queryClient.invalidateQueries({ queryKey: ['layers'] }),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);
  }, [addLayer, currentProject, configs, queryClient, results]);

  useEffect(() => {
    // Only start if not already started (or if it's a retry)
    if (hasStarted.current && attempt === 0) {
      console.log('[ImportingStep] Effect re-run detected, ignoring since already started.');
      return;
    }

    console.log('[ImportingStep] Starting/Restarting import process (attempt:', attempt, ')');
    hasStarted.current = true;

    // Initialize state
    setStatus('pending');
    setErrorMessage(null);
    setProgress(0);
    setCurrentLayer('');
    setCurrentStep('Préparation de l\'import…');

    runImport()
      .then(() => {
        if (isMounted.current) {
          console.log('[ImportingStep] Import finished successfully');
          setStatus('success');
        } else {
          console.warn('[ImportingStep] Import finished but component was unmounted');
        }
      })
      .catch((error: unknown) => {
        if (!isMounted.current) {
          console.warn('[ImportingStep] Import failed but component was unmounted', error);
          return;
        }
        console.error('[ImportingStep] Import failed:', error);
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : "Erreur lors de l'import");
      });

    return () => {
      console.log('[ImportingStep] Cleaning up effect');
    };
  }, [attempt, runImport]);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 py-8">
      {status === 'pending' && (
        <>
          <Spinner />
          <p className="text-sm text-gray-600">Import en cours… {progress}%</p>
          {currentLayer && <p className="text-xs text-gray-500">Couche en cours: {currentLayer}</p>}
          <p className="text-xs text-gray-400">{currentStep}</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 rounded-full h-2 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </>
      )}

      {status === 'success' && (
        <>
          <p className="text-4xl">✅</p>
          <p className="text-sm text-gray-600">
            <strong>{results.length}</strong> couche(s) importée(s) avec{' '}
            {results.reduce((acc, result) => acc + result.features.length, 0).toLocaleString()} features
          </p>
          <Button onClick={onClose}>Fermer</Button>
        </>
      )}

      {status === 'error' && (
        <>
          <p className="text-4xl">❌</p>
          <p className="text-sm text-red-600">{errorMessage ?? "Erreur lors de l'import"}</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Fermer</Button>
            <Button
              onClick={() => {
                setAttempt((value) => value + 1);
              }}
            >
              Réessayer
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
