import { useEffect, useState } from 'react';

/** Monograma candado del hub (acción naranja única). */
export function Monogram() {
  return (
    <div className="flex size-10 items-center justify-center rounded-md bg-ink-800 text-signal-strong shadow-[inset_0_0_0_1px_var(--color-ink-700)]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="size-5"
        stroke="currentColor"
        strokeWidth={1.6}
        aria-hidden="true"
      >
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
        <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
      </svg>
    </div>
  );
}

/** Marca del hub: monograma + nombre + descriptor. */
export function Brand() {
  return (
    <div className="flex items-center gap-3">
      <Monogram />
      <div className="leading-tight">
        <p className="text-base font-semibold tracking-tight text-fog-100">Brian Noel</p>
        <p className="text-2xs text-fog-500">hub de operaciones</p>
      </div>
    </div>
  );
}

/** Reloj en vivo: solo los segundos en naranja (fuente de verdad del sync). */
export function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return (
    <span className="font-mono text-xs tabular-nums text-fog-500">
      {hh}:{mm}
      <span className="text-fog-500">:</span>
      <span className="text-signal-strong">{ss}</span>
    </span>
  );
}

/** Franja de estado base de todas las pantallas. */
export function StatusStrip() {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-ink-700/60 pt-3 text-2xs text-fog-500">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
        reloj del dispositivo
      </span>
      <Clock />
    </div>
  );
}
