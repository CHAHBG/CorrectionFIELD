// =====================================================
//  FieldCorrect — Project Settings Panel
// =====================================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@/shared/ui/components';
import { supabase } from '@/infra/supabase';
import { useProjectStore } from '@/stores/projectStore';
import type { ProjectSettings } from '@/shared/types';

export function ProjectSettingsPanel({ onClose }: { onClose: () => void }) {
  const { currentProject } = useProjectStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState(currentProject?.name ?? '');
  const [description, setDescription] = useState(currentProject?.description ?? '');
  const [settings, setSettings] = useState<ProjectSettings>(
    currentProject?.settings ?? {
      default_crs: 'EPSG:4326',
      snap_tolerance: 10,
      auto_lock: true,
      require_validation: true,
      offline_enabled: true,
      kobo_server_url: '',
    }
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject) return;
      const { error } = await supabase
        .from('projects')
        .update({ name, description, settings })
        .eq('id', currentProject.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project'] });
    },
  });

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-lg font-semibold">Paramètres du projet</h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Nom du projet</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Description</label>
          <textarea
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <hr />

        <div>
          <label className="text-sm font-medium text-gray-700">CRS par défaut</label>
          <select
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1 text-sm"
            value={settings.default_crs}
            onChange={(e) => setSettings({ ...settings, default_crs: e.target.value })}
          >
            <option value="EPSG:4326">WGS 84 (EPSG:4326)</option>
            <option value="EPSG:32628">UTM Zone 28N (EPSG:32628)</option>
            <option value="EPSG:32629">UTM Zone 29N (EPSG:32629)</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Tolérance d'accrochage (px)</label>
          <Input
            type="number"
            value={settings.snap_tolerance}
            onChange={(e) => setSettings({ ...settings, snap_tolerance: parseInt(e.target.value) || 10 })}
            className="mt-1"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.auto_lock}
              onChange={(e) => setSettings({ ...settings, auto_lock: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            Verrouillage automatique à l'édition
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.require_validation}
              onChange={(e) => setSettings({ ...settings, require_validation: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            Validation obligatoire des corrections
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.offline_enabled}
              onChange={(e) => setSettings({ ...settings, offline_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            Mode hors-ligne activé
          </label>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">URL serveur KoboToolbox</label>
          <Input
            placeholder="https://kf.kobotoolbox.org"
            value={settings.kobo_server_url ?? ''}
            onChange={(e) => setSettings({ ...settings, kobo_server_url: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Annuler</Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>

      {saveMutation.isSuccess && (
        <p className="text-sm text-green-600">✓ Paramètres enregistrés</p>
      )}
      {saveMutation.isError && (
        <p className="text-sm text-red-600">Erreur : {String(saveMutation.error)}</p>
      )}

      {/* ── Integrations Section ── */}
      <hr className="my-6 border-gray-200" />

      <div>
        <h3 className="text-md font-bold text-gray-900 mb-2">🔌 Intégrations</h3>
        <p className="text-xs text-gray-500 mb-4">
          Utilisez ces liens pour connecter des outils externes à ce projet.
        </p>

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 mb-4">
          <h4 className="text-sm font-semibold text-blue-900">Webhook KoboToolbox</h4>
          <p className="text-xs text-blue-800 mt-1 mb-2">
            Copiez cette URL dans les "Services REST" de votre formulaire Kobo pour remonter automatiquement les données vers ce projet.
          </p>
          <div className="flex bg-white border border-blue-200 rounded text-sm px-3 py-2 text-gray-700 font-mono overflow-x-auto">
            https://api.cabgn.com/webhook/kobo?project={currentProject?.id}
          </div>
        </div>

        <div className="rounded-lg border border-purple-100 bg-purple-50 p-4">
          <h4 className="text-sm font-semibold text-purple-900">QGIS Direct Connect</h4>
          <p className="text-xs text-purple-800 mt-1 mb-2">
            Ajoutez une connexion PostGIS dans QGIS avec ces identifiants pour lire les données en temps réel :
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white p-3 rounded border border-purple-200">
            <span className="text-gray-500">Hôte:</span> <span>api.cabgn.com</span>
            <span className="text-gray-500">Port:</span> <span>5432</span>
            <span className="text-gray-500">Base:</span> <span>postgres</span>
            <span className="text-gray-500">Utilisateur:</span> <span>qgis_reader</span>
            <span className="text-gray-500">Mot de passe:</span> <span>qgis_reader_2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
