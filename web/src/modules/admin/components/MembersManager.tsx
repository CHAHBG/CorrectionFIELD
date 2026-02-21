// =====================================================
//  FieldCorrect — Members Manager
// =====================================================

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@/shared/ui/components';
import { supabase } from '@/infra/supabase';
import { useProjectStore } from '@/stores/projectStore';
import type { ProjectMember, MemberRole } from '@/shared/types';

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  supervisor: 'Superviseur',
  corrector: 'Correcteur',
  editor: 'Éditeur',
  viewer: 'Lecteur',
};

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-yellow-100 text-yellow-700',
  admin: 'bg-red-100 text-red-700',
  supervisor: 'bg-purple-100 text-purple-700',
  corrector: 'bg-blue-100 text-blue-700',
  editor: 'bg-green-100 text-green-700',
  viewer: 'bg-gray-100 text-gray-700',
};

export function MembersManager() {
  const { currentProject } = useProjectStore();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('corrector');

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', currentProject?.id],
    queryFn: async () => {
      if (!currentProject) return [];
      const { data, error } = await supabase
        .from('project_members')
        .select('*, profile:user_id(id, email, full_name, avatar_url)')
        .eq('project_id', currentProject.id)
        .order('role');
      if (error) throw error;
      return data as (ProjectMember & { profile: { email: string; full_name: string; avatar_url: string } })[];
    },
    enabled: !!currentProject,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject || !email) return;
      // Look up user by email
      const { data: user } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();
      if (!user) throw new Error('Utilisateur introuvable');

      const { error } = await supabase
        .from('project_members')
        .insert({
          project_id: currentProject.id,
          user_id: user.id,
          role,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: MemberRole }) => {
      const { error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
  });

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-lg font-semibold">Membres du projet</h2>

      {/* Invite form */}
      <div className="flex gap-2">
        <Input
          placeholder="Email de l'utilisateur"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1"
        />
        <select
          className="rounded-md border border-gray-300 px-2 text-sm"
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
        >
          {(Object.entries(ROLE_LABELS) as [MemberRole, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Button
          onClick={() => inviteMutation.mutate()}
          disabled={!email || inviteMutation.isPending}
        >
          Inviter
        </Button>
      </div>

      {inviteMutation.isError && (
        <p className="text-sm text-red-600">
          {inviteMutation.error instanceof Error ? inviteMutation.error.message : 'Erreur'}
        </p>
      )}

      {/* Members list */}
      <div className="space-y-2">
        {isLoading && <p className="text-sm text-gray-500">Chargement…</p>}
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                {(m.profile?.full_name ?? m.profile?.email)?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="text-sm font-medium">{m.profile?.full_name ?? 'Sans nom'}</p>
                <p className="text-xs text-gray-400">{m.profile?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[m.role]}`}
                value={m.role}
                onChange={(e) =>
                  updateRoleMutation.mutate({ memberId: m.id, newRole: e.target.value as MemberRole })
                }
              >
                {(Object.entries(ROLE_LABELS) as [MemberRole, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <button
                className="text-gray-400 hover:text-red-500 text-sm"
                onClick={() => {
                  if (confirm('Retirer ce membre ?')) removeMutation.mutate(m.id);
                }}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
