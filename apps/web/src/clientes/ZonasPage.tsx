import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { listZonas } from './zonasRepo';
import PageShell from '../app/PageShell';
import { useSesion } from '../app/sesion';
import { label as labelCls } from '../ui/section';

export default function ZonasPage() {
  const { roles } = useSesion();
  const zonas = useLiveQuery(() => listZonas(), []);
  const canManage = roles.includes('admin') || roles.includes('supervisor');
  const total = zonas?.length ?? 0;
  const conGeo = zonas?.filter((z) => z.lat !== null && z.lng !== null).length ?? 0;

  return (
    <PageShell
      titulo="Zonas"
      icono="map"
      volverA="/"
      accion={
        canManage
          ? {
              label: 'Nueva zona',
              icon: 'plus',
              to: '/zonas/nueva',
              variant: 'primary',
              soloIcono: true,
            }
          : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <p className="font-mono text-xs tabular-nums text-fog-500">
          {total} zona{total === 1 ? '' : 's'} · {conGeo} con ubicación
        </p>
        <ul className="flex flex-col divide-y divide-ink-700/60 border-y border-ink-700/60">
          {zonas?.map((z) => (
            <li key={z.id}>
              {canManage ? (
                <Link
                  to={`/zonas/${z.id}/editar`}
                  className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-ink-800/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fog-100">
                      {z.nombre}
                    </span>
                    <span className="block truncate font-mono text-xs text-fog-500">
                      {z.municipio} · {z.estado}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 ${labelCls} ${
                      z.lat !== null && z.lng !== null ? 'text-ok' : 'text-fog-600'
                    }`}
                  >
                    {z.lat !== null && z.lng !== null ? 'Ubicación' : 'Manual'}
                  </span>
                </Link>
              ) : (
                <div className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fog-100">
                      {z.nombre}
                    </span>
                    <span className="block truncate font-mono text-xs text-fog-500">
                      {z.municipio} · {z.estado}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 ${labelCls} ${
                      z.lat !== null && z.lng !== null ? 'text-ok' : 'text-fog-600'
                    }`}
                  >
                    {z.lat !== null && z.lng !== null ? 'Ubicación' : 'Manual'}
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
        {zonas?.length === 0 && (
          <p className="pt-3 text-xs text-fog-600">
            Todavía no hay zonas. Usa «Nueva zona» para crearla.
          </p>
        )}
      </div>
    </PageShell>
  );
}
