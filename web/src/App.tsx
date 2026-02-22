// =====================================================
//  FieldCorrect — Root App with layout & routing
// =====================================================

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MapCanvas } from '@/modules/map/components/MapCanvas';
import { LayerPanel } from '@/modules/layers/components/LayerPanel';
import { SymbologyEditor } from '@/modules/layers/components/SymbologyEditor';
import { AttributeTable } from '@/modules/layers/AttributeTable/AttributeTable';
import { CorrectionPanel } from '@/modules/corrections/components/CorrectionPanel';
import { ImportWizard } from '@/modules/import/components/ImportWizard';
import { ExportPanel } from '@/modules/export/components/ExportPanel';
import { PrintLayoutDesigner } from '@/modules/export/components/PrintLayout';
import { ProjectSettingsPanel } from '@/modules/admin/components/ProjectSettings';
import { MembersManager } from '@/modules/admin/components/MembersManager';
import { SyncDashboard } from '@/modules/admin/components/SyncDashboard';
import { ProjectsList } from '@/modules/projects/components/ProjectsList';
import { WorkspaceSelector } from '@/modules/admin/components/WorkspaceSelector';
import { useProjects } from '@/modules/projects/hooks/useProjects';
import { useLayers } from '@/modules/layers/hooks/useLayers';

import { useMapStore } from '@/stores/mapStore';
import { useLayerStore } from '@/stores/layerStore';
import { useProjectStore } from '@/stores/projectStore';
import { supabase } from '@/infra/supabase';
import { syncEngine } from '@/infra/sync/SyncEngine';
import { layersApi } from '@/infra/api/layers.api';
import type { Layer, LayerStyle } from '@/shared/types';
import { LogOut, Download, Upload, Printer, Settings, Users, RefreshCw, Layers } from 'lucide-react';
import './index.css';

