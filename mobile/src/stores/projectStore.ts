// =====================================================
//  FieldCorrect Mobile — Project / Auth Store (Zustand)
// =====================================================

import { create } from 'zustand';
import { Project, UserProfile, MemberRole } from '@/types';
import { supabase } from '@/infra/supabase';
import { Session } from '@supabase/supabase-js';

interface ProjectState {
  session: Session | null;
  user: UserProfile | null;
  currentProject: Project | null;
  projects: Project[];
  isAuthenticated: boolean;
  loading: boolean;

  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setProject: (project: Project) => void;
  fetchProjects: () => Promise<void>;
  skipAuth: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  session: null,
  user: null,
  currentProject: null,
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
          set({ session: null, user: null, isAuthenticated: false, currentProject: null });
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
    set({ session: null, user: null, currentProject: null, isAuthenticated: false });
  },

  setProject: (project) => set({ currentProject: project }),

  fetchProjects: async () => {
    const { user } = get();
    if (!user) {return;}
    try {
      const { data } = await supabase
        .from('projects')
        .select('*, project_members!inner(user_id, role)')
        .eq('project_members.user_id', user.id)
        .order('created_at', { ascending: false });

      const projects: Project[] = (data ?? []).map((p: any) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        description: p.description,
        settings: p.settings ?? {},
        created_at: p.created_at,
        updated_at: p.updated_at ?? p.created_at,
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
