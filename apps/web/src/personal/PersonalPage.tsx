import PageShell from '../app/PageShell';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { listPersonal } from './personalRepo';
import { useSesion } from '../app/sesion';
import { hasPermission } from '@brian/shared';

export default function PersonalPage() {
  const { roles } = useSesion();
  const personas = useLiveQuery(() => listPersonal(), []);
  const canManage = hasPermission('manage_personal', roles);

  return (
    <PageShell
      titulo="Personal"
      icono="user"
      volverA="/"
      accion={canManage ? { label: 'Nueva persona', icon: 'plus', to: '/personal/nuevo' } : undefined}
    >
      <ul className="flex flex-col divide-y divide-ink-700/60 border-y border-ink-700/60">
        {personas?.map((p) => (
          <li key={p.id}>
            {canManage ? (
              <Link
                to={`/personal/${p.id}/editar`}
                className="flex flex-col gap-1 py-2.5 transition-colors hover:bg-ink-950/40"
              >
                <span className="text-sm font-medium text-fog-100">{p.nombre}</span>
                <span className="font-mono text-xs tabular-nums text-fog-500">
                  {p.rol}
                  {p.telefono ? ` · ${p.telefono}` : ''}
                  {p.email ? ` · ${p.email}` : ''}
                </span>
              </Link>
            ) : (
              <div className="flex flex-col gap-1 py-2.5">
                <span className="text-sm font-medium text-fog-100">{p.nombre}</span>
                <span className="font-mono text-xs tabular-nums text-fog-500">
                  {p.rol}
                  {p.telefono ? ` · ${p.telefono}` : ''}
                  {p.email ? ` · ${p.email}` : ''}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
      {personas?.length === 0 && <p className="pt-3 text-xs text-fog-600">El roster está vacío.</p>}
    </PageShell>
  );
}
