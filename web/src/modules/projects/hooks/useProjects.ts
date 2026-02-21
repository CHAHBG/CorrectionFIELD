// =====================================================
//  FieldCorrect Web — Projects hooks (TanStack Query)
// =====================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from '@/infra/api/projects.api';
import type { Project, ProjectSettings } from '@/shared/types';

const PROJECTS_KEY = ['projects'];

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: () => projectsApi.getMyProjects(),
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => (id ? projectsApi.getById(id) : null),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { name: string; slug: string; description?: string; settings?: Partial<ProjectSettings> }) =>
      projectsApi.create(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...params }: { id: string; name?: string; description?: string; settings?: ProjectSettings }) =>
      projectsApi.update(id, params),
    onSuccess: (data: Project) => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['project', data.id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROJECTS_KEY });
    },
  });
}
