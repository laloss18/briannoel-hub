import { useState } from 'react';
import type { Role } from '@brian/shared';
import { Brand, Monogram, StatusStrip } from '../ui/brand';
import BimonedaCard from '../bimoneda/BimonedaCard';
import BcvRateDialog from '../bimoneda/BcvRateDialog';
import SyncButton from '../sync/SyncButton';
import SyncPanel from '../sync/SyncPanel';
import { useSync } from '../sync/useSync';
import ClientesCard from '../clientes/ClientesCard';
import ZonasCard from '../clientes/ZonasCard';

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
  { id: 'clientes', name: 'Clientes + scoring', phase: 2, status: 'listo' },
  { id: 'zonas', name: 'Zonas', phase: 2, status: 'listo' },
  { id: 'ventas', name: 'Ventas / Despachos', phase: 4, status: 'pendiente' },
  { id: 'cobranza', name: 'Cobranza / CxC', phase: 5, status: 'pendiente' },
  { id: 'pagos', name: 'Pagos + FIFO', phase: 6, status: 'pendiente' },
  { id: 'rutas', name: 'Rutas / Entregas', phase: 7, status: 'pendiente' },
  { id: 'reportes', name: 'Reportes / Dashboard', phase: 8, status: 'pendiente' },
];

/** Acción rápida (diseño instrumento nocturno, DESIGN.md): CTA con jerarquía,
 *  sombreado solo por borde, copy activo. Invocables desde el hub sin navegar. */
interface QuickAction {
  key: string;
  label: string;
  hint: string;
  enabled: boolean;
  onActivate?: () => void;
}

/**
 * Pantalla de inicio del hub (§2.8): sesión activa + sync en la barra superior
 * (izquierda, aporta clockSync como dato de instrumento) + acciones rápidas +
 * navegación por módulos del MVP. Módulo 1 (config/bimoneda/sync) activo.
 */
export default function HubScreen({ email, roles, onLogout }: HubScreenProps) {
  const [module, setModule] = useState<ModuleId | null>(null);
  const [bcvOpen, setBcvOpen] = useState(false);
  const { busy, last, error, sync } = useSync();

  const active = MODULES.find((m) => m.id === module && m.status === 'listo');

  const quickActions: QuickAction[] = [
    {
      key: 'bcv',
      label: 'Configurar tasa BCV',
      hint: 'bimoneda',
      enabled: true,
      onActivate: () => setBcvOpen(true),
    },
    {
      key: 'sync',
      label: 'Sincronizar',
      hint: 'offline first',
      enabled: !busy,
      onActivate: () => void sync(),
    },
    {
      key: 'cliente',
      label: 'Nuevo cliente',
      hint: 'fase 2 · listo',
      enabled: true,
      onActivate: () => setModule('clientes'),
    },
    {
      key: 'venta',
      label: 'Registrar venta',
      hint: 'fase 4 · pendiente',
      enabled: false,
      onActivate: () => setModule('ventas'),
    },
  ];

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
          <div className="flex shrink-0 items-center gap-3">
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

          <section
            aria-label="Acciones rápidas"
            className="rise-in mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            {quickActions.map((qa) => (
              <button
                key={qa.key}
                type="button"
                disabled={!qa.enabled}
                onClick={qa.onActivate}
                className={`group flex min-h-24 flex-col items-start justify-between rounded-xl border bg-ink-900 p-3.5 text-left transition-[transform,background-color,border-color] ${
                  qa.enabled
                    ? 'border-ink-600 hover:border-signal active:scale-[0.98]'
                    : 'border-ink-700/50'
                } ${qa.enabled ? 'cursor-pointer' : 'cursor-default'}`}
                aria-disabled={!qa.enabled}
              >
                <span className="text-[13px] font-medium leading-snug text-fog-100">
                  {qa.label}
                </span>
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider ${
                    qa.enabled ? 'text-signal' : 'text-fog-700'
                  }`}
                >
                  {qa.hint}
                </span>
              </button>
            ))}
          </section>

          <section aria-label="Módulos del MVP" className="rise-in mt-5">
            <p className="text-[12px] text-fog-500">módulos</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {MODULES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={m.status !== 'listo'}
                  onClick={() => setModule(m.id)}
                  className={`group flex min-h-24 flex-col items-start justify-between rounded-xl border bg-ink-900 p-3.5 text-left transition-[transform,background-color,border-color] ${
                    m.status === 'listo'
                      ? 'border-ink-700 hover:border-ink-600 active:scale-[0.98]'
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
          </section>
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
              <SyncPanel busy={busy} last={last} error={error} onSync={() => void sync()} />
            </>
          )}
          {active.id === 'clientes' && <ClientesCard roles={roles} email={email} />}
          {active.id === 'zonas' && <ZonasCard />}
        </div>
      )}

      <StatusStrip />

      <BcvRateDialog open={bcvOpen} onClose={() => setBcvOpen(false)} roles={roles} />
    </div>
  );
}
