import { geoMapsUrl } from '../lib/geo';

/** Botón de icono para obtener la ubicación del dispositivo (mínimo espacio). */
export function GeoBoton({
  onClick,
  busy,
  label = 'usar mi ubicación',
}: {
  onClick: () => void;
  busy?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={label}
      title={label}
      className="btn-lift flex size-11 shrink-0 items-center justify-center rounded-md border border-ink-700 bg-ink-950 text-fog-300 transition-colors hover:border-ink-600 hover:text-fog-100 disabled:opacity-50"
    >
      {busy ? (
        <span
          className="size-3.5 animate-spin rounded-full border-2 border-ink-600 border-t-fog-100"
          aria-hidden="true"
        />
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="size-4"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      )}
    </button>
  );
}

/** Enlace "cómo llegar": abre la ubicación del cliente en Google Maps. */
export function AbrirMapa({ lat, lng }: { lat: number; lng: number }) {
  return (
    <a
      href={geoMapsUrl(lat, lng)}
      target="_blank"
      rel="noreferrer"
      className="shrink-0 font-mono text-2xs uppercase tracking-wider text-signal transition-colors hover:text-fog-100"
    >
      mapa ↗
    </a>
  );
}