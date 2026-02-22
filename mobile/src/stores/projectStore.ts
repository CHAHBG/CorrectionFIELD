// =====================================================
//  FieldCorrect Mobile — Project / Auth Store (Zustand)
// =====================================================

import { create } from 'zustand';
import { Project, UserProfile, MemberRole, Organization } from '@/types';
import { supabase } from '@/infra/supabase';
import { Session } from '@supabase/supabase-js';

interface ProjectState {
  session: Session | null;
  user: UserProfile | null;
  activeOrganization: Organization | null;
  currentProject: Project | null;
  currentRole: MemberRole | null;
  organizations: Organization[];
  projects: Project[];
  isAuthenticated: boolean;
  loading: boolean;

  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setOrganization: (org: Organization | null) => void;
  setProject: (project: Project) => void;
  fetchOrganizations: () => Promise<void>;
  fetchProjects: () => Promise<void>;
  skipAuth: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  session: null,
  user: null,
  activeOrganization: null,
  currentProject: null,
  currentRole: null,
  organizations: [],
  projects: [],
  isAuthenticated: false,
  loading: true,

  init: async () => {
    set({ loading: true });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const user = await fetchProfile(session.user.id);
        set({ session, user, isAuthenticated: true, loading: false });
      } else {
        set({ loading: false });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        if (nextSession) {
          const user = await fetchProfile(nextSession.user.id);
          set({ session: nextSession, user, isAuthenticated: true });
        } else {
          set({ session: null, user: null, isAuthenticated: false, currentProject: null, activeOrganization: null });
        }
      });
    } catch (e) {
      console.error('[ProjectStore] init', e);
      set({ loading: false });
    }
  },

  login: async (email, password) => {
    set({ loading: true });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ loading: false });
      throw error;
    }
    const user = await fetchProfile(data.user.id);
    set({ session: data.session, user, isAuthenticated: true, loading: false });
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, currentProject: null, currentRole: null, activeOrganization: null, isAuthenticated: false });
  },

  setOrganization: (org) => {
    set({ activeOrganization: org, currentProject: null, currentRole: null });
    if (org) get().fetchProjects();
  },

  setProject: (project) => set({ currentProject: project, currentRole: project.role ?? 'viewer' }),

  fetchOrganizations: async () => {
    const { user } = get();
    if (!user || user.id === 'offline') return;

    try {
      const { data, error } = await supabase
        .from('org_members')
        .select(`
          role,
          organizations ( id, slug, name, billing_plan )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      const orgs: Organization[] = (data || []).map((row: any) => ({
        id: row.organizations.id,
        slug: row.organizations.slug,
        name: row.organizations.name,
        billing_plan: row.organizations.billing_plan,
        role: row.role,
      }));
      set({ organizations: orgs });
    } catch (e) {
      console.error('[ProjectStore] fetchOrganizations', e);
    }
  },

  fetchProjects: async () => {
    const { user, activeOrganization } = get();
    if (!user || user.id === 'offline' || !activeOrganization) { return; }
    try {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .eq('org_id', activeOrganization.id)
        .order('created_at', { ascending: false });

      const projects: Project[] = (data ?? []).map((p: any) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        settings: p.settings ?? {},
        created_at: p.created_at,
        updated_at: p.updated_at ?? p.created_at,
        role: activeOrganization.role as MemberRole, // Inherit role from organization in V2
      }));
      set({ projects });
    } catch (e) {
      console.error('[ProjectStore] fetchProjects', e);
    }
  },

  skipAuth: () => {
    set({
      isAuthenticated: true,
      loading: false,
      user: {
        id: 'offline',
        email: 'offline@local',
        full_name: 'Mode hors-ligne',
        role: 'editor',
      },
    });
  },
}));

/* ---------- helpers ---------- */

async function fetchProfile(userId: string): Promise<UserProfile> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (data) {
    return {
      id: data.id,
      email: data.email,
      full_name: data.full_name ?? '',
      role: (data.role as MemberRole) ?? 'viewer',
      avatar_url: data.avatar_url,
    };
  }

  // Fallback profile from auth metadata
  const { data: { user } } = await supabase.auth.getUser();
  return {
    id: userId,
    email: user?.email ?? '',
    full_name: '',
    role: 'viewer',
  };
}
