export interface SyncPanelProps {
  busy: boolean;
  last: string | null;
  error: string | null;
  onSync: () => void;
}

/**
 * Estado de sync del módulo de config (PRD §5.7): refleja la última sync y
 * errores. Es presentacional: la fuente de verdad vive en HubScreen (useSync),
 * que la comparte con el botón de la barra superior y este panel.
 */
export default function SyncPanel({ busy, last, error, onSync }: SyncPanelProps) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Sync engine · stellar-drive</p>
          <p className="mt-1 text-xs text-fog-500">Última sync: {last ?? '(nunca)'}</p>
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        <button
          onClick={onSync}
          disabled={busy}
          className="rounded-md bg-signal px-3 py-1.5 text-sm font-semibold text-ink-950 transition-[transform,background-color] hover:bg-signal-soft disabled:opacity-50 active:scale-[0.98]"
        >
          {busy ? 'Sincronizando…' : 'Sincronizar'}
        </button>
      </div>
    </div>
  );
}
