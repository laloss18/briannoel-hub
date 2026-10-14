import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

/** Superficie estándar de sección/tarjeta (DESIGN §5.6 y §6): plana con
 *  hairline, sombra solo de estado. Única definición: no se copia por página. */
export const surface = 'rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-card';

/** Etiqueta de interfaz en sentence case (DESIGN §4.4): títulos de sección,
 *  labels de KPI, kickers de página y labels de filtro. Sans, peso medio, tono
 *  apagado. NO se usa mono-mayúsculas aquí — eso es `eyebrow`. */
export const label = 'text-2xs font-medium tracking-wide text-fog-500';

/** Mono-mayúsculas reservado a DATOS de instrumento (DESIGN §4.4): IDs/códigos
 *  (nro_control), cifras, timestamps y labels de campo de formulario. */
export const eyebrow = 'font-mono text-2xs uppercase tracking-wider text-fog-600';

/**
 * Sección de un detalle/formulario: superficie `surface` + título sentence case
 * (con icono opcional) y un slot de acción a la derecha. Sustituye el
 * `<section>` que cada página escribía a mano, para que el tratamiento sea
 * idéntico en toda la app (regla `shape-consistency-lock`).
 */
export function Section({
  titulo,
  icono,
  accion,
  children,
  className,
}: {
  titulo?: string;
  icono?: IconName;
  accion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${surface} ${className ?? ''}`}>
      {(titulo || accion) && (
        <div className="flex items-center justify-between gap-2">
          {titulo ? (
            <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-[-0.01em] text-fog-100">
              {icono && <Icon name={icono} className="size-3.5 text-fog-500" />}
              {titulo}
            </h2>
          ) : (
            <span />
          )}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}
