export interface SyncButtonProps {
  busy: boolean;
  onSync: () => void;
}

/**
 * CTA primario del hub (barra superior, izquierda): sincroniza desde el
 * dispositivo (PRD §5.7). Ámbar = única acción primaria de la pantalla.
 */
export default function SyncButton({ busy, onSync }: SyncButtonProps) {
  return (
    <button
      onClick={onSync}
      disabled={busy}
      aria-label={busy ? 'Sincronizando datos' : 'Sincronizar datos'}
      className="flex items-center gap-2 rounded-md bg-signal px-3.5 py-2 text-sm font-semibold text-ink-950 transition-[transform,background-color] hover:bg-signal-soft disabled:cursor-wait disabled:opacity-60 active:scale-[0.98]"
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
      {busy ? 'Sincronizando…' : 'Sincronizar'}
    </button>
  );
}
