import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import {
  listDespachos,
  entregarDespachoLocal,
  eliminarDespachoPendienteLocal,
  corregirDespachoLocal,
} from './ventasRepo';
import { listClientes, recalcularScoreDe } from '../clientes/clientesRepo';
import PageShell from '../app/PageShell';
import { useSesion, useMiIdentidad } from '../app/sesion';
import { hasPermission, type Despacho } from '@brian/shared';
import { puedeGestionarDespacho } from '@brian/ventas';
import { useMemo, useState } from 'react';
import { ChipEstado } from '../ui/chips';
import { IconAction } from '../ui/actions';
import { Icon } from '../ui/icons';

const normaliza = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** `YYYY-MM-DD` del día local (no UTC: el vendedor filtra por su día). */
const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const diasAtras = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const FILTROS_HOY = 'hoy';
type RangoRapido = '' | typeof FILTROS_HOY | '7' | '30';

/**
 * Listado de ventas (DESIGN §5.2). Filtros visibles: búsqueda, estado,
 * condición y **rango de fechas** con atajos (hoy / 7 / 30 días) — el campo
 * existía en la lógica pero nunca se renderizaba, así que no se podía filtrar
 * por fecha. Cada fila expone acciones rápidas (editar, entregar, deshacer,
 * eliminar) fuera del enlace principal: nunca hay `<a>` dentro de `<a>`.
 */
