import { useLiveQuery } from 'dexie-react-hooks';
import { DexieOutbox } from '../sync/db';

interface SyncButtonProps {
  busy: boolean;
  onSync: () => void;
}

export default function SyncButton({ busy, onSync }: SyncButtonProps) {
  const pendientes = useLiveQuery(() => new DexieOutbox().list('pending'), []);
  const fallidos = useLiveQuery(() => new DexieOutbox().list('failed'), []);
  const hayCambios = (pendientes?.length ?? 0) + (fallidos?.length ?? 0) > 0;
  const cls = hayCambios ? 'border-signal bg-signal text-on-signal' : 'border-ink-700 text-fog-100';
  return (
    <button
      onClick={onSync}
      disabled={busy}
      aria-label={busy ? 'Sincronizando datos' : 'Sincronizar datos'}
      aria-busy={busy}
      title={hayCambios ? 'Hay cambios por sincronizar' : 'Sincronizar'}
      className={`btn-lift flex size-11 items-center justify-center rounded-lg border hover:brightness-95 disabled:cursor-wait disabled:opacity-60 ${cls} ${hayCambios ? 'cta-glow' : ''}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={`size-4 ${busy ? 'animate-spin' : ''}`}
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
      <span className="sr-only">{busy ? 'Sincronizando…' : 'Sincronizar'}</span>
    </button>
  );
}
