// =====================================================
//  FieldCorrect Web — Workspace Selection UI
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { orgsApi, type Organization } from '@/infra/api/organizations.api';
import { useProjectStore } from '@/stores/projectStore';
import { supabase } from '@/infra/supabase';

export function WorkspaceSelector() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [error, setError] = useState('');

    // Creation state
    const [isCreating, setIsCreating] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');

    const { setActiveOrganization, currentUser, logout } = useProjectStore();

    useEffect(() => {
        loadOrganizations();
    }, []);

    const loadOrganizations = async () => {
        setLoading(true);
        try {
            const data = await orgsApi.getMyOrganizations();
            setOrgs(data);
        } catch (err: any) {
            setError(err.message || 'Impossible de charger vos espaces de travail.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (org: Organization) => {
        setActiveOrganization(org);
        navigate(`/${org.slug}/projects`);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!newOrgName.trim()) return;

        // Generate slug from name
        const slug = newOrgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        try {
            setIsCreating(true);
            const newOrg = await orgsApi.createOrganization(newOrgName, slug);
            handleSelect(newOrg);
        } catch (err: any) {
            setError(err.message || 'Erreur lors de la création de l\'organisation.');
            setIsCreating(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        await supabase.auth.signOut();
        navigate('/login'); // We should check if login route exists or let auth listener handle it
    };

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-screen flex-col items-center bg-slate-50">
            {/* Global Header */}
            <header className="w-full border-b border-slate-200 bg-white shadow-sm">
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-sm font-bold text-white shadow-sm">
                            FC
                        </div>
                        <span className="text-xl font-bold tracking-tight text-slate-800">FieldCorrect</span>
                    </div>

                    <div className="flex items-center gap-6">
                        {currentUser && (
                            <div className="hidden items-center gap-3 md:flex border-r border-slate-200 pr-6">
                                <div className="flex flex-col text-right">
                                    <span className="text-sm font-semibold text-slate-700">{currentUser.full_name || 'Utilisateur'}</span>
                                    <span className="text-xs text-slate-500">{currentUser.email}</span>
                                </div>
                            </div>
                        )}
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

            <div className="mt-16 w-full max-w-4xl px-6">
                <div className="mb-12 text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Vos Espaces de Travail</h1>
                    <p className="mt-4 text-lg text-slate-500">Sélectionnez une organisation pour accéder à vos projets</p>
                </div>

                {error && (
                    <div className="mb-8 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-200 shadow-sm text-center">
                        {error}
                    </div>
                )}

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {orgs.map((org) => (
                        <button
                            key={org.id}
                            onClick={() => handleSelect(org)}
                            className="group relative flex h-44 flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-blue-500 hover:shadow-md focus:outline-none"
                        >
                            <div className="relative z-10 w-full">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded border border-slate-100 bg-slate-50 font-bold text-slate-700">
                                        {org.name.charAt(0).toUpperCase()}
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-900">{org.name}</h3>
                                </div>
                            </div>

                            <div className="flex items-center justify-between mt-4">
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 capitalize">
                                    {org.role === 'owner' ? 'Propriétaire' : org.role}
                                </span>
                                <span className="text-blue-600 opacity-0 transition-opacity group-hover:opacity-100">
                                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                    </svg>
                                </span>
                            </div>
                        </button>
                    ))}

                    {/* Create New Org Card */}
                    <div className="relative flex h-44 flex-col justify-center rounded-xl border-2 border-dashed border-slate-300 bg-transparent p-6 text-center transition-all hover:border-slate-400 hover:bg-slate-50">
                        {!isCreating ? (
                            <button
                                onClick={() => setIsCreating(true)}
                                className="flex h-full w-full flex-col items-center justify-center focus:outline-none"
                            >
                                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <span className="text-sm font-medium text-slate-700">Créer une organisation</span>
                            </button>
                        ) : (
                            <form onSubmit={handleCreate} className="flex h-full flex-col justify-center gap-2">
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Nom de l'entreprise"
                                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    value={newOrgName}
                                    onChange={(e) => setNewOrgName(e.target.value)}
                                    required
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreating(false)}
                                        className="flex-1 rounded-md border border-slate-300 bg-white py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 rounded-md bg-blue-600 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                                    >
                                        Créer
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