export default function VentasPage() {
  const { roles, email } = useSesion();
  const despachos = useLiveQuery(() => listDespachos(), []);
  const clientes = useLiveQuery(() => listClientes(), []);
  const clientesPorId = useMemo(() => new Map((clientes ?? []).map((c) => [c.id, c])), [clientes]);
  const canRecord = hasPermission('record_sale', roles);
  const canDeliver = hasPermission('deliver_dispatch', roles);
  const canDelete = hasPermission('delete_dispatch_pending', roles);
const editorRole = roles[0] ?? 'promotor';
  const identidad = useMiIdentidad();

const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [condicion, setCondicion] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [rango, setRango] = useState<RangoRapido>('');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [busy, setBusy] = useState<{ id: string; accion: 'entregar' | 'deshacer' | 'eliminar' } | null>(null);

  const total = despachos?.length ?? 0;

  const filtrados = useMemo(() => {
    const termino = normaliza(busqueda.trim());
    const fechaLocal = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    return (despachos ?? [])
      .filter((d) => {
        const cliente = clientesPorId.get(d.cliente_id);
        const nombre = cliente?.nombre ?? d.cliente_nombre;
        if (estado && d.estado !== estado) return false;
        if (condicion && d.condicion !== condicion) return false;
        if (termino && !normaliza(nombre).includes(termino) && !d.nro_control.toLowerCase().includes(termino)) return false;
        const f = fechaLocal(d.created_at);
        if (desde && f < desde) return false;
        if (hasta && f > hasta) return false;
        return true;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [despachos, clientesPorId, busqueda, estado, condicion, desde, hasta]);

const hayFiltro = Boolean(busqueda || estado || condicion || desde || hasta);
  const activosFiltros = [estado, condicion, desde, hasta].filter(Boolean).length;
  const limpiar = () => {
    setBusqueda('');
    setEstado('');
    setCondicion('');
    setDesde('');
    setHasta('');
    setRango('');
  };

  const aplicarRango = (r: Exclude<RangoRapido, ''>) => {
    if (rango === r) {
      setDesde('');
      setHasta('');
      setRango('');
      return;
    }
    setRango(r);
    if (r === FILTROS_HOY) {
      setDesde(hoyLocal());
      setHasta(hoyLocal());
    } else if (r === '7') {
      setDesde(diasAtras(6));
      setHasta(hoyLocal());
    } else {
      setDesde(diasAtras(29));
      setHasta(hoyLocal());
    }
  };

const onEntregar = async (d: Despacho) => {
    setBusy({ id: d.id, accion: 'entregar' });
    try {
      await entregarDespachoLocal(d, identidad, editorRole);
      await recalcularScoreDe(d.cliente_id);
    } finally {
      setBusy(null);
    }
  };

  const onDeshacer = async (d: Despacho) => {
    if (!confirm(`¿Deshacer la entrega de ${d.nro_control}? Vuelve a "pedido".`)) return;
    setBusy({ id: d.id, accion: 'deshacer' });
    try {
      await corregirDespachoLocal(d, { estado: 'pedido', editor: identidad, editor_role: editorRole });
      await recalcularScoreDe(d.cliente_id);
    } finally {
      setBusy(null);
    }
  };

  const onEliminar = async (d: Despacho) => {
    if (!confirm(`¿Eliminar el pedido ${d.nro_control}?`)) return;
    setBusy({ id: d.id, accion: 'eliminar' });
    try {
      await eliminarDespachoPendienteLocal(d, email);
      await recalcularScoreDe(d.cliente_id);
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageShell
      titulo="Ventas"
      icono="cart"
      volverA="/"
accion={
        canRecord
          ? { label: 'Registrar venta', icon: 'plus', to: '/ventas/nueva', variant: 'primary', soloIcono: true }
          : undefined
      }
    >
      <div className="flex flex-col gap-4">
<section className="rounded-xl border border-ink-700 bg-ink-900 p-3 shadow-card">
          <div className="flex items-center gap-2">
            <input
              type="search"
              placeholder="Cliente o nº de control"
              aria-label="Buscar por cliente o número de control"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors placeholder:text-fog-600 focus:border-signal"
            />
            <button
              type="button"
              aria-expanded={filtrosAbiertos}
              aria-label={filtrosAbiertos ? 'Ocultar filtros' : 'Mostrar filtros'}
              onClick={() => setFiltrosAbiertos((v) => !v)}
              className="btn-lift flex size-11 shrink-0 items-center justify-center gap-1 rounded-full text-fog-300 transition-colors hover:bg-ink-800 hover:text-fog-100"
            >
              <Icon name="filter" />
              {activosFiltros > 0 && (
                <span
                  aria-hidden="true"
                  className="flex min-w-4 items-center justify-center rounded-full bg-signal px-1 font-mono text-2xs tabular-nums text-ink-950"
                >
                  {activosFiltros}
                </span>
              )}
              <Icon
                name="chevronDown"
                className={`size-3.5 transition-transform ${filtrosAbiertos ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {filtrosAbiertos && (
            <div className="mt-3 flex flex-col gap-2 border-t border-ink-800 pt-3">
              <div className="flex flex-wrap gap-1.5">
                <select
                  aria-label="Filtrar por estado"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="rounded-md border border-ink-600 bg-ink-950 px-2 py-2 text-xs text-fog-100 outline-none transition-colors focus:border-signal"
                >
                  <option value="">estado</option>
                  <option value="pedido">pedido</option>
                  <option value="entregado">entregado</option>
                  <option value="anulado">anulado</option>
                </select>
                <div className="flex overflow-hidden rounded-md border border-ink-600" role="group" aria-label="Filtrar por condición">
                  {(
                    [
                      ['', 'condición'],
                      ['credito', 'crédito'],
                      ['contado', 'contado'],
                    ] as const
                  ).map(([valor, label]) => (
                    <button
                      key={valor}
                      type="button"
                      aria-pressed={condicion === valor}
                      onClick={() => setCondicion(valor)}
                      className={`px-2 py-2 text-xs transition-colors ${
                        condicion === valor
                          ? 'bg-signal text-ink-950'
                          : 'text-fog-100 hover:bg-ink-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label className="flex flex-1 items-center gap-1.5 rounded-md border border-ink-600 bg-ink-950 px-2 py-1 text-2xs text-fog-500 focus-within:border-signal">
                  <span className="font-mono uppercase tracking-wider">desde</span>
                  <input
                    type="date"
                    value={desde}
                    onChange={(e) => {
                      setDesde(e.target.value);
                      setRango('');
                    }}
                    className="min-w-0 flex-1 bg-transparent py-1 font-mono text-xs text-fog-100 outline-none"
                  />
                </label>
                <label className="flex flex-1 items-center gap-1.5 rounded-md border border-ink-600 bg-ink-950 px-2 py-1 text-2xs text-fog-500 focus-within:border-signal">
                  <span className="font-mono uppercase tracking-wider">hasta</span>
                  <input
                    type="date"
                    value={hasta}
                    onChange={(e) => {
                      setHasta(e.target.value);
                      setRango('');
                    }}
                    className="min-w-0 flex-1 bg-transparent py-1 font-mono text-xs text-fog-100 outline-none"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  [FILTROS_HOY, 'Hoy'],
                  ['7', '7 días'],
                  ['30', '30 días'],
                ] as const).map(([valor, label]) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={rango === valor}
                    onClick={() => aplicarRango(valor)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      rango === valor
                        ? 'border-signal bg-signal/10 text-signal'
                        : 'border-ink-600 text-fog-100 hover:bg-ink-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
                {hayFiltro && (
                  <button
                    type="button"
                    onClick={limpiar}
                    className="rounded-full border border-ink-600 px-3 py-1.5 text-xs font-medium text-fog-100 transition-colors hover:bg-ink-800"
                  >
                    Limpiar
                  </button>
                )}
                <span className="ml-auto font-mono text-2xs tabular-nums text-fog-600" aria-live="polite">
                  {filtrados.length} de {total}
                </span>
              </div>
            </div>
          )}
        </section>

{filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-700 p-6 text-center">
            <p className="text-sm text-fog-500">
              {total === 0 ? 'Aún no hay ventas registradas.' : 'Ningún despacho coincide con los filtros.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-ink-700/60 border-y border-ink-700/60">
            {filtrados.map((d) => {
              const cliente = clientesPorId.get(d.cliente_id);
              const owner = puedeGestionarDespacho(d, identidad, email, editorRole);
              const esPedido = d.estado === 'pedido';
              const showEditar = canRecord && owner && esPedido;
              const showEntregar = canDeliver && owner && esPedido;
              const showDeshacer = editorRole === 'admin' && owner && d.estado === 'entregado';
              const showEliminar = canDelete && owner && esPedido;
              const ocupado = busy?.id === d.id;

              return (
                <li key={d.id} className="flex items-center gap-1">
                  <Link
                    to={`/ventas/${d.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-l-md py-2.5 pr-1 transition-colors hover:bg-ink-800/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fog-100">
                        {cliente?.nombre ?? d.cliente_nombre}
                      </span>
                      <span className="block truncate font-mono text-2xs text-fog-600">
                        {d.nro_control} · {d.condicion} · {new Date(d.created_at).toLocaleDateString('es-VE')}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-sm tabular-nums text-fog-100">
                        US$ {d.total.toFixed(2)}
                      </span>
                      <ChipEstado estado={d.estado} />
                    </span>
                  </Link>

<div className="flex shrink-0 items-center gap-1 py-2">
                    {showEntregar && (
                      <IconAction
                        label={`Entregar ${d.nro_control}`}
                        icon="truck"
                        variant="ok"
                        disabled={ocupado}
                        onClick={() => void onEntregar(d)}
                      />
                    )}
                    {showDeshacer && (
                      <IconAction
                        label={`Deshacer entrega de ${d.nro_control}`}
                        icon="undo"
                        disabled={ocupado}
                        onClick={() => void onDeshacer(d)}
                      />
                    )}
                    {showEditar && (
                      <IconAction label={`Editar ${d.nro_control}`} icon="pencil" to={`/ventas/${d.id}/editar`} />
                    )}
                    {showEliminar && (
                      <IconAction
                        label={`Eliminar ${d.nro_control}`}
                        icon="trash"
                        variant="danger"
                        disabled={ocupado}
                        onClick={() => void onEliminar(d)}
                      />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
