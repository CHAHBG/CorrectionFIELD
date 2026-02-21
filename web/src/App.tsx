// =====================================================
//  FieldCorrect — Root App with layout & routing
// =====================================================

import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { MapCanvas } from '@/modules/map/components/MapCanvas';
import { LayerPanel } from '@/modules/layers/components/LayerPanel';
import { AttributeTable } from '@/modules/layers/AttributeTable/AttributeTable';
import { CorrectionPanel } from '@/modules/corrections/components/CorrectionPanel';
import { ImportWizard } from '@/modules/import/components/ImportWizard';
import { ExportPanel } from '@/modules/export/components/ExportPanel';
import { PrintLayoutDesigner } from '@/modules/export/components/PrintLayout';
import { ProjectSettingsPanel } from '@/modules/admin/components/ProjectSettings';
import { MembersManager } from '@/modules/admin/components/MembersManager';
import { SyncDashboard } from '@/modules/admin/components/SyncDashboard';
import { ProjectsList } from '@/modules/projects/components/ProjectsList';

import { useMapStore } from '@/stores/mapStore';
import { useProjectStore } from '@/stores/projectStore';
import { supabase } from '@/infra/supabase';
import { syncEngine } from '@/infra/sync/SyncEngine';

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
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">FieldCorrect</h1>
          <p className="mt-1 text-sm text-gray-500">Correction collaborative de données terrain</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`rounded-md py-2 text-sm font-medium ${
              mode === 'login' ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white text-gray-700'
            }`}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`rounded-md py-2 text-sm font-medium ${
              mode === 'signup' ? 'bg-blue-600 text-white' : 'border border-gray-300 bg-white text-gray-700'
            }`}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-4">
          {isSignup && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Nom complet</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              required
            />
          </div>

          {isSignup && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirmer le mot de passe</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <button
            type="submit"
            disabled={loadingAction !== null}
            className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingAction === 'login' && 'Connexion…'}
            {loadingAction === 'signup' && 'Création…'}
            {loadingAction === null && (isSignup ? 'Créer mon compte' : 'Se connecter')}
          </button>
        </form>
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
  const { currentProject, currentUser } = useProjectStore();

  const navigate = useNavigate();

  return (
    <header className="flex h-12 items-center justify-between border-b bg-white px-4 shadow-sm">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/projects')} className="text-sm font-bold text-blue-600 hover:underline">
          FieldCorrect
        </button>
        {currentProject && (
          <span className="text-sm text-gray-500">/ {currentProject.name}</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <HeaderButton onClick={onImport} label="📥 Import" />
        <HeaderButton onClick={onExport} label="📤 Export" />
        <HeaderButton onClick={onPrint} label="🖨️ Imprimer" />
        <div className="mx-1 h-5 w-px bg-gray-200" />
        <HeaderButton onClick={onSettings} label="⚙️" />
        <HeaderButton onClick={onMembers} label="👥" />
        <HeaderButton onClick={onSync} label="🔄" />
        <div className="mx-1 h-5 w-px bg-gray-200" />
        <OnlineIndicator />
        {currentUser && (
          <span className="ml-2 text-xs text-gray-500">{currentUser.full_name || currentUser.email}</span>
        )}
        <button
          onClick={async () => { await supabase.auth.signOut(); }}
          className="ml-2 text-xs text-gray-400 hover:text-red-500"
          title="Déconnexion"
        >
          ⏻
        </button>
      </div>
    </header>
  );
}

function HeaderButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:text-gray-900"
    >
      {label}
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
    <span
      className={`h-2 w-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`}
      title={online ? 'En ligne' : 'Hors ligne'}
    />
  );
}

// ── Main layout ─────────────────────────────────────
function MainLayout() {
  const { layerPanelOpen, attributeTableOpen, identifiedFeature } = useMapStore();
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

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
            <LayerPanel />
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
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthGate>
          <Routes>
            <Route path="/" element={<ProjectsList />} />
            <Route path="/projects" element={<ProjectsList />} />
            <Route path="/project/:projectId" element={<MainLayout />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
