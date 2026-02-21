// =====================================================
//  FieldCorrect — Layers API (Supabase)
// =====================================================

import { supabase } from '@/infra/supabase';
import type { Layer } from '@/shared/types';

function snakeToLayer(row: Record<string, unknown>): Layer {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    geometryType: row.geometry_type as Layer['geometryType'],
    sourceCrs: (row.source_crs ?? 'EPSG:4326') as string,
    isReference: (row.is_reference ?? false) as boolean,
    isEditable: (row.is_editable ?? true) as boolean,
    displayOrder: (row.display_order ?? 0) as number,
    groupName: row.group_name as string | undefined,
    visible: (row.visible ?? true) as boolean,
    fields: (row.fields ?? []) as Layer['fields'],
    style: (row.style ?? { mode: 'simple' }) as Layer['style'],
    formConfig: (row.form_config ?? {}) as Layer['formConfig'],
    minZoom: (row.min_zoom ?? 0) as number,
    maxZoom: (row.max_zoom ?? 22) as number,
    createdAt: row.created_at as string,
  };
}

export const layersApi = {
  async getByProject(projectId: string): Promise<Layer[]> {
    const { data, error } = await supabase
      .from('layers')
      .select('*')
      .eq('project_id', projectId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return (data ?? []).map(snakeToLayer);
  },

  async getById(id: string): Promise<Layer | null> {
    const { data, error } = await supabase
      .from('layers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data ? snakeToLayer(data) : null;
  },

  async create(layer: Partial<Layer>): Promise<Layer> {
    const row = {
      project_id: layer.projectId,
      name: layer.name,
      description: layer.description,
      geometry_type: layer.geometryType,
      source_crs: layer.sourceCrs ?? 'EPSG:4326',
      is_reference: layer.isReference ?? false,
      is_editable: layer.isEditable ?? true,
      display_order: layer.displayOrder ?? 0,
      group_name: layer.groupName,
      visible: layer.visible ?? true,
      fields: layer.fields ?? [],
      style: layer.style ?? { mode: 'simple' },
      form_config: layer.formConfig ?? {},
      min_zoom: layer.minZoom ?? 0,
      max_zoom: layer.maxZoom ?? 22,
    };

    const { data, error } = await supabase
      .from('layers')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return snakeToLayer(data);
  },

  async update(id: string, updates: Partial<Layer>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.visible !== undefined) row.visible = updates.visible;
    if (updates.displayOrder !== undefined) row.display_order = updates.displayOrder;
    if (updates.groupName !== undefined) row.group_name = updates.groupName;
    if (updates.style !== undefined) row.style = updates.style;
    if (updates.fields !== undefined) row.fields = updates.fields;
    if (updates.formConfig !== undefined) row.form_config = updates.formConfig;

    const { error } = await supabase.from('layers').update(row).eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('layers').delete().eq('id', id);
    if (error) throw error;
  },

  async reorder(layerIds: string[]): Promise<void> {
    const updates = layerIds.map((id, i) =>
      supabase.from('layers').update({ display_order: i }).eq('id', id)
    );
    await Promise.all(updates);
  },
};
