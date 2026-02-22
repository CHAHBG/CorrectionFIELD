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
    <div className="flex h-full w-[360px] flex-col bg-white border-l border-slate-200 shadow-2xl">
      {/* Premium Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5 bg-[#FAF9F6] shrink-0">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-600">
            <MapPin size={12} strokeWidth={3} /> SÉLECTION
          </span>
          <span className="text-lg font-extrabold text-slate-900 truncate tracking-tight">
            Feature {feature.id.substring(0, 8).toUpperCase()}
          </span>
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200/60 text-slate-500 transition-all hover:scale-105 hover:bg-red-50 hover:text-red-500"
          onClick={closePanel}
        >
          <X size={16} strokeWidth={2.5} />
        </button>
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
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 border border-slate-200">En attente</span>;
      case 'locked': return <span className="rounded-md bg-orange-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-orange-600 border border-orange-200">Verrouillé</span>;
      case 'corrected': return <span className="rounded-md bg-blue-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-600 border border-blue-200">Corrigé</span>;
      case 'validated': return <span className="rounded-md bg-green-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-green-600 border border-green-200">Validé</span>;
      default: return <span className="rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{status}</span>;
    }
  };

  return (
    <div className="border-b border-slate-200 bg-white px-6 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">État du flux</span>
        {getStatusBadge(feature.status)}
      </div>

      {feature.lockedBy && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-200 bg-orange-50/50 p-3 shadow-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <Lock size={14} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600">Verrouillée par</span>
            <span className="text-sm font-semibold text-slate-900">{feature.lockedBy}</span>
          </div>
        </div>
      )}

      {feature.correctedBy && (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-sm">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
            <User size={14} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Dernière correction</span>
            <span className="text-sm font-semibold text-slate-900">{feature.correctedBy}</span>
          </div>
          {feature.correctedAt && (
            <span className="text-xs font-medium text-slate-500">
              {new Date(feature.correctedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
            </span>
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
    <div className="border-b border-slate-200 px-6 py-6 bg-[#FAF9F6]">
      <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
        <FileText size={14} /> Attributs
      </h3>
      <div className="space-y-3">
        {entries.length === 0 && (
          <p className="rounded-lg border border-slate-300 border-dashed p-4 text-center text-xs text-slate-500">Aucun attribut disponible</p>
        )}
        {entries.map(([key, value]) => (
          <div key={key} className="group relative rounded-lg border border-transparent hover:border-slate-200 hover:bg-white p-2 -mx-2 transition-colors flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">{key}</span>
            <span className="text-sm font-semibold text-slate-900 break-words">
              {value != null ? String(value) : <span className="text-slate-400 italic font-medium">vide</span>}
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
    <div className="px-6 py-6 pb-20 bg-white">
      <h3 className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
        <Clock size={14} /> Historique des activités
      </h3>

      {isLoading && <div className="flex justify-center p-4"><Spinner className="h-6 w-6 text-slate-400" /></div>}

      {corrections && corrections.length === 0 && (
        <p className="rounded-lg border border-slate-200 border-dashed p-4 text-center text-xs text-slate-500">Aucune activité récente</p>
      )}

      {corrections && corrections.length > 0 && (
        <div className="relative border-l-2 border-slate-200 ml-2.5 space-y-4 pb-4">
          {corrections?.map((c) => (
            <CorrectionEntry key={c.id} correction={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function CorrectionEntry({ correction }: { correction: Correction }) {
  return (
    <div className="relative pl-6">
      <div
        className={cn(
          'absolute -left-[5px] top-1.5 h-2 w-2 rounded-full border-2 border-white ring-2 ring-white',
          correction.status === 'validated' ? 'bg-green-500 ring-green-100' :
            correction.status === 'submitted' ? 'bg-blue-500 ring-blue-100' :
              correction.status === 'rejected' ? 'bg-red-500 ring-red-100' : 'bg-slate-400'
        )}
      />
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900">{correction.userId.substring(0, 8)}</span>
          <span className="text-[10px] font-medium text-slate-500">
            {new Date(correction.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </span>
        </div>
        {correction.notes && (
          <p className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 p-2 rounded-md mt-1">{correction.notes}</p>
        )}
        {correction.propsPatch && Object.keys(correction.propsPatch).length > 0 && (
          <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-blue-600 uppercase">
            <FileText size={10} /> {Object.keys(correction.propsPatch).length} champ(s) modifié(s)
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      // 1. Get latest correction to apply
      const corrections = await correctionsApi.getByFeature(feature.id);
      const latest = corrections.find((c) => c.status === 'submitted');

      if (latest) {
        // Apply props patch
        if (latest.propsPatch) {
          const newProps = { ...feature.props, ...latest.propsPatch };
          await featuresApi.updateProps(feature.id, newProps);
        }
        // Apply geom if corrected
        if (latest.geomCorrected) {
          await featuresApi.updateGeometry(feature.id, latest.geomCorrected);
        }
        // Mark correction as validated
        await correctionsApi.validate(latest.id);
      }

      // 2. Finalize feature status
      await featuresApi.updateStatus(feature.id, 'validated');

      // Update metadata
      const { error } = await supabase
        .from('features')
        .update({
          validated_by: user.id,
          validated_at: new Date().toISOString(),
          locked_by: null,
          locked_at: null,
          lock_expires: null
        })
        .eq('id', feature.id);

      if (error) throw error;
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
    <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-5 shrink-0 shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.05)] z-10">
      {(lockMutation.error || unlockMutation.error || submitMutation.error ||
        validateMutation.error || rejectMutation.error) && (
          <p className="rounded-md bg-red-50 p-2 text-xs font-medium text-red-600 border border-red-100">
            {(lockMutation.error ?? unlockMutation.error ?? submitMutation.error ??
              validateMutation.error ?? rejectMutation.error)?.message}
          </p>
        )}
      <div className="flex gap-3">
        {feature.status === 'pending' && (
          <button
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 disabled:opacity-50"
            disabled={busy}
            onClick={() => lockMutation.mutate()}
          >
            <Lock size={14} /> Verrouiller & Corriger
          </button>
        )}
        {feature.status === 'locked' && (
          <>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
              disabled={busy}
              onClick={() => unlockMutation.mutate()}
            >
              <Unlock size={14} /> Annuler
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-3 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 active:translate-y-0 disabled:opacity-50"
              disabled={busy}
              onClick={() => submitMutation.mutate()}
            >
              <Check size={14} /> Soumettre
            </button>
          </>
        )}
        {feature.status === 'corrected' && (
          <>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-3 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-red-600 disabled:opacity-50"
              disabled={busy}
              onClick={() => rejectMutation.mutate()}
            >
              <XCircle size={14} /> Rejeter
            </button>
            <button
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-3 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-green-700 active:translate-y-0 disabled:opacity-50"
              disabled={busy}
              onClick={() => validateMutation.mutate()}
            >
              <Check size={14} /> Valider
            </button>
          </>
        )}
      </div>
    </div>
  );
}
