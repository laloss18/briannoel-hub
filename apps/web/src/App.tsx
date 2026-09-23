import { useAuth } from './auth/useAuth';
import AuthFlow from './auth/AuthFlow';
import SyncPanel from './sync/SyncPanel';
import BimonedaCard from './bimoneda/BimonedaCard';

export default function App() {
  const auth = useAuth();
  const isHome = auth.screen === 'home';

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-100">Brian Noel Hub</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Fase 1 · auth offline + configuración bimoneda + sync
        </p>
      </header>
      {isHome ? (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-zinc-400">Sesión activa · desbloqueado</p>
            <button
              onClick={auth.logout}
              className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
            >
              Salir · purgar local
            </button>
          </div>
          <BimonedaCard roles={auth.session?.roles ?? []} />
          <SyncPanel />
        </>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100">
          <AuthFlow auth={auth} />
        </div>
      )}
    </main>
  );
}
