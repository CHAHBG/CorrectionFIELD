// =====================================================
//  FieldCorrect Web — Workspace Selection UI
// =====================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { orgsApi, type Organization } from '@/infra/api/organizations.api';
import { useProjectStore } from '@/stores/projectStore';

export function WorkspaceSelector() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [error, setError] = useState('');

    // Creation state
    const [isCreating, setIsCreating] = useState(false);
    const [newOrgName, setNewOrgName] = useState('');

    const setActiveOrganization = useProjectStore(s => s.setActiveOrganization);

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

    if (loading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="w-full max-w-3xl">
                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Bienvenue sur FieldCorrect</h1>
                    <p className="mt-3 text-lg text-slate-500">Sélectionnez votre espace de travail pour continuer</p>
                </div>

                {error && (
                    <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-600 border border-red-200">
                        {error}
                    </div>
                )}

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {orgs.map((org) => (
                        <button
                            key={org.id}
                            onClick={() => handleSelect(org)}
                            className="group relative flex h-40 flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:border-blue-500 hover:shadow-md hover:ring-1 hover:ring-blue-500 focus:outline-none"
                        >
                            <div>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 font-bold text-blue-700">
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
                    <div className="flex h-40 flex-col justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-transparent p-6 text-center transition-colors hover:border-slate-400 hover:bg-slate-50">
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
