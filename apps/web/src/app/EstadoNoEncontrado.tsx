import PageShell from './PageShell';
import type { IconName } from '../ui/icons';

/**
 * Estado "no encontrado" para las páginas que cargan un registro por id: mismo
 * `PageShell` (título + icono + volver) con un mensaje sobrio.
 */
export function EstadoNoEncontrado({
  titulo,
  icono,
  mensaje,
}: {
  titulo: string;
  icono?: IconName;
  mensaje: string;
}) {
  return (
    <PageShell titulo={titulo} icono={icono}>
      <p className="text-xs text-fog-600">{mensaje}</p>
    </PageShell>
  );
}
