// =====================================================
//  FieldCorrect Web — Projects List Page
//  v2: Multi-project support with create/select
// =====================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects, useCreateProject, useDeleteProject } from '../hooks/useProjects';
import { useProjectStore } from '@/stores/projectStore';
import type { Project } from '@/shared/types';

export function ProjectsList() {
  const navigate = useNavigate();
  const { setCurrentProject } = useProjectStore();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = (projects ?? []).filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const selectProject = (project: Project) => {
    setCurrentProject(project);
    navigate(`/project/${project.id}`);
  };

  if (isLoading) {
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">FieldCorrect</h1>
            <p className="text-sm text-gray-500">Plateforme de correction géospatiale</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <span>+</span> Nouveau projet
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
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
      className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 transition-all hover:border-blue-300 hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-lg">
          🌍
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded p-1 text-gray-400 opacity-0 hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
          title="Supprimer"
        >
          ✕
        </button>
      </div>
      <h3 className="font-semibold text-gray-900">{project.name}</h3>
      {project.description && (
        <p className="mt-1 line-clamp-2 text-sm text-gray-500">{project.description}</p>
      )}
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <span>{project.slug}</span>
        <span>·</span>
        <span>{new Date(project.createdAt).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
  );
}

/* ─── Create Modal ─── */

function CreateProjectModal({
  onClose,
  onCreated,
  createProject,
}: {
  onClose: () => void;
  onCreated: (p: Project) => void;
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
