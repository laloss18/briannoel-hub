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
import { DateField, FilterBar, FilterChip, FilterGroup, ToolbarFooter } from '../ui/filtros';
import { normaliza } from '../lib/texto';
import { diaLocal, diaLocalHace } from '../lib/fechas';

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
  const [busy, setBusy] = useState<{
    id: string;
    accion: 'entregar' | 'deshacer' | 'eliminar';
  } | null>(null);

  const total = despachos?.length ?? 0;

  const filtrados = useMemo(() => {
    const termino = normaliza(busqueda.trim());
    return (despachos ?? [])
      .filter((d) => {
        const cliente = clientesPorId.get(d.cliente_id);
        const nombre = cliente?.nombre ?? d.cliente_nombre;
        if (estado && d.estado !== estado) return false;
        if (condicion && d.condicion !== condicion) return false;
        if (
          termino &&
          !normaliza(nombre).includes(termino) &&
          !d.nro_control.toLowerCase().includes(termino)
        )
          return false;
        const f = diaLocal(d.created_at);
        if (desde && f < desde) return false;
        if (hasta && f > hasta) return false;
        return true;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [despachos, clientesPorId, busqueda, estado, condicion, desde, hasta]);

  const hayFiltro = Boolean(busqueda || estado || condicion || desde || hasta);
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
      setDesde(diaLocal());
      setHasta(diaLocal());
    } else if (r === '7') {
      setDesde(diaLocalHace(6));
      setHasta(diaLocal());
    } else {
      setDesde(diaLocalHace(29));
      setHasta(diaLocal());
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
      await corregirDespachoLocal(d, {
        estado: 'pedido',
        editor: identidad,
        editor_role: editorRole,
      });
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
          ? {
              label: 'Registrar venta',
              icon: 'plus',
              to: '/ventas/nueva',
              variant: 'primary',
              soloIcono: true,
            }
          : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <FilterBar
          searchValue={busqueda}
          onSearchChange={setBusqueda}
          placeholder="Cliente o nº de control"
          ariaLabel="Buscar por cliente o número de control"
          activos={(estado ? 1 : 0) + (condicion ? 1 : 0) + (desde || hasta ? 1 : 0)}
        >
          <FilterGroup label="Estado">
            <FilterChip active={estado === ''} onClick={() => setEstado('')}>
              Todos
            </FilterChip>
            <FilterChip active={estado === 'pedido'} onClick={() => setEstado('pedido')}>
              Pedido
            </FilterChip>
            <FilterChip active={estado === 'entregado'} onClick={() => setEstado('entregado')}>
              Entregado
            </FilterChip>
            <FilterChip active={estado === 'anulado'} onClick={() => setEstado('anulado')}>
              Anulado
            </FilterChip>
          </FilterGroup>
          <FilterGroup label="Condición">
            <FilterChip active={condicion === ''} onClick={() => setCondicion('')}>
              Todas
            </FilterChip>
            <FilterChip active={condicion === 'credito'} onClick={() => setCondicion('credito')}>
              Crédito
            </FilterChip>
            <FilterChip active={condicion === 'contado'} onClick={() => setCondicion('contado')}>
              Contado
            </FilterChip>
          </FilterGroup>
          <FilterGroup label="Fecha">
            <FilterChip active={rango === FILTROS_HOY} onClick={() => aplicarRango(FILTROS_HOY)}>
              Hoy
            </FilterChip>
            <FilterChip active={rango === '7'} onClick={() => aplicarRango('7')}>
              7 días
            </FilterChip>
            <FilterChip active={rango === '30'} onClick={() => aplicarRango('30')}>
              30 días
            </FilterChip>
          </FilterGroup>
          <div className="grid grid-cols-2 gap-3">
            <DateField
              label="Desde"
              value={desde}
              onChange={(v) => {
                setDesde(v);
                setRango('');
              }}
            />
            <DateField
              label="Hasta"
              value={hasta}
              onChange={(v) => {
                setHasta(v);
                setRango('');
              }}
            />
          </div>
          <ToolbarFooter
            meta={
              <>
                {filtrados.length} de {total}
              </>
            }
            onClear={hayFiltro ? limpiar : undefined}
          />
        </FilterBar>

        {filtrados.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink-700 p-6 text-center">
            <p className="text-sm text-fog-500">
              {total === 0
                ? 'Aún no hay ventas registradas.'
                : 'Ningún despacho coincide con los filtros.'}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1.5">
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
                <li
                  key={d.id}
                  className="flex items-center gap-1 rounded-xl bg-ink-900 px-1.5 py-1.5"
                >
                  <Link
                    to={`/ventas/${d.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-ink-800/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fog-100">
                        {cliente?.nombre ?? d.cliente_nombre}
                      </span>
                      <span className="block truncate font-mono text-2xs text-fog-600">
                        {d.nro_control} · {d.condicion} ·{' '}
                        {new Date(d.created_at).toLocaleDateString('es-VE')}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-mono text-sm tabular-nums text-fog-100">
                        US$ {d.total.toFixed(2)}
                      </span>
                      <ChipEstado estado={d.estado} />
                    </span>
                  </Link>

                  <div className="flex shrink-0 items-center gap-0.5">
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
                      <IconAction
                        label={`Editar ${d.nro_control}`}
                        icon="pencil"
                        to={`/ventas/${d.id}/editar`}
                      />
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
