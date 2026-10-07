import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { listDespachos, entregarDespachoLocal, eliminarDespachoPendienteLocal } from './ventasRepo';
import { listClientes } from '../clientes/clientesRepo';
import { listZonas } from '../clientes/zonasRepo';
import PageShell from '../app/PageShell';
import { useSesion } from '../app/sesion';
import { hasPermission } from '@brian/shared';
import { puedeGestionarDespacho } from '@brian/ventas';
import { useMemo, useState } from 'react';

export default function VentaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles, email } = useSesion();
  const despachos = useLiveQuery(() => listDespachos(), []);
  const clientes = useLiveQuery(() => listClientes(), []);
  const zonas = useLiveQuery(() => listZonas(), []);
  const despacho = useMemo(() => (despachos ?? []).find((d) => d.id === id), [despachos, id]);
  const cliente = useMemo(() => (clientes ?? []).find((c) => c.id === despacho?.cliente_id), [clientes, despacho]);
  const zona = useMemo(() => (zonas ?? []).find((z) => z.id === cliente?.zona_id), [zonas, cliente]);

  const editorRole = roles[0] ?? 'promotor';
  const identidad = email;
  const canDeliver = hasPermission('deliver_dispatch', roles);
  const canDelete = hasPermission('delete_dispatch_pending', roles);
  const gestionable = despacho ? despacho.estado === 'pedido' && puedeGestionarDespacho(despacho, identidad, email, editorRole) : false;
  const [busy, setBusy] = useState(false);

  const onEntregar = async () => {
    if (!despacho) return;
    setBusy(true);
    try {
      await entregarDespachoLocal(despacho, identidad, editorRole);
    } finally {
      setBusy(false);
    }
  };

  const onEliminar = async () => {
    if (!despacho) return;
    if (!confirm(`¿Eliminar el pedido ${despacho.nro_control}?`)) return;
    setBusy(true);
    try {
      await eliminarDespachoPendienteLocal(despacho, email);
      navigate('/ventas');
    } finally {
      setBusy(false);
    }
  };

  if (despachos === undefined) {
    return (
      <PageShell titulo="Detalle de venta" icono="cart" volverA="/ventas">
        <p className="text-xs text-fog-600">Cargando…</p>
      </PageShell>
    );
  }

  if (!despacho) {
    return (
      <PageShell titulo="Detalle de venta" icono="cart" volverA="/ventas">
        <p className="text-xs text-fog-600">Despacho no encontrado.</p>
      </PageShell>
    );
  }

  const fechaCompleta = (iso: string) =>
    new Date(iso).toLocaleString('es-VE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <PageShell
      titulo={`Pedido ${despacho.nro_control}`}
      icono="cart"
      volverA="/ventas"
      accion={
        gestionable
          ? { label: 'Editar', icon: 'pencil', to: `/ventas/${despacho.id}/editar` }
          : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <section className="rounded-md border border-ink-700/60 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-fog-100">Cliente</p>
          <div className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">nombre</span>
              <span className="text-sm text-fog-100">{cliente?.nombre ?? despacho.cliente_nombre}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">cédula/rif</span>
              <span className="text-sm text-fog-100">{cliente?.documento ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">teléfono</span>
              <span className="text-sm text-fog-100">
                {cliente?.telefono ? (
                  <a href={`tel:${cliente.telefono}`} className="underline decoration-ink-600 underline-offset-2 hover:text-signal">
                    {cliente.telefono}
                  </a>
                ) : (
                  '—'
                )}
                {cliente?.telefono2 ? ` · ${cliente.telefono2}` : ''}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">zona</span>
              <span className="text-sm text-fog-100">{zona?.nombre ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">dirección</span>
              <span className="text-sm text-fog-100">{cliente?.direccion ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">ubicación</span>
              <span className="text-sm text-fog-100">
                {cliente?.lat != null && cliente?.lng != null ? (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${cliente.lat}&mlon=${cliente.lng}#map=17/${cliente.lat}/${cliente.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-signal underline decoration-ink-600 underline-offset-2"
                  >
                    {cliente.lat.toFixed(5)}, {cliente.lng.toFixed(5)}
                  </a>
                ) : (
                  cliente?.plus_code ?? '—'
                )}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-ink-700/60 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-fog-100">Líneas</p>
          <div className="mt-2 flex flex-col divide-y divide-ink-800/60">
            {despacho.lineas.map((l) => (
              <div key={l.item_id} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="min-w-0 truncate text-[13px] font-medium text-fog-100">{l.nombre}</span>
                <span className="shrink-0 font-mono text-xs text-fog-500 tabular-nums">
                  {l.cantidad} × US${l.precio_unitario.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-col gap-1 border-t border-ink-800 pt-2">
            <div className="flex justify-between gap-3">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">subtotal</span>
              <span className="font-mono text-[13px] tabular-nums text-fog-100">US${despacho.subtotal.toFixed(2)}</span>
            </div>
            {(despacho.descuento_pct > 0 || (despacho.descuento_monto_usd ?? 0) > 0) && (
              <div className="flex justify-between gap-3 text-danger">
                <span className="font-mono text-xs uppercase tracking-wider">
                  descuento {despacho.descuento_pct > 0 ? `${despacho.descuento_pct}%` : `US$${despacho.descuento_monto_usd?.toFixed(2)}`}
                </span>
                <span className="font-mono text-[13px] tabular-nums">−US${(despacho.subtotal - despacho.total).toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3 border-t border-ink-800 pt-1.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">total</span>
              <span className="font-mono text-base tabular-nums text-signal">US${despacho.total.toFixed(2)}</span>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          {canDeliver && gestionable && (
            <button
              onClick={onEntregar}
              disabled={busy}
              className="rounded-md border border-ok/60 px-3 py-1.5 text-sm font-medium text-fog-100 transition-colors hover:border-ok disabled:opacity-50"
            >
              {busy ? 'Guardando…' : 'Entregar'}
            </button>
          )}
          {canDelete && gestionable && (
            <button
              onClick={onEliminar}
              disabled={busy}
              className="rounded-md border border-danger/60 px-3 py-1.5 text-sm font-medium text-fog-100 transition-colors hover:border-danger disabled:opacity-50"
            >
              {busy ? 'Eliminando…' : 'Eliminar'}
            </button>
          )}
          <Link
            to={`/ventas/${despacho.id}/editar`}
            className="rounded-md border border-ink-600 px-3 py-1.5 text-sm font-medium text-fog-100 transition-colors hover:border-ink-500"
          >
            Editar
          </Link>
        </div>

        <section className="rounded-md border border-ink-700/60 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-fog-100">Detalles</p>
          <div className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">estado</span>
              <span className="text-sm text-fog-100">{despacho.estado}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">condición</span>
              <span className="text-sm text-fog-100">{despacho.condicion}</span>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">registrado</span>
              <span className="text-sm text-fog-100">{fechaCompleta(despacho.created_at)}</span>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">entregado</span>
              <span className="text-sm text-fog-100">{despacho.entregado_at ? fechaCompleta(despacho.entregado_at) : 'pendiente'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">promotor</span>
              <span className="text-sm text-fog-100">{despacho.promotor ?? cliente?.created_by ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">supervisor</span>
              <span className="text-sm text-fog-100">{despacho.supervisor ?? '—'}</span>
            </div>
          </div>
        </section>
      </div>
    </PageShell>
  );
}