// ── QueryClient singleton ───────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      gcTime: 1000 * 60 * 10,  // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Auth wrapper ────────────────────────────────────
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setCurrentUser } = useProjectStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUser({
          id: session.user.id,
          email: session.user.email ?? '',
          full_name: session.user.user_metadata?.full_name ?? '',
          avatar_url: session.user.user_metadata?.avatar_url,
        });
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setCurrentUser({
          id: session.user.id,
          email: session.user.email ?? '',
          full_name: session.user.user_metadata?.full_name ?? '',
          avatar_url: session.user.user_metadata?.avatar_url,
        });
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setCurrentUser]);

  // Start sync engine
  useEffect(() => {
    syncEngine.start();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-gray-500">Chargement de FieldCorrect…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
}

// ── Login page ──────────────────────────────────────
function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingAction, setLoadingAction] = useState<'login' | 'signup' | null>(null);

  const isSignup = mode === 'signup';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoadingAction('login');
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!fullName.trim() || !email || !password || !confirmPassword) {
      setError('Nom complet, email et mots de passe sont requis');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    setLoadingAction('signup');
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (authError) throw authError;

      const isExistingUser =
        data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0;
      if (isExistingUser) {
        setError('Un compte existe déjà avec cet email. Connectez-vous.');
        return;
      }

      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setSuccess('Compte créé. Vérifiez votre email pour confirmer votre compte.');
          return;
        }
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: user.id,
              email,
              full_name: fullName.trim(),
            },
            { onConflict: 'id' },
          );

        if (profileError) {
          throw profileError;
        }
      }

      setSuccess('Compte créé et enregistré avec succès.');
      setMode('login');
      setConfirmPassword('');
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création de compte');
    } finally {
      setLoadingAction(null);
    }
  };

  const switchMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setError('');
    setSuccess('');
    if (nextMode === 'login') {
      setConfirmPassword('');
    }
  };

  return (
    <div className="flex min-h-screen w-screen bg-white text-slate-900">

      {/* Left Area - Brand & Visual */}
      <div className="hidden w-1/2 flex-col justify-between bg-[#FAF9F6] p-12 lg:flex border-r border-[#EFECE5]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-sm font-bold text-white shadow-lg shadow-green-600/20">
            FC
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">FieldCorrect</span>
        </div>

        <div className="z-10 relative">
          <h1 className="text-5xl font-extrabold leading-tight text-slate-900">
            Corriger <br />
            les données <br />
            <span className="text-blue-600">terrain</span> ensemble
          </h1>
          <p className="mt-6 max-w-md text-slate-600 text-lg">
            Plateforme de correction collaborative de données géospatiales. Multi-utilisateur, offline-first, intégration Kobo/ODK native.
          </p>
        </div>

        <div className="flex items-end gap-12 border-t border-[#EFECE5] pt-8">
          <div>
            <div className="text-3xl font-bold text-green-600">2 924</div>
            <div className="mt-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">Parcelles</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-blue-600">17</div>
            <div className="mt-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">Communes</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-green-600">68%</div>
            <div className="mt-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">Complété</div>
          </div>
        </div>
      </div>

      {/* Right Area - Form */}
      <div className="flex w-full flex-col justify-center px-8 sm:px-16 lg:w-1/2 xl:px-32 bg-white">
        <div className="mx-auto w-full max-w-md">
          {/* Mobile Header (hidden on desktop) */}
          <div className="mb-12 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-600 text-sm font-bold text-white shadow-lg shadow-green-600/20">
              FC
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">FieldCorrect</span>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${mode === 'login' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'
                }`}
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`rounded-md py-2 text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-900'
                }`}
            >
              Créer un compte
            </button>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">
              {isSignup ? 'Créer un compte' : 'Bon retour'}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {isSignup ? 'Rejoignez votre équipe sur le terrain' : 'Connectez-vous à votre espace de travail'}
            </p>
          </div>

          <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-4">
            {isSignup && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Nom complet</label>
                <input
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm"
                  placeholder="Ex : Oumar Diallo"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Adresse email</label>
              <input
                type="email"
                autoComplete="username email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm"
                placeholder="exemple@email.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Mot de passe</label>
              <input
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {isSignup && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Confirmer le mot de passe</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors shadow-sm"
                  placeholder="••••••••"
                  required
                />
              </div>
            )}

            {error && <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-600 border border-red-100">{error}</div>}
            {success && <div className="rounded-lg bg-green-50 p-4 text-sm font-medium text-green-600 border border-green-100">{success}</div>}

            <button
              type="submit"
              disabled={!!loadingAction}
              className="mt-8 flex w-full items-center justify-center rounded-lg bg-blue-600 py-3.5 font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] disabled:opacity-70 shadow-md shadow-blue-600/20"
            >
              {loadingAction ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>Traitement...</span>
                </div>
              ) : (
                <>{isSignup ? 'Créer mon compte' : 'Se connecter'}</>
              )}
            </button>

            {!isSignup && (
              <>
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-4 text-xs font-medium text-slate-500">ou continuer avec</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                >
                  <Layers className="h-5 w-5 text-blue-600" />
                  Connexion SSO Organisation
                </button>
              </>
            )}

          </form>
        </div>
      </div>
    </div>
  );
}

// ── Header bar ──────────────────────────────────────
function HeaderBar({
  onImport,
  onExport,
  onPrint,
  onSettings,
  onMembers,
  onSync,
}: {
  onImport: () => void;
  onExport: () => void;
  onPrint: () => void;
  onSettings: () => void;
  onMembers: () => void;
  onSync: () => void;
}) {
  const { currentProject, activeOrganization, currentUser, logout } = useProjectStore();

  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    await supabase.auth.signOut();
  };

  return (
    <header className="flex h-14 w-full items-center justify-between border-b border-[#EBEAE4] bg-[#FAF9F6] px-6">
      <div className="flex items-center gap-4 text-sm">
        <button onClick={() => navigate('/projects')} className="flex items-center gap-2 font-bold text-slate-900 transition-colors hover:text-blue-600">
          <Layers className="h-4 w-4" />
          FieldCorrect
        </button>
        {currentProject && (
          <div className="flex items-center gap-2 font-medium text-slate-500">
            <span className="text-slate-300">/</span>
            <span className="cursor-pointer hover:text-slate-800 transition-colors" onClick={() => navigate('/projects')}>{activeOrganization?.name}</span>
            <span className="text-slate-300">/</span>
            <span className="font-bold text-slate-900">{currentProject.name}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <OnlineIndicator />
        <div className="mx-2 h-5 w-px bg-slate-200" />

        <HeaderButton onClick={onImport} icon={<Upload className="h-4 w-4" />} label="Importer" />
        <HeaderButton onClick={onExport} icon={<Download className="h-4 w-4" />} label="Exporter" />
        <div className="mx-2 h-5 w-px bg-slate-200" />
        <HeaderButton onClick={onPrint} icon={<Printer className="h-4 w-4" />} label="Imprimer" />
        <HeaderButton onClick={onSettings} icon={<Settings className="h-4 w-4" />} />
        <HeaderButton onClick={onMembers} icon={<Users className="h-4 w-4" />} />
        <HeaderButton onClick={onSync} icon={<RefreshCw className="h-4 w-4" />} />

        <div className="mx-2 h-5 w-px bg-slate-200" />
        <div className="flex items-center gap-2 pl-2">
          {currentUser && (
            <div className="flex flex-col items-end mr-2">
              <span className="text-xs font-bold text-slate-800">{currentUser.full_name || 'U'}</span>
              <span className="text-[10px] text-slate-500">{currentUser.email}</span>
            </div>
          )}
          {currentUser && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-sm cursor-pointer hover:bg-blue-700 transition-colors" title={currentUser.full_name || currentUser.email}>
              {currentUser.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center justify-center rounded p-1.5 ml-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            title="Se déconnecter"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function HeaderButton({ onClick, icon, label }: { onClick: () => void; icon: React.ReactNode; label?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200/50 hover:text-slate-900 ${label ? 'min-w-fit' : 'w-8 h-8 px-0'}`}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

