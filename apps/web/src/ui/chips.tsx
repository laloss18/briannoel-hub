import type { ReactNode } from 'react';
import type { DespachoEstado } from '@brian/shared';

/**
 * Chips de estado (DESIGN §6 y §10): píldora con **relleno suave** del tono
 * semántico + texto del mismo tono. El tenue rellena como badge sin el coste de
 * contraste de un relleno sólido, y sobre el fondo claro/oscuro de tarjeta
 * mantiene AA porque el texto usa el tono fuerte (`signal-strong`, `ok`,
 * `danger`, `fog-300`).
 */
type ChipTono = 'neutral' | 'ok' | 'signal' | 'danger';

const TONOS: Record<ChipTono, string> = {
  neutral: 'bg-ink-800 text-fog-300',
  ok: 'bg-ok/10 text-ok',
  signal: 'bg-signal/10 text-signal-strong',
  danger: 'bg-danger/10 text-danger',
};

export function Chip({ tono = 'neutral', children }: { tono?: ChipTono; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-2xs uppercase tracking-wider ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}

/** Punto de estado (usa `currentColor`) para `ChipEstado`. */
export function ChipPunto() {
  return <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />;
}

/** Estado del despacho: pedido (pendiente), entregado, anulado. */
export function ChipEstado({ estado }: { estado: DespachoEstado }) {
  const tono = estado === 'entregado' ? 'ok' : estado === 'pedido' ? 'signal' : 'neutral';
  return (
    <Chip tono={tono}>
      <ChipPunto />
      {estado}
    </Chip>
  );
}
