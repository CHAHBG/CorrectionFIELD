// =====================================================
//  FieldCorrect — Project Store (Zustand)
// =====================================================

import { create } from 'zustand';
import type { Project, UserProfile } from '@/shared/types';
import type { Organization } from '@/infra/api/organizations.api';

interface ProjectState {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;

  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;

  activeOrganization: Organization | null;
  setActiveOrganization: (org: Organization | null) => void;

  isAuthenticated: boolean;
  setAuthenticated: (v: boolean) => void;
}

export const useProjectStore = create<ProjectState>()((set) => ({
  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),

  currentUser: null,
  setCurrentUser: (user) => set({ currentUser: user, isAuthenticated: !!user }),

  activeOrganization: null,
  setActiveOrganization: (org) => set({ activeOrganization: org }),

  isAuthenticated: false,
  setAuthenticated: (v) => set({ isAuthenticated: v }),
}));