function OnlineIndicator() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-1 border border-slate-200" title={online ? 'En ligne' : 'Hors ligne'}>
      <div className={`h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'} shadow-[0_0_8px_rgba(34,197,94,0.4)]`} />
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
        {online ? 'En ligne' : 'Hors ligne'}
      </span>
    </div>
  );
}

// ── Main layout ─────────────────────────────────────
function MainLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const { currentProject, setCurrentProject, activeOrganization } = useProjectStore();
  const { data: projects } = useProjects(activeOrganization?.id);
  useLayers(currentProject?.id);
  const updateLayerInStore = useLayerStore((s) => s.updateLayer);
  const { layerPanelOpen, attributeTableOpen, identifiedFeature } = useMapStore();
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [symbologyLayer, setSymbologyLayer] = useState<Layer | null>(null);

  useEffect(() => {
    if (!projectId || !projects || projects.length === 0) return;

    const matched = projects.find((p) => p.id === projectId) ?? null;
    if (matched && currentProject?.id !== matched.id) {
      setCurrentProject(matched);
    }
  }, [projectId, projects, currentProject?.id, setCurrentProject]);

  const handleSymbologySave = async (style: LayerStyle) => {
    if (!symbologyLayer) return;
    updateLayerInStore(symbologyLayer.id, { style });
    await layersApi.update(symbologyLayer.id, { style });
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <HeaderBar
        onImport={() => setImportOpen(true)}
        onExport={() => setExportOpen(true)}
        onPrint={() => setPrintOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onMembers={() => setMembersOpen(true)}
        onSync={() => setSyncOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Layer Panel */}
        {layerPanelOpen && (
          <div className="w-72 flex-shrink-0 overflow-y-auto border-r bg-white">
            <LayerPanel onOpenSymbology={(layer) => setSymbologyLayer(layer)} />
          </div>
        )}

        {/* Center: Map + Attribute Table */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="relative flex-1">
            <MapCanvas />
          </div>
          {attributeTableOpen && (
            <div className="h-72 flex-shrink-0 border-t bg-white overflow-hidden">
              <AttributeTable />
            </div>
          )}
        </div>

        {/* Right: Correction Panel */}
        {identifiedFeature && (
          <div className="w-80 flex-shrink-0 overflow-y-auto border-l bg-white">
            <CorrectionPanel />
          </div>
        )}
      </div>

      {/* Modals */}
      {importOpen && <ImportWizard onClose={() => setImportOpen(false)} />}
      {exportOpen && <ExportPanel onClose={() => setExportOpen(false)} />}
      {printOpen && <PrintLayoutDesigner onClose={() => setPrintOpen(false)} />}
      {settingsOpen && (
        <Modal onClose={() => setSettingsOpen(false)}>
          <ProjectSettingsPanel onClose={() => setSettingsOpen(false)} />
        </Modal>
      )}
      {membersOpen && (
        <Modal onClose={() => setMembersOpen(false)}>
          <MembersManager />
        </Modal>
      )}
      {syncOpen && (
        <Modal onClose={() => setSyncOpen(false)}>
          <SyncDashboard />
        </Modal>
      )}

      {symbologyLayer && (
        <SymbologyEditor
          layer={symbologyLayer}
          onClose={() => setSymbologyLayer(null)}
          onSave={handleSymbologySave}
        />
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ── Root App ────────────────────────────────────────
function App() {
  const { activeOrganization } = useProjectStore();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          <Routes>
            <Route path="/" element={<WorkspaceSelector />} />

            {/* Must have an active organization to see projects */}
            <Route
              path="/:orgSlug/projects"
              element={activeOrganization ? <ProjectsList /> : <Navigate to="/" replace />}
            />

            <Route
              path="/:orgSlug/project/:projectId"
              element={activeOrganization ? <MainLayout /> : <Navigate to="/" replace />}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
