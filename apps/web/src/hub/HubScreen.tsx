import { useState } from 'react';
import type { Role } from '@brian/shared';
import { hasPermission } from '@brian/shared';
import { Brand, Monogram, StatusStrip } from '../ui/brand';
import BimonedaCard from '../bimoneda/BimonedaCard';
import BcvRateDialog from '../bimoneda/BcvRateDialog';
import SyncButton from '../sync/SyncButton';
import { useSync } from '../sync/useSync';
import ClientesCard from '../clientes/ClientesCard';
import ZonasCard from '../clientes/ZonasCard';
import ModuleMenu, { type ModuleDef, type ModuleId } from './ModuleMenu';
import HomeDashboard from './HomeDashboard';
import HomeHistorial from './HomeHistorial';

export interface HubScreenProps {
  email: string;
  roles: readonly Role[];
  onLogout: () => void;
}

const MODULES: readonly ModuleDef[] = [
  { id: 'config', name: 'Configuración', status: 'listo' },
  { id: 'clientes', name: 'Clientes', status: 'listo' },
  { id: 'zonas', name: 'Zonas', status: 'listo' },
  { id: 'ventas', name: 'Ventas', status: 'pendiente' },
  { id: 'cobranza', name: 'Cobranza', status: 'pendiente' },
  { id: 'pagos', name: 'Pagos', status: 'pendiente' },
  { id: 'rutas', name: 'Rutas', status: 'pendiente' },
  { id: 'reportes', name: 'Reportes', status: 'pendiente' },
];

/**
 * Pantalla de inicio del hub (§2.8): sesión activa + sync en la barra superior
 * (izquierda, aporta clockSync como dato de instrumento). La home es rol-aware:
 * `view_kpis` (admin/supervisor §3.2) → dashboard con KPIs; el resto → histórico
 * de operaciones con CTA de venta rápida. El acceso a los módulos vive en el
 * menú (drawer) de la barra superior, no como índice en la home. Un módulo
 * abierto reemplaza el resumen (nada apilado debajo).
 */
export default function HubScreen({ email, roles, onLogout }: HubScreenProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [module, setModule] = useState<ModuleId | null>(null);
  const [bcvOpen, setBcvOpen] = useState(false);
  const { busy, last, error, sync } = useSync();

  const active = MODULES.find((m) => m.id === module && m.status === 'listo');
  const canViewKpis = hasPermission('view_kpis', roles);

  const onSelectModule = (id: ModuleId) => {
    setMenuOpen(false);
    setModule(id);
  };

  return (
    <div className="flex min-h-dvh flex-col justify-between gap-8 px-5 py-6 sm:py-10">
      <div>
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <SyncButton busy={busy} onSync={() => void sync()} />
            <div className="hidden min-w-0 sm:block">
              {error ? (
                <p className="truncate text-[11px] text-danger">{error}</p>
              ) : (
                <p className="truncate text-[11px] text-fog-500">
                  Última sync: {last ?? '(nunca)'}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-haspopup="dialog"
              className="rounded-md border border-ink-700 px-2.5 py-1 font-mono text-[11px] text-fog-100 transition-colors hover:border-ink-600"
            >
              menú
            </button>
            <Monogram />
            <button
              onClick={onLogout}
              className="rounded-md border border-ink-700 px-2.5 py-1 font-mono text-[11px] text-fog-500 transition-colors hover:text-fog-300"
            >
              salir
            </button>
          </div>
        </header>

        <div className="rise-in mt-6">
          <Brand />

          <div className="mt-5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-fog-500">sesión activa</span>
              <span className="size-1.5 rounded-full bg-ok" aria-hidden="true" />
            </div>
            <p className="truncate font-mono text-[15px] text-fog-100">{email}</p>
            <p className="font-mono text-[11px] text-fog-700">
              {roles.length ? roles.join(' + ') : 'sin rol'}
            </p>
          </div>

          {active ? (
            <section aria-label={active.name} className="rise-in mt-8 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[12px] text-fog-300">módulo · {active.name}</p>
                <button
                  type="button"
                  onClick={() => setModule(null)}
                  className="font-mono text-[11px] text-fog-700 transition-colors hover:text-fog-500"
                >
                  volver
                </button>
              </div>
              {active.id === 'config' && <BimonedaCard roles={roles} />}
              {active.id === 'clientes' && <ClientesCard roles={roles} email={email} />}
              {active.id === 'zonas' && <ZonasCard />}
            </section>
          ) : (
            <section aria-label="Resumen" className="rise-in mt-8">
              {canViewKpis ? (
                <HomeDashboard
                  roles={roles}
                  onNewCliente={() => setModule('clientes')}
                  onOpenBcv={() => setBcvOpen(true)}
                />
              ) : (
                <HomeHistorial />
              )}
            </section>
          )}
        </div>
      </div>

      <StatusStrip />

      <ModuleMenu open={menuOpen} modules={MODULES} onClose={() => setMenuOpen(false)} onSelect={onSelectModule} />
      <BcvRateDialog open={bcvOpen} onClose={() => setBcvOpen(false)} roles={roles} />
    </div>
  );
}