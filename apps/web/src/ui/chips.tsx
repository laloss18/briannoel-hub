import type { ReactNode } from 'react';
import type { DespachoEstado } from '@brian/shared';

/**
 * Chips de estado (DESIGN §6 y §10): borde + texto del mismo tono semántico sobre el
 * fondo que tenga el contenedor. Nunca relleno sólido: en listas densas el
 * relleno compite con el contenido y el texto pierde contraste en un tono.
 */
type ChipTono = 'neutral' | 'ok' | 'signal' | 'danger';

const TONOS: Record<ChipTono, string> = {
  neutral: 'border-ink-600 text-fog-500',
  ok: 'border-ok/50 text-ok',
  signal: 'border-signal/50 text-signal-strong',
  danger: 'border-danger/50 text-danger',
};

export function Chip({ tono = 'neutral', children }: { tono?: ChipTono; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-2xs uppercase tracking-wider ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}

/** Estado del despacho: pedido (pendiente), entregado, anulado. */
export function ChipEstado({ estado }: { estado: DespachoEstado }) {
  const tono = estado === 'entregado' ? 'ok' : estado === 'pedido' ? 'signal' : 'neutral';
  return <Chip tono={tono}>{estado}</Chip>;
}
