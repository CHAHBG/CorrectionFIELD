// =====================================================
//  FieldCorrect — Sync Dashboard (admin monitoring)
// =====================================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/infra/supabase';
import { useProjectStore } from '@/stores/projectStore';
import { db } from '@/infra/db/schema';
import { Badge } from '@/shared/ui/components';

interface SyncStats {
  totalFeatures: number;
  totalCorrections: number;
  pendingSync: number;
  lastSyncAt: string | null;
  byStatus: Record<string, number>;
  byLayer: { layerId: string; layerName: string; count: number }[];
}

interface FeatureStatusRow {
  status: string;
  layer_id: string;
}

interface LayerRow {
  id: string;
  name: string;
}

export function SyncDashboard() {
  const { currentProject } = useProjectStore();

  // Pending local sync queue
  const { data: pendingOps = 0 } = useQuery({
    queryKey: ['sync-pending'],
    queryFn: () => db.syncQueue.count(),
    refetchInterval: 5000,
  });

  // Remote stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['sync-stats', currentProject?.id],
    queryFn: async (): Promise<SyncStats> => {
      if (!currentProject) throw new Error('No project');

      // Feature counts by status
      const { data: statusData } = await supabase
        .from('features')
        .select('status, layer_id');

      const byStatus: Record<string, number> = {};
      (statusData as FeatureStatusRow[] | null ?? []).forEach((f) => {
        byStatus[f.status] = (byStatus[f.status] ?? 0) + 1;
      });

      // Correction count
      const { count: corrCount } = await supabase
        .from('corrections')
        .select('*', { count: 'exact', head: true });

      // Layer breakdown
      const { data: layers } = await supabase
        .from('layers')
        .select('id, name')
        .eq('project_id', currentProject.id);

      const byLayer = ((layers as LayerRow[] | null) ?? []).map((l) => ({
        layerId: l.id,
        layerName: l.name,
        count: ((statusData as FeatureStatusRow[] | null) ?? []).filter((f) => f.layer_id === l.id).length,
      }));

      return {
        totalFeatures: statusData?.length ?? 0,
        totalCorrections: corrCount ?? 0,
        pendingSync: pendingOps,
        lastSyncAt: localStorage.getItem('last_sync'),
        byStatus,
        byLayer,
      };
    },
    enabled: !!currentProject,
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-lg font-semibold">Tableau de bord synchronisation</h2>

      {/* Connection status */}
      <div className="flex items-center gap-2">
        <span
          className={`h-3 w-3 rounded-full ${navigator.onLine ? 'bg-green-500' : 'bg-red-500'}`}
        />
        <span className="text-sm">
          {navigator.onLine ? 'En ligne' : 'Hors ligne'}
        </span>
        {pendingOps > 0 && (
          <Badge variant="pending" className="ml-2">
            {pendingOps} op(s) en attente
          </Badge>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Chargement des statistiques…</p>
      ) : stats ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Features" value={stats.totalFeatures} />
            <StatCard label="Corrections" value={stats.totalCorrections} />
            <StatCard label="Sync en attente" value={stats.pendingSync} highlight={stats.pendingSync > 0} />
            <StatCard
              label="Dernière sync"
              value={
                stats.lastSyncAt
                  ? new Date(stats.lastSyncAt).toLocaleTimeString('fr-FR')
                  : 'Jamais'
              }
            />
          </div>

          {/* Status breakdown */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Par statut</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} className="rounded bg-gray-50 px-3 py-2 text-center min-w-[80px]">
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs text-gray-500 capitalize">{status}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Per-layer breakdown */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Par couche</h3>
            <div className="space-y-1">
              {stats.byLayer.map((l) => (
                <div key={l.layerId} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <span>{l.layerName}</span>
                  <span className="font-medium">{l.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-amber-300 bg-amber-50' : 'bg-white'}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
