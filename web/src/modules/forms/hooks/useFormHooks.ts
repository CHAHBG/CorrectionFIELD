// =====================================================
//  FieldCorrect — Form hooks (mode, submission)
// =====================================================

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { correctionsApi } from '@/infra/api/corrections.api';
import { featuresApi } from '@/infra/api/features.api';
import { db } from '@/infra/db/schema';
import { useProjectStore } from '@/stores/projectStore';
import type { AppFeature, Layer, CorrectionStatus } from '@/shared/types';

// ━━ Form mode hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
type FormMode = 'native' | 'enketo' | 'kobo';

export function useFormMode() {
  const [mode, setMode] = useState<FormMode>('native');
  return { mode, setMode } as const;
}

// ━━ Submission hook ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface SubmitPayload {
  feature: AppFeature;
  layer: Layer;
  changedProps: Record<string, unknown>;
  changedGeometry?: GeoJSON.Geometry;
  comment?: string;
}

export function useSubmission() {
  const queryClient = useQueryClient();
  const { currentUser } = useProjectStore();

  return useMutation({
    mutationFn: async (payload: SubmitPayload) => {
      const { feature, changedProps, changedGeometry, comment } = payload;
      const isOnline = navigator.onLine;

      const correction = {
        feature_id: feature.id,
        corrector_id: currentUser?.id ?? '',
        old_props: feature.props,
        new_props: { ...feature.props, ...changedProps },
        old_geom: changedGeometry ? feature.geom : null,
        new_geom: changedGeometry ?? null,
        comment: comment ?? '',
        status: 'submitted' as CorrectionStatus,
      };

      if (isOnline) {
        // Submit via API
        await correctionsApi.submit(correction);
        // Update feature status
        await featuresApi.updateStatus(feature.id, 'pending');
        // Apply property changes
        if (Object.keys(changedProps).length > 0) {
          await featuresApi.updateProps(feature.id, { ...feature.props, ...changedProps });
        }
        // Apply geometry changes
        if (changedGeometry) {
          await featuresApi.updateGeometry(feature.id, changedGeometry);
        }
      } else {
        // Offline: enqueue
        await db.syncQueue.add({
          op: 'INSERT',
          entityType: 'correction',
          entityId: feature.id,
          payload: correction,
          createdAt: new Date().toISOString(),
          attempts: 0,
        });
        // Update local feature
        await db.features.update(feature.id, {
          status: 'pending',
          props: { ...feature.props, ...changedProps },
          ...(changedGeometry ? { geometry: changedGeometry } : {}),
          _dirty: true,
        });
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['features', variables.layer.id] });
      queryClient.invalidateQueries({ queryKey: ['corrections', variables.feature.id] });
    },
  });
}
