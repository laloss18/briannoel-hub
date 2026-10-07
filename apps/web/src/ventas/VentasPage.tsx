import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { listDespachos } from './ventasRepo';
import { listClientes } from '../clientes/clientesRepo';
import PageShell from '../app/PageShell';
import { useSesion } from '../app/sesion';
import { hasPermission } from '@brian/shared';
import { useMemo, useState } from 'react';

const normaliza = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export default function VentasPage() {
  const { roles } = useSesion();
  const despachos = useLiveQuery(() => listDespachos(), []);
  const clientes = useLiveQuery(() => listClientes(), []);
  const clientesPorId = useMemo(() => new Map((clientes ?? []).map((c) => [c.id, c])), [clientes]);
  const canRecord = hasPermission('record_sale', roles);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('');
  const [condicion, setCondicion] = useState('');
  const [desde] = useState('');
  const [hasta] = useState('');

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

  return (
    <PageShell
      titulo="Ventas"
      icono="cart"
      volverA="/"
      accion={canRecord ? { label: 'Registrar venta', icon: 'plus', to: '/ventas/nueva' } : undefined}
    >
      <div className="flex flex-col gap-4">
        <p className="font-mono text-xs tabular-nums text-fog-500">
          {total} despacho{total === 1 ? '' : 's'}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="search"
            placeholder="Cliente o nº de control"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="min-w-40 flex-1 rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-fog-100 outline-none transition-colors placeholder:text-fog-600 focus:border-ink-600"
          />
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-fog-100 outline-none transition-colors focus:border-ink-600"
          >
            <option value="">estado</option>
            <option value="pedido">pedido</option>
            <option value="entregado">entregado</option>
            <option value="anulado">anulado</option>
          </select>
          <select
            value={condicion}
            onChange={(e) => setCondicion(e.target.value)}
            className="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-fog-100 outline-none transition-colors focus:border-ink-600"
          >
            <option value="">condición</option>
            <option value="credito">crédito</option>
            <option value="contado">contado</option>
          </select>
        </div>
        <ul className="flex flex-col divide-y divide-ink-700/60 border-y border-ink-700/60">
          {filtrados.map((d) => {
            const cliente = clientesPorId.get(d.cliente_id);
            return (
              <li key={d.id}>
                <Link
                  to={`/ventas/${d.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-ink-950/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fog-100">
                      {cliente?.nombre ?? d.cliente_nombre}
                    </span>
                    <span className="block truncate font-mono text-xs text-fog-500">
                      {d.nro_control} · {d.condicion} · {new Date(d.created_at).toLocaleDateString('es-VE')}
                    </span>
                  </span>
                  <span className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${
                    d.estado === 'entregado'
                      ? 'border-ok/40 text-ok'
                      : d.estado === 'pedido'
                        ? 'border-signal/40 text-signal'
                        : 'border-ink-700 text-fog-600'
                  }`}>
                    {d.estado}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </PageShell>
  );
}