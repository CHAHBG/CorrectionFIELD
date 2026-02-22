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
    <div className="min-h-screen bg-slate-50 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/50 via-slate-50 to-slate-100">
      {/* Premium Header */}
      <header className="sticky top-0 z-10 border-b border-slate-200/60 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">

          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md">
              <span className="text-xl font-bold">{activeOrganization.name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-indigo-600">{activeOrganization.name}</span>
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
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 outline outline-1 outline-slate-200">
                👤
              </div>
              <div className="flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-700">{currentUser?.full_name || 'Utilisateur'}</span>
                <span className="text-xs text-slate-500">{currentUser?.email}</span>
              </div>
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow hover:ring-2 hover:ring-blue-600/20 active:scale-95"
            >
              <span>+</span> Nouveau projet
            </button>
            <button
              onClick={handleLogout}
              className="group flex items-center justify-center rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              title="Se déconnecter"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
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
          <div className="rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
            <div className="text-4xl">🌍</div>
            <h3 className="mt-4 text-lg font-medium text-gray-700">Aucun projet</h3>
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
      className="group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/60 backdrop-blur-sm p-6 transition-all hover:-translate-y-1 hover:border-blue-300 hover:bg-white hover:shadow-xl hover:shadow-blue-900/5"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-xl text-blue-600 ring-1 ring-inset ring-blue-100/50 transition-colors group-hover:bg-blue-100">
          🌍
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
