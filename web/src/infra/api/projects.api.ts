// =====================================================
//  FieldCorrect Web — Projects API client
// =====================================================

import { supabase } from '@/infra/supabase';
import type { Project, ProjectSettings } from '@/shared/types';

export const projectsApi = {
  /** Get all projects the current user is a member of */
  async getMyProjects(): Promise<Project[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('projects')
      .select(`
        *,
        project_members!inner(user_id, role)
      `)
      .eq('project_members.user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data ?? []).map(mapProject);
  },

  /** Get a single project by slug */
  async getBySlug(slug: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? mapProject(data) : null;
  },

  /** Get a single project by ID */
  async getById(id: string): Promise<Project | null> {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data ? mapProject(data) : null;
  },

  /** Create a new project */
  async create(params: {
    name: string;
    slug: string;
    description?: string;
    settings?: Partial<ProjectSettings>;
  }): Promise<Project> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: params.name,
        slug: params.slug,
        description: params.description || null,
        owner_id: user.id,
        settings: {
          default_crs: 'EPSG:4326',
          auto_lock: true,
          require_validation: false,
          offline_enabled: true,
          ...params.settings,
        },
      })
      .select()
      .single();

    if (error) throw error;

    // Add creator as admin member
    await supabase.from('project_members').insert({
      project_id: data.id,
      user_id: user.id,
      role: 'admin',
    });

    return mapProject(data);
  },

  /** Update a project */
  async update(id: string, params: Partial<{ name: string; description: string; settings: ProjectSettings }>): Promise<Project> {
    const { data, error } = await supabase
      .from('projects')
      .update(params)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapProject(data);
  },

  /** Delete a project */
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProject(row: Record<string, any>): Project {
  return {
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string | undefined,
    ownerId: row.owner_id as string,
    bbox: row.bbox,
    settings: (row.settings ?? {}) as Record<string, unknown>,
    createdAt: row.created_at as string,
    updatedAt: (row.updated_at ?? row.created_at) as string,
  };
}
