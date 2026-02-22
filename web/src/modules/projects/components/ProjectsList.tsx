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
import { LogOut, Plus, User, Map } from 'lucide-react';

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
    <div className="min-h-screen bg-[#F8F5F2]">
      {/* Minimalist Header */}
      <header className="sticky top-0 z-10 w-full border-b border-[#E5E0D8] bg-white">
        <div className="flex w-full items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 font-bold text-slate-900 transition-colors hover:text-blue-600"
            >
              <Map className="h-6 w-6 text-blue-600" strokeWidth={2.5} />
              <span className="text-xl leading-none tracking-tight">FieldCorrect</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-6 text-sm font-medium md:flex mr-4">
              <span className="text-slate-900 cursor-default border-b-2 border-blue-600 pb-1">Projets</span>
              <span className="text-slate-400 hover:text-slate-600 cursor-not-allowed transition-colors" title="Bientôt disponible">Équipe</span>
              <span className="text-slate-400 hover:text-slate-600 cursor-not-allowed transition-colors" title="Bientôt disponible">Paramètres</span>
            </nav>

            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <button
                onClick={handleLogout}
                className="group flex p-2 text-slate-400 transition-colors hover:text-red-600 hover:bg-red-50 rounded"
                title="Se déconnecter"
              >
                <LogOut className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
                  {currentUser?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className="text-sm font-semibold text-slate-700 hidden md:block">
                  {currentUser?.full_name?.split(' ')[0] || 'Utilisateur'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-8 py-10">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-1">Projets</h1>
            <p className="text-sm font-medium text-slate-500">{activeOrganization.name}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-blue-700 active:scale-95"
          >
            <Plus className="h-4 w-4" strokeWidth={3} /> NOUVEAU PROJET
          </button>
        </div>

        {/* Search */}
        <div className="mb-8 max-w-sm">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 shadow-sm transition-colors"
            />
          </div>
        </div>

        {/* Projects grid */}
        {filtered.length === 0 ? (
          <div className="flex max-w-md flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-transparent p-12 text-center transition-colors hover:bg-white hover:border-slate-400 cursor-pointer" onClick={() => setShowCreate(true)}>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
              <Plus className="h-6 w-6" />
            </div>
            <h3 className="mt-4 font-semibold text-slate-500">Nouveau projet</h3>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

            <button
              onClick={() => setShowCreate(true)}
              className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-transparent p-6 text-center transition-colors hover:bg-white hover:border-slate-300 group"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Plus className="h-6 w-6" />
              </div>
              <span className="mt-4 font-semibold text-slate-500 group-hover:text-slate-900 transition-colors">Nouveau projet</span>
            </button>
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
      className="group flex flex-col cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md hover:border-blue-600 min-h-[220px]"
    >
      {/* Map Placeholder Image/Gradient */}
      <div className="relative h-32 w-full bg-[#F5F8FA] overflow-hidden border-b border-slate-100">
        <div className="absolute inset-0 opacity-30 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNDQkQ1RTEiLz48L3N2Zz4=')]"></div>
        {/* Placeholder Abstract Shapes */}
        <div className="absolute top-4 left-6 h-12 w-16 rotate-6 rounded border border-blue-400/50 bg-blue-300/20"></div>
        <div className="absolute top-2 left-24 h-14 w-12 -rotate-3 rounded border border-green-500/50 bg-green-400/20"></div>
        <div className="absolute top-10 right-8 h-10 w-20 rotate-1 rounded border border-orange-400/50 bg-orange-300/20"></div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-2 right-2 rounded bg-white p-1.5 text-slate-400 shadow-sm opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
          title="Supprimer le projet"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <h3 className="font-bold text-slate-900 leading-tight mb-1">{project.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {project.slug} • {new Date(project.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div className="flex gap-4">
            <div>
              <div className="text-sm font-bold text-blue-600">0</div>
              <div className="text-[9px] font-bold tracking-widest text-[#8C7E6A] uppercase">Features</div>
            </div>
            <div>
              <div className="text-sm font-bold text-green-600">0%</div>
              <div className="text-[9px] font-bold tracking-widest text-[#8C7E6A] uppercase">Complété</div>
            </div>
          </div>
          {/* Members badge removed as requested (none in project) */}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold text-slate-900">Nouveau Projet</h2>
        <p className="mb-4 text-sm text-slate-500">
          Créez un projet pour organiser vos couches et corrections.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Nom *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug(autoSlug(e.target.value));
              }}
              placeholder="Ex: PROCASEF Boundou"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors shadow-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Identifiant (slug)</label>
            <input
              type="text"
              value={slug || autoSlug(name)}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="procasef-boundou"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors shadow-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description du projet…"
              rows={3}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition-colors shadow-sm"
            />
          </div>

          {createProject.error && (
            <p className="text-sm font-medium text-red-600 bg-red-50 p-2 rounded-md border border-red-100">
              {(createProject.error as Error).message}
            </p>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createProject.isPending}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {createProject.isPending ? 'Création…' : 'Créer le projet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
