import { useCallback, useState } from 'react';
import { StellarDrive } from '@brian/sync-engine';
import { DexieLocalStore, DexieOutbox, DexieCursorStore, DexieEventLog } from './db';
import { SupabaseTransport } from './transport';
import { supabase } from './supabase';

export default function SyncPanel() {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string>('(nunca)');
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (!supabase) {
      setError('Falta VITE_SUPABASE_* en apps/web/.env.local');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const drive = new StellarDrive({
        transport: new SupabaseTransport(),
        store: new DexieLocalStore(),
        outbox: new DexieOutbox(),
        cursors: new DexieCursorStore(),
        events: new DexieEventLog(),
        clock: null,
        entities: ['app_users', 'app_config', 'demo_clients'],
      });
      await drive.measureClock();
      const res = await drive.syncAll();
      setLast(
        `${new Date().toLocaleTimeString()} · push ${res.push.pushed} ok · pull aplicados ${res.pulls.reduce((a, p) => a + p.applied, 0)}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Sync engine · stellar-drive</p>
          <p className="mt-1 text-xs text-fog-500">Última sync: {last}</p>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        <button
          onClick={sync}
          disabled={busy}
          className="rounded-md bg-signal px-3 py-1.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft disabled:opacity-50"
        >
          {busy ? 'Sincronizando…' : 'Sincronizar'}
        </button>
      </div>
    </div>
  );
}
