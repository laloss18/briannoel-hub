import SyncPanel from './sync/SyncPanel';

export default function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6">
      <header>
        <h1 className="text-2xl font-semibold text-zinc-100">Brian Noel Hub</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Fase 0 · sync engine <code>stellar-drive</code> + Supabase (1 proyecto)
        </p>
      </header>
      <SyncPanel />
    </main>
  );
}
