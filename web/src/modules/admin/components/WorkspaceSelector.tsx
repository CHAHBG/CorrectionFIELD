// =====================================================
//  FieldCorrect Web — Workspace Selection UI
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { orgsApi, type Organization } from '@/infra/api/organizations.api';
import { useProjectStore } from '@/stores/projectStore';
import { supabase } from '@/infra/supabase';
import { LogOut, Plus } from 'lucide-react';

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
        <div className="flex min-h-screen w-screen flex-col items-center bg-[#FAF9F6]">
            <header className="sticky top-0 z-10 border-b border-[#EBEAE4] bg-white">
                <div className="mx-auto flex w-full items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 font-bold text-slate-900">
                            <span className="text-xl leading-none tracking-tight">FieldCorrect</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleLogout}
                            className="group flex p-2 text-slate-400 transition-colors hover:text-red-600 hover:bg-red-50 rounded"
                            title="Se déconnecter"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                        {currentUser && (
                            <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm">
                                    {currentUser.full_name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <span className="text-sm font-semibold text-slate-700 hidden md:block">
                                    {currentUser.full_name?.split(' ')[0] || 'Utilisateur'}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            <main className="mx-auto mt-12 w-full max-w-[1200px] px-8">
                <div className="mb-12">
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Vos Espaces de Travail</h1>
                    <p className="text-sm text-slate-500">Sélectionnez une organisation pour accéder à vos projets</p>
                </div>

                {error && (
                    <div className="mb-8 rounded-lg bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-200 shadow-sm">
                        {error}
                    </div>
                )}

                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {orgs.map((org) => (
                        <button
                            key={org.id}
                            onClick={() => handleSelect(org)}
                            className="group flex flex-col cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-6 text-left shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] transition-all hover:border-blue-600 hover:shadow-md min-h-[160px]"
                        >
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl font-bold text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    {org.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-1">{org.name}</h3>
                                    <span className="text-xs font-medium text-slate-500 capitalize">
                                        {org.role === 'owner' ? 'Propriétaire' : org.role}
                                    </span>
                                </div>
                            </div>
                        </button>
                    ))}

                    {/* Create New Org Card */}
                    <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-transparent p-6 text-center transition-colors hover:bg-white hover:border-slate-400">
                        {!isCreating ? (
                            <button
                                onClick={() => setIsCreating(true)}
                                className="group flex h-full w-full flex-col items-center justify-center focus:outline-none"
                            >
                                <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 shadow-sm transition-colors group-hover:bg-green-600 group-hover:text-white">
                                    <Plus className="h-6 w-6" />
                                </div>
                                <span className="font-semibold text-slate-500 group-hover:text-slate-900 transition-colors">Nouvelle organisation</span>
                            </button>
                        ) : (
                            <form onSubmit={handleCreate} className="flex h-full flex-col justify-center gap-2">
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Nom de l'entreprise"
                                    className="w-full rounded-md border border-slate-300 bg-white text-slate-900 px-3 py-2 text-sm placeholder-slate-400 focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                                    value={newOrgName}
                                    onChange={(e) => setNewOrgName(e.target.value)}
                                    required
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreating(false)}
                                        className="flex-1 rounded-md border border-slate-300 bg-white py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 rounded-md bg-green-600 py-2 text-xs font-bold text-white transition-colors hover:bg-green-700 shadow-sm"
                                    >
                                        Créer
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
