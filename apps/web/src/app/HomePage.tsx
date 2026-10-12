import { useLiveQuery } from 'dexie-react-hooks';
import { hasPermission } from '@brian/shared';
import { listClientes, canEditClientes } from '../clientes/clientesRepo';
import { listDespachos } from '../ventas/ventasRepo';
import { getAppConfig } from '../bimoneda/appConfig';
import { DexieOutbox } from '../sync/db';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../ui/icons';
import { useSesion } from './sesion';
import { dosDecimales } from '../lib/moneda';

const GRADOS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Acciones compactas: icono + rótulo corto, grid estable (sin tarjetas gigantes). */
interface Accion {
  label: string;
  to: string;
  icon: IconName;
  soloSi?: boolean;
}

const ACCIONES: readonly Accion[] = [
  { label: 'Registrar venta', to: '/ventas/nueva', icon: 'cart' },
  { label: 'Nuevo cliente', to: '/clientes/nuevo', icon: 'userPlus', soloSi: true },
  { label: 'Catálogo', to: '/catalogo', icon: 'package' },
  { label: 'Zonas', to: '/zonas', icon: 'map' },
];

/**
 * Inicio del hub: acciones compactas arriba (icono + rótulo), luego los
 * indicadores. Es rol-aware: con `view_kpis` (admin/supervisor §3.2) se ve el
 * resumen con distribución de score; sin él, el histórico de operaciones del
 * dispositivo. Sin "módulo" en el copy (DESIGN §9: la UI habla de secciones).
 */
export default function HomePage() {
  const { roles, username, email } = useSesion();
  const clientes = useLiveQuery(() => listClientes(), []);
  const despachos = useLiveQuery(() => listDespachos(), []);
  const config = useLiveQuery(() => getAppConfig(), []);
  const pendientes = useLiveQuery(() => new DexieOutbox().list('pending'), []);
  const fallidos = useLiveQuery(() => new DexieOutbox().list('failed'), []);

  const puedeKpis = hasPermission('view_kpis', roles);
  const puedeClientes = canEditClientes(roles);

  const totalClientes = clientes?.length ?? 0;
  const conZona = clientes?.filter((c) => c.zona_id !== null).length ?? 0;
  const conScore = clientes?.filter((c) => c.score_grado !== null) ?? [];
  const porGrado = (g: (typeof GRADOS)[number]) =>
    conScore.filter((c) => c.score_grado === g).length;

  const totalDespachos = despachos?.length ?? 0;
  const porEntregar = despachos?.filter((d) => d.estado === 'pedido').length ?? 0;
  const entregados = despachos?.filter((d) => d.estado === 'entregado').length ?? 0;
  const porSincronizar = (pendientes?.length ?? 0) + (fallidos?.length ?? 0);

  // Mientras Dexie entrega los datos, no mostramos ceros (parecería "vacío");
  // mostramos el estado de carga (§6.3 full-state-cycle).
  const cargando = clientes === undefined || despachos === undefined || config === undefined;

  const tasa = config?.bcv_rate;
  const origen =
    config?.bcv_rate_source === 'BCV_API'
      ? 'oficial'
      : config?.bcv_rate_source === 'manual'
        ? 'manual'
        : null;

  const fecha = new Date().toLocaleDateString('es-VE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const acciones = ACCIONES.filter((a) => (a.soloSi ? puedeClientes : true));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-fog-100">
          Hola, <span className="font-medium">{username ?? email}</span>
        </p>
        <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">
          {roles.length ? roles.join(' · ') : 'sin rol'}
        </p>
      </div>

      <nav aria-label="Acciones rápidas" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {acciones.map((a) => (
          <Link
            key={a.to}
            to={a.to}
            className="card-lift flex min-h-11 items-center gap-2 rounded-md border border-ink-700 bg-ink-900 px-3 py-2.5 text-xs text-fog-100 transition-colors hover:border-ink-600 active:scale-[0.98]"
          >
            <Icon name={a.icon} className="size-4 shrink-0 text-signal" />
            <span className="truncate">{a.label}</span>
          </Link>
        ))}
      </nav>

      <section aria-label="Indicadores" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi
          label="clientes"
          value={totalClientes}
          hint={conZona ? `${conZona} con zona` : 'sin zona'}
          cargando={cargando}
        />
        <Kpi
          label="despachos"
          value={totalDespachos}
          hint={
            totalDespachos ? `${porEntregar} por entregar · ${entregados} entregados` : 'sin ventas'
          }
          cargando={cargando}
        />
        <Kpi
          label="tasa BCV"
          value={tasa != null ? dosDecimales(tasa) : '—'}
          hint={origen ? `Bs/USD · ${origen}` : 'sin configurar'}
          cargando={cargando}
        />
        <Kpi
          label="por sincronizar"
          value={porSincronizar}
          hint={fallidos?.length ? `${fallidos.length} fallidos` : 'todo al día'}
          cargando={cargando}
        />
      </section>

      {puedeKpis ? (
        <section
          aria-label="Distribución de score"
          className="rounded-xl border border-ink-700 bg-ink-900 p-4"
        >
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs font-medium text-fog-100">Distribución de score</p>
            <p className="font-mono text-2xs tabular-nums text-fog-500">
              {cargando ? '…' : `${conScore.length}/${totalClientes} calificados`}
            </p>
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {cargando
              ? GRADOS.map((g) => (
                  <div
                    key={g}
                    className="h-1.5 animate-pulse rounded-full bg-ink-800"
                    aria-hidden="true"
                  />
                ))
              : GRADOS.map((g) => {
                  const n = porGrado(g);
                  const pct = conScore.length ? Math.round((n / conScore.length) * 100) : 0;
                  return (
                    <div key={g} className="flex items-center gap-3">
                      <span className="w-3 shrink-0 font-mono text-2xs text-signal">{g}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-ink-800" aria-hidden="true">
                        <div
                          className="h-1.5 rounded-full bg-signal"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right font-mono text-2xs tabular-nums text-fog-500">
                        {n}
                      </span>
                    </div>
                  );
                })}
          </div>
        </section>
      ) : (
        <section
          aria-label="Resumen del día"
          className="flex flex-col gap-1.5 rounded-xl border border-ink-700 bg-ink-900 p-4"
        >
          <p className="text-xs font-medium text-fog-100">{cargando ? 'Cargando…' : fecha}</p>
          <p className="text-xs text-fog-500">
            {cargando
              ? ''
              : totalDespachos === 0
                ? 'Aún no registras ventas hoy. Empieza por "Registrar venta".'
                : `${entregados} de ${totalDespachos} despachos entregados.`}
          </p>
        </section>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  cargando,
}: {
  label: string;
  value: number | string;
  hint: string;
  cargando?: boolean;
}) {
  return (
    <div className="rounded-md border border-ink-700 bg-ink-900 p-3">
      <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">{label}</p>
      {cargando ? (
        <div className="mt-2 h-5 w-12 animate-pulse rounded bg-ink-800" aria-hidden="true" />
      ) : (
        <p className="mt-1.5 font-mono text-xl tabular-nums text-fog-100">{value}</p>
      )}
      <p className="mt-0.5 truncate text-2xs text-fog-500">{cargando ? '…' : hint}</p>
    </div>
  );
}
