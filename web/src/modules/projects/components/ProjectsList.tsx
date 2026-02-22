// =====================================================
//  FieldCorrect Web — Projects List Page
//  v2: Multi-project support with create/select
// =====================================================

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjects, useCreateProject, useDeleteProject } from '../hooks/useProjects';
import { useProjectStore } from '@/stores/projectStore';
import type { Project } from '@/shared/types';
import { supabase } from '@/infra/supabase';
import { User, LogOut, FolderOpen, Folder } from 'lucide-react';

export function ProjectsList() {
  const navigate = useNavigate();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { setCurrentProject, activeOrganization, currentUser, logout } = useProjectStore();

  // We need the orgId to fetch projects
  const orgId = activeOrganization?.id;
  const { data: projects, isLoading } = useProjects(orgId);
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const handleLogout = async () => {
    await logout();
    await supabase.auth.signOut();
    navigate('/');
  };

  const filtered = (projects ?? []).filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const selectProject = (project: Project) => {
    setCurrentProject(project);
    navigate(`/${orgSlug}/project/${project.id}`);
  };

  if (isLoading || !activeOrganization) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-gray-500">Chargement des projets…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Premium Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">

          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-blue-600 text-white shadow-sm">
              <span className="text-lg font-bold">{activeOrganization.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-blue-600">{activeOrganization.name}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-inset ring-slate-200">
                  {activeOrganization.role}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Espace de Projets</h1>
                <button
                  onClick={() => navigate('/')}
                  className="mt-1 text-sm font-medium text-slate-400 transition-colors hover:text-blue-600"
                >
                  Changer d'organisation &rarr;
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden items-center gap-3 md:flex border-r border-slate-200 pr-6">
              <div className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-500">
                <User className="h-4 w-4" />
              </div>
              <div className="flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-700">{currentUser?.full_name || 'Utilisateur'}</span>
                <span className="text-xs text-slate-500">{currentUser?.email}</span>
              </div>
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
            >
              <span>+</span> Nouveau projet
            </button>
            <button
              onClick={handleLogout}
              className="group flex items-center justify-center rounded p-2 text-slate-400 border border-transparent transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-red-600"
              title="Se déconnecter"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un projet…"
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Projects grid */}
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="flex justify-center text-slate-300">
              <FolderOpen className="h-12 w-12" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-slate-800">Aucun projet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Créez un projet pour commencer à corriger des données terrain.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Créer mon premier projet
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => selectProject(project)}
                onDelete={() => {
                  if (confirm(`Supprimer le projet "${project.name}" ?`)) {
                    deleteProject.mutate(project.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create modal */}
      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={(p) => {
            setShowCreate(false);
            selectProject(p);
          }}
          orgId={activeOrganization.id}
          createProject={createProject}
        />
      )}
    </div>
  );
}

/* ─── Project Card ─── */

function ProjectCard({
  project,
  onClick,
  onDelete,
}: {
  project: Project;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-500 hover:shadow-md"
    >
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-100 bg-slate-50 text-slate-500 transition-colors group-hover:text-blue-600">
          <Folder className="h-5 w-5" />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Supprimer le projet"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="relative z-10 mt-6">
        <h3 className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{project.name}</h3>
        {project.description && (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{project.description}</p>
        )}
        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-400">
          <span className="rounded bg-slate-100 px-2 py-0.5">{project.slug}</span>
          <span>·</span>
          <span>{new Date(project.createdAt).toLocaleDateString('fr-FR')}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Create Modal ─── */

function CreateProjectModal({
  onClose,
  onCreated,
  orgId,
  createProject,
}: {
  onClose: () => void;
  onCreated: (p: Project) => void;
  orgId: string;
  createProject: ReturnType<typeof useCreateProject>;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');

  const autoSlug = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createProject.mutate(
      {
        name: name.trim(),
        slug: slug.trim() || autoSlug(name),
        org_id: orgId,
        description: description.trim() || undefined,
      },
      {
        onSuccess: (project) => onCreated(project),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-gray-900">Nouveau Projet</h2>
        <p className="mb-4 text-sm text-gray-500">
          Créez un projet pour organiser vos couches et corrections.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nom *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(autoSlug(e.target.value));
              }}
              placeholder="Ex: PROCASEF Boundou"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Identifiant (slug)</label>
            <input
              type="text"
              value={slug || autoSlug(name)}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="procasef-boundou"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du projet…"
              rows={3}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {createProject.error && (
            <p className="text-sm text-red-600">
              {(createProject.error as Error).message}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createProject.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {createProject.isPending ? 'Création…' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
