import { useLiveQuery } from 'dexie-react-hooks';
import type { Role } from '@brian/shared';
import { listClientes } from '../clientes/clientesRepo';
import { listZonas } from '../clientes/zonasRepo';
import { getAppConfig } from '../bimoneda/appConfig';
import { DexieOutbox, hub } from '../sync/db';
import { canEditClientes } from '../clientes/clientesRepo';

interface HomeDashboardProps {
  roles: readonly Role[];
  lastSync: string | null;
  onNewCliente: () => void;
  onOpenBcv: () => void;
  onSync: () => void;
}

const GRADOS = ['A', 'B', 'C', 'D', 'E'] as const;

/**
 * Dashboard de la home para quien tiene `view_kpis` (admin/supervisor, §3.2):
 * solo KPIs que ya tienen fuente real (clientes, zonas, scoring, bimoneda, sync).
 * Ventas/despachos aún no existen (Fase 3) → seccion "en próximas fases".
 */
export default function HomeDashboard({
  roles,
  lastSync,
  onNewCliente,
  onOpenBcv,
  onSync,
}: HomeDashboardProps) {
  const clientes = useLiveQuery(() => listClientes(), []);
  const zonas = useLiveQuery(() => listZonas(), []);
  const config = useLiveQuery(() => getAppConfig(), []);
  const pendientes = useLiveQuery(() => new DexieOutbox().list('pending'), []);
  const fallidos = useLiveQuery(() => new DexieOutbox().list('failed'), []);
  const events = useLiveQuery(
    () => hub.events.orderBy('created_at').reverse().limit(1).toArray(),
    [],
  );

  const total = clientes?.length ?? 0;
  const conZona = clientes?.filter((c) => c.zona_id !== null).length ?? 0;
  const conScore = clientes?.filter((c) => c.score_grado !== null) ?? [];
  const porGrado = (g: (typeof GRADOS)[number]) => conScore.filter((c) => c.score_grado === g).length;
  const canEdit = canEditClientes(roles);
  const rate = config?.bcv_rate;
  const ultimaSync = events?.[0]?.created_at ?? lastSync;

  const kpis = [
    { label: 'clientes', value: total, hint: conZona ? `${conZona} con zona` : 'aún sin zona' },
    { label: 'zonas', value: zonas?.length ?? 0, hint: 'Carabobo + Aragua' },
    {
      label: 'tasa BCV',
      value: rate !== undefined && rate !== null ? rate.toFixed(2) : '—',
      hint: config?.base_currency ? `Bs/USD · ${config.base_currency}` : 'sin configurar',
    },
    {
      label: 'outbox',
      value: (pendientes?.length ?? 0) + (fallidos?.length ?? 0),
      hint: fallidos?.length ? `${fallidos.length} fallidos` : 'pendientes de sync',
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="Indicadores"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {kpis.map((k) => (
          <div
            key={k.label}
            className="rounded-xl border border-ink-700 bg-ink-900 p-3.5"
          >
            <p className="font-mono text-[10px] uppercase tracking-wider text-fog-700">{k.label}</p>
            <p className="mt-1 font-mono text-xl tabular-nums text-fog-100">{k.value}</p>
            <p className="mt-0.5 truncate text-[11px] text-fog-500">{k.hint}</p>
          </div>
        ))}
      </section>

      <section aria-label="Scoring de cartera" className="rounded-xl border border-ink-700 bg-ink-900 p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-fog-100">Distribución de score</p>
          <p className="font-mono text-[11px] tabular-nums text-fog-500">
            {conScore.length}/{total} calificados
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {GRADOS.map((g) => {
            const n = porGrado(g);
            const pct = conScore.length ? Math.round((n / conScore.length) * 100) : 0;
            return (
              <div key={g} className="flex items-center gap-3">
                <span className="w-3 shrink-0 font-mono text-[11px] text-signal">{g}</span>
                <div className="h-1.5 flex-1 rounded-full bg-ink-800" aria-hidden="true">
                  <div
                    className="h-1.5 rounded-full bg-signal"
                    style={{ width: `${pct}%` }}
                    aria-hidden="true"
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums text-fog-500">
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="Acciones" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {canEdit && (
          <button
            type="button"
            onClick={onNewCliente}
            className="group flex min-h-20 flex-col items-start justify-between rounded-xl border border-signal bg-ink-900 p-3.5 text-left transition-transform active:scale-[0.98]"
          >
            <span className="text-[13px] font-medium leading-snug text-fog-100">
              Nuevo cliente
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-signal">
              geolocalización
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenBcv}
          className="group flex min-h-20 flex-col items-start justify-between rounded-xl border border-ink-600 bg-ink-900 p-3.5 text-left transition-[transform,background-color,border-color] hover:border-signal active:scale-[0.98]"
        >
          <span className="text-[13px] font-medium leading-snug text-fog-100">
            Configurar tasa BCV
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-signal">
            bimoneda
          </span>
        </button>
        <button
          type="button"
          onClick={onSync}
          className="group flex min-h-20 flex-col items-start justify-between rounded-xl border border-ink-600 bg-ink-900 p-3.5 text-left transition-[transform,background-color,border-color] hover:border-signal active:scale-[0.98]"
        >
          <span className="text-[13px] font-medium leading-snug text-fog-100">Sincronizar</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-signal">
            {ultimaSync ? `última ${ultimaSync}` : 'offline first'}
          </span>
        </button>
      </section>
    </div>
  );
}