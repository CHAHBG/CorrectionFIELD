// =====================================================
//  FieldCorrect — Correction Panel (right sidebar)
// =====================================================

import { X, Lock, Unlock, Check, XCircle, Clock, User, MapPin, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { correctionsApi } from '@/infra/api/corrections.api';
import { featuresApi } from '@/infra/api/features.api';
import { supabase } from '@/infra/supabase';
import { useMapStore } from '@/stores/mapStore';
import { Button, Badge, Spinner } from '@/shared/ui/components';
import { cn } from '@/shared/ui/cn';
import type { AppFeature, Correction } from '@/shared/types';

export function CorrectionPanel() {
  const feature = useMapStore((s) => s.identifiedFeature);
  const closePanel = useMapStore((s) => s.closeIdentifyPanel);

  if (!feature) return null;

  return (
    <div className="flex h-full w-80 flex-col bg-white border-l border-gray-200 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2 bg-gray-50 shrink-0">
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-blue-600" />
          <span className="text-sm font-semibold text-gray-800 truncate">
            Feature {feature.id.substring(0, 8)}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={closePanel}>
          <X size={14} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Status & lock */}
        <StatusSection feature={feature} />

        {/* Attributes */}
        <AttributesSection feature={feature} />

        {/* Correction history */}
        <CorrectionHistory featureId={feature.id} />
      </div>

      {/* Actions */}
      <ActionBar feature={feature} />
    </div>
  );
}

function StatusSection({ feature }: { feature: AppFeature }) {
  return (
    <div className="border-b px-3 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Status</span>
        <Badge variant={feature.status}>{feature.status}</Badge>
      </div>

      {feature.lockedBy && (
        <div className="flex items-center gap-2 rounded bg-yellow-50 p-2">
          <Lock size={12} className="text-yellow-600" />
          <span className="text-xs text-yellow-800">
            Verrouillée par <strong>{feature.lockedBy}</strong>
          </span>
        </div>
      )}

      {feature.correctedBy && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <User size={12} /> Corrigée par {feature.correctedBy}
          {feature.correctedAt && (
            <span className="ml-auto">{new Date(feature.correctedAt).toLocaleDateString()}</span>
          )}
        </div>
      )}
    </div>
  );
}

function AttributesSection({ feature }: { feature: AppFeature }) {
  const props = feature.props;
  const entries = Object.entries(props).filter(([k]) => !k.startsWith('_'));

  return (
    <div className="border-b px-3 py-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        <FileText size={12} className="inline mr-1" />
        Attributs
      </h3>
      <div className="space-y-1">
        {entries.length === 0 && (
          <p className="text-xs text-gray-400 italic">Aucun attribut</p>
        )}
        {entries.map(([key, value]) => (
          <div key={key} className="flex justify-between gap-2 text-xs py-0.5">
            <span className="font-medium text-gray-600 truncate">{key}</span>
            <span className="text-gray-800 truncate text-right max-w-[60%]">
              {value != null ? String(value) : <span className="text-gray-400 italic">null</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CorrectionHistory({ featureId }: { featureId: string }) {
  const { data: corrections, isLoading } = useQuery({
    queryKey: ['corrections', featureId],
    queryFn: () => correctionsApi.getByFeature(featureId),
    staleTime: 15_000,
  });

  return (
    <div className="px-3 py-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        <Clock size={12} className="inline mr-1" />
        Historique des corrections
      </h3>

      {isLoading && <Spinner className="py-4" />}

      {corrections && corrections.length === 0 && (
        <p className="text-xs text-gray-400 italic">Aucune correction</p>
      )}

      {corrections?.map((c) => (
        <CorrectionEntry key={c.id} correction={c} />
      ))}
    </div>
  );
}

function CorrectionEntry({ correction }: { correction: Correction }) {
  return (
    <div className="flex items-start gap-2 mb-2 p-2 rounded bg-gray-50 text-xs">
      <div
        className={cn(
          'mt-0.5 h-2 w-2 rounded-full shrink-0',
          correction.status === 'validated' && 'bg-green-500',
          correction.status === 'submitted' && 'bg-blue-500',
          correction.status === 'rejected' && 'bg-red-500'
        )}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="font-medium text-gray-700 truncate">{correction.userId.substring(0, 8)}</span>
          <span className="text-gray-400 shrink-0">
            {new Date(correction.createdAt).toLocaleDateString()}
          </span>
        </div>
        {correction.notes && (
          <p className="mt-0.5 text-gray-500 truncate">{correction.notes}</p>
        )}
        {correction.propsPatch && (
          <div className="mt-1 text-gray-500">
            {Object.keys(correction.propsPatch).length} champ(s) modifié(s)
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBar({ feature }: { feature: AppFeature }) {
  const qc = useQueryClient();
  const setIdentified = useMapStore((s) => s.openIdentifyPanel);

  const refreshFeature = async () => {
    const updated = await featuresApi.getById(feature.id);
    if (updated) setIdentified(updated);
    qc.invalidateQueries({ queryKey: ['features'] });
    qc.invalidateQueries({ queryKey: ['corrections', feature.id] });
  };

  const lockMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      const ok = await featuresApi.lockFeature(feature.id, user.id);
      if (!ok) throw new Error('Impossible de verrouiller (déjà verrouillée ?)');
    },
    onSuccess: refreshFeature,
  });

  const unlockMutation = useMutation({
    mutationFn: () => featuresApi.unlockFeature(feature.id),
    onSuccess: refreshFeature,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');
      await correctionsApi.submit({
        featureId: feature.id,
        layerId: feature.layerId,
        userId: user.id,
        propsPatch: feature.props,
        notes: 'Correction soumise',
      });
      await featuresApi.updateStatus(feature.id, 'corrected');
    },
    onSuccess: refreshFeature,
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      await featuresApi.updateStatus(feature.id, 'validated');
    },
    onSuccess: refreshFeature,
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await featuresApi.updateStatus(feature.id, 'pending');
    },
    onSuccess: refreshFeature,
  });

  const busy = lockMutation.isPending || unlockMutation.isPending ||
    submitMutation.isPending || validateMutation.isPending || rejectMutation.isPending;

  return (
    <div className="flex flex-col gap-1 border-t px-3 py-2 bg-gray-50 shrink-0">
      {(lockMutation.error || unlockMutation.error || submitMutation.error ||
        validateMutation.error || rejectMutation.error) && (
        <p className="text-xs text-red-600 mb-1">
          {(lockMutation.error ?? unlockMutation.error ?? submitMutation.error ??
            validateMutation.error ?? rejectMutation.error)?.message}
        </p>
      )}
      <div className="flex gap-2">
        {feature.status === 'pending' && (
          <Button
            size="sm"
            className="flex-1"
            disabled={busy}
            onClick={() => lockMutation.mutate()}
          >
            <Lock size={12} className="mr-1" /> Verrouiller & Corriger
          </Button>
        )}
        {feature.status === 'locked' && (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={busy}
              onClick={() => unlockMutation.mutate()}
            >
              <Unlock size={12} className="mr-1" /> Déverrouiller
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={busy}
              onClick={() => submitMutation.mutate()}
            >
              <Check size={12} className="mr-1" /> Soumettre
            </Button>
          </>
        )}
        {feature.status === 'corrected' && (
          <>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={busy}
              onClick={() => rejectMutation.mutate()}
            >
              <XCircle size={12} className="mr-1" /> Rejeter
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={busy}
              onClick={() => validateMutation.mutate()}
            >
              <Check size={12} className="mr-1" /> Valider
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
