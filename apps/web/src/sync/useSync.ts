import { useCallback, useState } from 'react';
import { ConflictRegistry, StellarDrive } from '@brian/sync-engine';
import { SYNC_ENTITIES } from '@brian/shared';
import { DexieLocalStore, DexieOutbox, DexieCursorStore, DexieEventLog } from './db';
import { SupabaseTransport } from './transport';
import { supabase } from './supabase';

export interface SyncState {
  busy: boolean;
  last: string | null;
  error: string | null;
}

export interface SyncResult {
  pushed: number;
  applied: number;
}

/**
 * Sincronización puntual fuera del hook (p. ej. tras un alta hecha en el
 * servidor por una RPC, para bajar el registro nuevo del delta). El reloj se
 * mide antes de transferir (clockSync, PRD §5.4).
 */
export async function runSync(): Promise<SyncResult> {
  if (!supabase) throw new Error('Falta VITE_SUPABASE_* en apps/web/.env.local');
  const drive = new StellarDrive({
    transport: new SupabaseTransport(),
    store: new DexieLocalStore(),
    outbox: new DexieOutbox(),
    cursors: new DexieCursorStore(),
    events: new DexieEventLog(),
    clock: null,
    // Entidades críticas (§5.1): `despachos` resuelve conflictos por rol del
    // editor (supervisor gana al promotor aunque edite antes); el resto LWW.
    registry: new ConflictRegistry().register('despachos', 'rolePriority'),
    entities: [...SYNC_ENTITIES],
  });
  await drive.measureClock();
  const res = await drive.syncAll();
  return {
    pushed: res.push.pushed,
    applied: res.pulls.reduce((a, p) => a + p.applied, 0),
  };
}

/**
 * Sync compartida del hub: una sola fuente de verdad (botón de la barra
 * superior del hub). El reloj se mide en cada sync antes de transferir
 * (clockSync, PRD §5.4).
 */
export function useSync() {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await runSync();
      setLast(
        `${new Date().toLocaleTimeString()} · ${res.pushed} cambio(s) subido(s) · ${res.applied} recibido(s)`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, last, error, sync } satisfies SyncState & { sync: () => Promise<void> };
}
