import { useState } from 'react';
import type { Role } from '@brian/shared';
import { Brand, StatusStrip } from '../ui/brand';
import BimonedaCard from '../bimoneda/BimonedaCard';
import SyncPanel from '../sync/SyncPanel';

export interface HubScreenProps {
  email: string;
  roles: readonly Role[];
  onLogout: () => void;
}

type ModuleId =
  'config' | 'clientes' | 'zonas' | 'ventas' | 'cobranza' | 'pagos' | 'rutas' | 'reportes';

interface ModuleDef {
  id: ModuleId;
  name: string;
  phase: number;
  status: 'listo' | 'siguiente' | 'pendiente';
}

const MODULES: ModuleDef[] = [
  { id: 'config', name: 'Config + Bimoneda', phase: 1, status: 'listo' },
  { id: 'clientes', name: 'Clientes + scoring', phase: 2, status: 'siguiente' },
  { id: 'zonas', name: 'Zonas', phase: 3, status: 'pendiente' },
  { id: 'ventas', name: 'Ventas / Despachos', phase: 4, status: 'pendiente' },
  { id: 'cobranza', name: 'Cobranza / CxC', phase: 5, status: 'pendiente' },
  { id: 'pagos', name: 'Pagos + FIFO', phase: 6, status: 'pendiente' },
  { id: 'rutas', name: 'Rutas / Entregas', phase: 7, status: 'pendiente' },
  { id: 'reportes', name: 'Reportes / Dashboard', phase: 8, status: 'pendiente' },
];

/**
 * Pantalla de inicio del hub (§2.8): sesión activa + navegación por módulos
 * del MVP. El módulo 1 (configuración/bimoneda/sync) está activo; el resto
 * indica su fase planificada.
 */
export default function HubScreen({ email, roles, onLogout }: HubScreenProps) {
  const [module, setModule] = useState<ModuleId | null>(null);

  const active = MODULES.find((m) => m.id === module && m.status === 'listo');

  return (
    <div className="flex min-h-dvh flex-col justify-between gap-8 px-5 py-6 sm:py-10">
      <div>
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <button
            onClick={onLogout}
            className="rounded-md border border-ink-700 px-2.5 py-1 font-mono text-[11px] text-fog-500 transition-colors hover:text-fog-300"
          >
            salir
          </button>
        </div>

        <div className="rise-in mt-8">
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] text-fog-500">sesión activa</p>
            <p className="font-mono text-[15px] text-fog-100">{email}</p>
            <p className="font-mono text-[11px] text-fog-700">
              {roles.length ? roles.join(' + ') : 'sin rol'}
            </p>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {MODULES.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={m.status !== 'listo'}
                onClick={() => setModule(m.id)}
                className={`group flex min-h-24 flex-col items-start justify-between rounded-xl border bg-ink-900 p-3.5 text-left transition-colors ${
                  m.status === 'listo'
                    ? 'border-ink-700 hover:border-ink-600'
                    : m.status === 'siguiente'
                      ? 'border-signal/40'
                      : 'border-ink-700/50'
                } ${m.status === 'listo' ? 'cursor-pointer' : 'cursor-default'}`}
                aria-label={`${m.name}${m.status === 'listo' ? ' (abrir)' : m.status === 'siguiente' ? ' (fase 2)' : ` (fase ${m.phase})`}`}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-fog-100">
                  {m.name}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider ${
                    m.status === 'listo'
                      ? 'text-ok'
                      : m.status === 'siguiente'
                        ? 'text-signal'
                        : 'text-fog-700'
                  }`}
                >
                  fase {m.phase} · {m.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {active && (
        <div className="rise-in flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[12px] text-fog-300">módulo · {active.name}</p>
            <button
              type="button"
              onClick={() => setModule(null)}
              className="font-mono text-[11px] text-fog-700 transition-colors hover:text-fog-500"
            >
              cerrar módulo
            </button>
          </div>
          {active.id === 'config' && (
            <>
              <BimonedaCard roles={roles} />
              <SyncPanel />
            </>
          )}
        </div>
      )}

      <StatusStrip />
    </div>
  );
}
