import PageShell from '../app/PageShell';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { listItems } from '../ventas/itemsRepo';
import { useSesion } from '../app/sesion';
import { hasPermission } from '@brian/shared';
import { dosDecimales } from '../lib/moneda';

export default function CatalogoPage() {
  const { roles } = useSesion();
  const items = useLiveQuery(() => listItems(), []);
  const canManage = hasPermission('manage_items', roles);

  return (
    <PageShell
      titulo="Catálogo"
      icono="package"
      volverA="/"
      accion={
        canManage
          ? {
              label: 'Nuevo ítem',
              icon: 'plus',
              to: '/catalogo/nuevo',
              variant: 'primary',
              soloIcono: true,
            }
          : undefined
      }
    >
      <ul className="flex flex-col divide-y divide-ink-700/60 border-y border-ink-700/60">
        {items?.map((i) => (
          <li key={i.id}>
            {canManage ? (
              <Link
                to={`/catalogo/${i.id}/editar`}
                className="flex flex-col gap-1 py-2.5 transition-colors hover:bg-ink-800/60"
              >
                <span className="text-sm font-medium text-fog-100">{i.nombre}</span>
                <span className="font-mono text-xs tabular-nums text-fog-500">
                  Crédito · {dosDecimales(i.precio_credito)} · Contado ·{' '}
                  {dosDecimales(i.precio_contado)} USD
                </span>
              </Link>
            ) : (
              <div className="flex flex-col gap-1 py-2.5">
                <span className="text-sm font-medium text-fog-100">{i.nombre}</span>
                <span className="font-mono text-xs tabular-nums text-fog-500">
                  Crédito · {dosDecimales(i.precio_credito)} · Contado ·{' '}
                  {dosDecimales(i.precio_contado)} USD
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {items?.length === 0 && <p className="pt-3 text-xs text-fog-600">El catálogo está vacío.</p>}
    </PageShell>
  );
}
