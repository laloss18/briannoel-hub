import { useLiveQuery } from 'dexie-react-hooks';
import { hasPermission } from '@brian/shared';
import { listClientes, canEditClientes } from '../clientes/clientesRepo';
import { listDespachos } from '../ventas/ventasRepo';
import { getAppConfig } from '../bimoneda/appConfig';
import { DexieOutbox } from '../sync/db';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../ui/icons';
import { label as labelCls } from '../ui/section';
import { useSesion } from './sesion';
import { usd, dosDecimales } from '../lib/moneda';
import { diaLocal } from '../lib/fechas';

const GRADOS = ['A', 'B', 'C', 'D', 'E'] as const;

/**
 * Inicio «Mi día» (DESIGN §5.11): pantalla de TAREAS, no de datos. Orden fijo:
 * estado de sync → CTA primario «Registrar venta» → acciones del día → métricas
 * **del día**. Rol-aware: con `view_kpis` (admin/supervisor §3.2) se ve la
 * distribución de score; sin él, un resumen del día. Catálogo y Zonas viven en
 * el nav del shell, no compiten con la tarea del día.
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
  const puedeVender = hasPermission('record_sale', roles);

  // Mientras Dexie entrega los datos, no mostramos ceros (parecería "vacío");
  // mostramos el estado de carga (§6.3 full-state-cycle).
  const cargando = clientes === undefined || despachos === undefined || config === undefined;

  const totalClientes = clientes?.length ?? 0;
  const conZona = clientes?.filter((c) => c.zona_id !== null).length ?? 0;
  const conScore = clientes?.filter((c) => c.score_grado !== null) ?? [];
  const porGrado = (g: (typeof GRADOS)[number]) =>
    conScore.filter((c) => c.score_grado === g).length;

  const hoy = diaLocal();
  const ventasHoy = (despachos ?? []).filter(
    (d) => d.estado !== 'anulado' && diaLocal(d.created_at) === hoy,
  );
  const totalHoy = ventasHoy.length;
  const usdHoy = ventasHoy.reduce((a, d) => a + d.total, 0);
  const totalDespachos = despachos?.length ?? 0;
  const porEntregar = despachos?.filter((d) => d.estado === 'pedido').length ?? 0;
  const entregados = despachos?.filter((d) => d.estado === 'entregado').length ?? 0;

  const nPend = pendientes?.length ?? 0;
  const nFail = fallidos?.length ?? 0;

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm text-fog-100">
          Hola, <span className="font-medium">{username ?? email}</span>
        </p>
        <p className={labelCls}>{roles.length ? roles.join(' · ') : 'sin rol'}</p>
      </div>

      <EstadoSync pendientes={nPend} fallidos={nFail} />

      <div className="flex flex-col gap-2">
        {puedeVender && (
          <Link
            to="/ventas/nueva"
            className="btn-lift cta-glow flex min-h-11 items-center justify-center gap-2 rounded-lg bg-signal px-4 py-2.5 text-sm font-semibold text-on-signal transition-colors hover:bg-signal-soft active:scale-[0.99]"
          >
            <Icon name="cart" className="size-5" />
            Registrar venta
          </Link>
        )}
        <nav aria-label="Acciones del día" className="grid grid-cols-2 gap-2">
          {puedeClientes && (
            <AccionDia to="/clientes/nuevo" icon="userPlus" label="Cliente nuevo" />
          )}
          <AccionDia to="/ventas?estado=pedido" icon="truck" label="Entregas por hacer" />
        </nav>
      </div>

      <section aria-label="Mi día" className="flex flex-col gap-2">
        <p className={labelCls}>Mi día · {fecha}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Kpi
            label="Ventas hoy"
            value={totalHoy}
            hint={`${totalDespachos} en total`}
            cargando={cargando}
          />
          <Kpi label="USD hoy" value={usd(usdHoy)} hint="facturado hoy" cargando={cargando} />
          <Kpi
            label="Por entregar"
            value={porEntregar}
            hint={totalDespachos ? `${entregados} entregados` : 'sin ventas'}
            cargando={cargando}
          />
          <Kpi
            label="Tasa BCV"
            value={tasa != null ? dosDecimales(tasa) : '—'}
            hint={origen ? `Bs/USD · ${origen}` : 'sin configurar'}
            cargando={cargando}
          />
        </div>
        <p className="text-2xs text-fog-500">
          {cargando ? '…' : `${totalClientes} clientes · ${conZona} con zona`}
        </p>
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
                      <span className="w-3 shrink-0 font-mono text-2xs text-signal-strong">
                        {g}
                      </span>
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

/** Franja de estado de sync (offline-first como valor visual, DESIGN §5.11):
 *  punto + texto. La ACCIÓN de sincronizar vive en el header del shell (fuente
 *  única) — aquí solo se refleja el estado del outbox. */
function EstadoSync({ pendientes, fallidos }: { pendientes: number; fallidos: number }) {
  const cambios = (n: number) => `${n} ${n === 1 ? 'cambio' : 'cambios'}`;
  const { dot, texto } =
    fallidos > 0
      ? { dot: 'bg-danger', texto: `${cambios(fallidos)} con error` }
      : pendientes > 0
        ? { dot: 'bg-signal', texto: `${cambios(pendientes)} por sincronizar` }
        : { dot: 'bg-ok', texto: 'Todo sincronizado' };
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5"
    >
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      <span className="truncate text-xs text-fog-100">{texto}</span>
    </div>
  );
}

/** Acción del día: acceso secundario compacto, icono neutro (no acento). */
function AccionDia({ to, icon, label }: { to: string; icon: IconName; label: string }) {
  return (
    <Link
      to={to}
      className="card-lift flex min-h-11 items-center gap-2 rounded-xl border border-ink-700 bg-ink-900 px-3 py-2.5 text-xs text-fog-100 transition-colors hover:border-ink-600 active:scale-[0.98]"
    >
      <Icon name={icon} className="size-4 shrink-0 text-fog-300" />
      <span className="truncate">{label}</span>
    </Link>
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
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-3">
      <p className={labelCls}>{label}</p>
      {cargando ? (
        <div className="mt-2 h-5 w-12 animate-pulse rounded bg-ink-800" aria-hidden="true" />
      ) : (
        <p className="mt-1.5 font-mono text-xl tabular-nums text-fog-100">{value}</p>
      )}
      <p className="mt-0.5 truncate text-2xs text-fog-500">{cargando ? '…' : hint}</p>
    </div>
  );
}
