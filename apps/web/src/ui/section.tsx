import type { ReactNode } from 'react';
import { Icon, type IconName } from './icons';

/** Superficie estándar de sección/tarjeta (DESIGN §5.6 y §6): plana con
 *  hairline, sombra solo de estado. Única definición: no se copia por página. */
export const surface = 'rounded-2xl border border-ink-700 bg-ink-900 p-4 shadow-card';

/** Label mono (eyebrow) de sección o título de dato. */
export const eyebrow = 'font-mono text-2xs uppercase tracking-wider text-fog-600';

/**
 * Sección de un detalle/formulario: superficie `surface` + eyebrow mono opcional
 * (con icono) y un slot de acción a la derecha. Sustituye el `<section>` que
 * cada página escribía a mano, para que el tratamiento sea idéntico en toda la
 * app (regla `shape-consistency-lock`).
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
            <h2 className={`flex items-center gap-1.5 ${eyebrow}`}>
              {icono && <Icon name={icono} className="size-3.5" />}
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
