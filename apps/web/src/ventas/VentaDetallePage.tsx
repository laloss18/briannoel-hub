import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  listDespachos,
  entregarDespachoLocal,
  eliminarDespachoPendienteLocal,
  corregirDespachoLocal,
} from './ventasRepo';
import { listClientes, recalcularScoreDe } from '../clientes/clientesRepo';
import { listZonas } from '../clientes/zonasRepo';
import PageShell, { type PageShellAccion } from '../app/PageShell';
import { useSesion, useMiIdentidad, useIdentidad } from '../app/sesion';
import { hasPermission } from '@brian/shared';
import { puedeGestionarDespacho } from '@brian/ventas';
import { useTasaGate } from '../app/RequireBcvRateGate';
import { useMemo, useState } from 'react';
import { ChipEstado } from '../ui/chips';
import { fechaCorta, haceRelativo } from '../ui/tiempo';
import type { ReactNode } from 'react';

/**
 * Detalle del pedido (DESIGN §5.3). El CRUD se vive en la cabecera de la
 * página (iconos compactos y sin borde, junto al nro_control y el icono del
 * carrito) y el cuerpo se organiza en 4 secciones ordenadas de lo que el
 * operador necesita primero a lo accesorio: 1) resumen de ventas (pedido,
 * cliente, total, saldo a cancelar y estado), 2) detalles de venta
 * (productos, totales, supervisión y entrega), 3) datos de cliente (contacto
 * y ubicación), 4) metadata (auditoría + seguimiento de cambios). El
 * equivalente en Bs se calcula con la tasa BCV vigente (no con el snapshot de
 * registro), porque es el precio de referencia a cancelar del saldo pendiente.
 * Los autores se pintan con su username (no el email), que es la identidad
 * visible (§3.4).
 */
export default function VentaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles, email } = useSesion();
  const identidad = useMiIdentidad();
  const identidadDe = useIdentidad();
  const { tasa: tasaHoy } = useTasaGate();
  const despachos = useLiveQuery(() => listDespachos(), []);
  const clientes = useLiveQuery(() => listClientes(), []);
  const zonas = useLiveQuery(() => listZonas(), []);
  const despacho = useMemo(() => (despachos ?? []).find((d) => d.id === id), [despachos, id]);
  const cliente = useMemo(
    () => (clientes ?? []).find((c) => c.id === despacho?.cliente_id),
    [clientes, despacho],
  );
  const zona = useMemo(
    () => (zonas ?? []).find((z) => z.id === cliente?.zona_id),
    [zonas, cliente],
  );

  const editorRole = roles[0] ?? 'promotor';
  const canDeliver = hasPermission('deliver_dispatch', roles);
  const canDelete = hasPermission('delete_dispatch_pending', roles);
  const esPedido = despacho?.estado === 'pedido';
  const ownership = despacho
    ? puedeGestionarDespacho(despacho, identidad, email, editorRole)
    : false;
  const puedeEditar = ownership && esPedido;
  const puedeEntregar = canDeliver && ownership && esPedido;
  // `corregirDespacho` documenta "solo el admin corrige": la UI valida ese rol.
  const puedeDeshacer = editorRole === 'admin' && ownership && despacho?.estado === 'entregado';
  const puedeEliminar = canDelete && ownership && esPedido;
  const [busy, setBusy] = useState<'entregar' | 'deshacer' | 'eliminar' | null>(null);

  const onEntregar = async () => {
    if (!despacho) return;
    setBusy('entregar');
    try {
      await entregarDespachoLocal(despacho, identidad, editorRole);
      await recalcularScoreDe(despacho.cliente_id);
    } finally {
      setBusy(null);
    }
  };

  const onDeshacer = async () => {
    if (!despacho) return;
    if (!confirm(`¿Deshacer la entrega de ${despacho.nro_control}? Vuelve a "pedido".`)) return;
    setBusy('deshacer');
    try {
      await corregirDespachoLocal(despacho, {
        estado: 'pedido',
        editor: identidad,
        editor_role: editorRole,
      });
      await recalcularScoreDe(despacho.cliente_id);
    } finally {
      setBusy(null);
    }
  };

  const onEliminar = async () => {
    if (!despacho) return;
    if (!confirm(`¿Eliminar el pedido ${despacho.nro_control}?`)) return;
    setBusy('eliminar');
    try {
      await eliminarDespachoPendienteLocal(despacho, email);
      await recalcularScoreDe(despacho.cliente_id);
      navigate('/ventas');
    } finally {
      setBusy(null);
    }
  };

  if (despachos === undefined) {
    return (
      <PageShell eyebrow="detalle de venta" titulo="Cargando" icono="cart">
        <p className="text-sm text-fog-500">Cargando pedido…</p>
      </PageShell>
    );
  }

  if (!despacho) {
    return (
      <PageShell eyebrow="detalle de venta" titulo="No encontrado" icono="cart">
        <p className="text-sm text-fog-500">Este pedido no existe o fue eliminado.</p>
      </PageShell>
    );
  }

  const tasa = tasaHoy !== null && tasaHoy > 0 ? tasaHoy : null;
  const esCredito = despacho.condicion === 'credito' && despacho.estado !== 'anulado';
  const saldoBs = tasa !== null ? despacho.total * tasa : null;
  const hayAcciones = puedeEntregar || puedeDeshacer || puedeEditar || puedeEliminar;

  const notaAcciones =
    despacho.estado === 'entregado'
      ? 'Entregado: registro inmutable. Solo un administrador puede deshacer la entrega.'
      : despacho.estado === 'anulado'
        ? 'Pedido anulado: sin acciones disponibles.'
        : !ownership
          ? 'Este pedido no está a tu cargo; solo consulta.'
          : !esPedido && !canDeliver
            ? 'Tu rol no puede modificar este pedido.'
            : 'Sin acciones disponibles para tu rol.';

  /* Seguimiento: hitos derivados del registro (sin reescribir el historial). */
  const hitos: { cuando: string; etiqueta: string; autor?: string | null; nota?: string }[] = [];
  const pushHito = (
    cuando: string | null | undefined,
    etiqueta: string,
    autor?: string | null,
    nota?: string,
  ) => {
    if (cuando) hitos.push({ cuando, etiqueta, autor, nota });
  };
  pushHito(despacho.created_at, 'pedido registrado', despacho.created_by);
  if (despacho.updated_at && despacho.updated_at > despacho.created_at) {
    pushHito(
      despacho.updated_at,
      despacho.estado === 'anulado' ? 'pedido anulado' : 'última edición',
      despacho.updated_by,
      despacho.estado === 'anulado' ? undefined : `rol: ${despacho.editor_role}`,
    );
  }
  pushHito(despacho.entregado_at, 'entrega confirmada', despacho.entregado_por);
  /* Más reciente → más antiguo. */
  hitos.sort((a, b) => (a.cuando < b.cuando ? 1 : -1));

  const acciones: PageShellAccion[] = [];
  if (puedeEntregar)
    acciones.push({
      label: 'Entregar',
      icon: 'truck',
      variant: 'ok',
      disabled: busy !== null,
      onClick: () => void onEntregar(),
    });
  if (puedeEditar)
    acciones.push({ label: 'Editar pedido', icon: 'pencil', to: `/ventas/${despacho.id}/editar` });
  if (puedeDeshacer)
    acciones.push({
      label: 'Deshacer entrega',
      icon: 'undo',
      disabled: busy !== null,
      onClick: () => void onDeshacer(),
    });
  if (puedeEliminar)
    acciones.push({
      label: 'Eliminar pedido',
      icon: 'trash',
      variant: 'danger',
      disabled: busy !== null,
      onClick: () => void onEliminar(),
    });

  const estadoEntrega =
    despacho.entregado_at !== null && despacho.entregado_at !== undefined
      ? `${haceRelativo(despacho.entregado_at)}${despacho.entregado_por ? ` · ${identidadDe(despacho.entregado_por)}` : ''}`
      : 'pendiente';

  return (
    <PageShell
      eyebrow="detalle de venta"
      titulo={despacho.nro_control}
      icono="cart"
      acciones={acciones}
    >
      <div className="flex flex-col gap-4">
        {!hayAcciones && <p className="text-2xs text-fog-600">{notaAcciones}</p>}

        {/* 1 · Resumen de ventas: pedido, cliente, total, saldo y estado — lo
            primero que el operador quiere saber de un vistazo. */}
        <section className="rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-card">
          <h2 className="font-mono text-2xs uppercase tracking-wider text-fog-600">
            resumen de ventas
          </h2>
          <div className="mt-2 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div>
              <p className="text-lg font-semibold tracking-[-0.01em] text-fog-100">
                {cliente?.nombre ?? despacho.cliente_nombre}
              </p>
              <p className="mt-0.5 font-mono text-2xs uppercase tracking-wider text-fog-600">
                pedido {despacho.nro_control} · {despacho.condicion}
              </p>
            </div>
            <ChipEstado estado={despacho.estado} />
          </div>

          <dl className="mt-3 flex flex-col gap-1 border-t border-ink-800 pt-3">
            <div className="flex justify-between gap-3">
              <dt className="font-mono text-2xs uppercase tracking-wider text-fog-600">total</dt>
              <dd className="font-mono text-3xl tabular-nums text-signal">
                US$ {despacho.total.toFixed(2)}
              </dd>
            </div>
            {esCredito ? (
              <div className="flex justify-between gap-3">
                <dt className="font-mono text-2xs uppercase tracking-wider text-fog-600">
                  saldo a cancelar · crédito
                </dt>
                <dd className="text-right font-mono text-sm tabular-nums text-fog-100">
                  US$ {despacho.total.toFixed(2)}
                  {saldoBs !== null && (
                    <span className="block text-2xs text-fog-500">
                      ≈ Bs {saldoBs.toFixed(2)} · tasa de hoy {tasa!.toFixed(2)}
                    </span>
                  )}
                </dd>
              </div>
            ) : saldoBs !== null ? (
              <div className="flex justify-between gap-3">
                <dt className="font-mono text-2xs uppercase tracking-wider text-fog-600">
                  equivalente
                </dt>
                <dd className="text-right font-mono text-sm tabular-nums text-fog-100">
                  ≈ Bs {saldoBs.toFixed(2)}
                  <span className="block text-2xs text-fog-500">
                    a la tasa de hoy {tasa!.toFixed(2)}
                  </span>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        {/* 2 · Detalles de venta: productos, totales, supervisión y entrega */}
        <section className="rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-card">
          <h2 className="font-mono text-2xs uppercase tracking-wider text-fog-600">
            detalles de venta
          </h2>

          <h3 className="mt-2 font-mono text-2xs uppercase tracking-wider text-fog-600">
            productos · {despacho.lineas.length}
          </h3>
          <div className="mt-1 flex flex-col divide-y divide-ink-800">
            {despacho.lineas.map((l) => (
              <div key={l.item_id} className="flex items-baseline justify-between gap-3 py-2">
                <span className="min-w-0 truncate text-sm font-medium text-fog-100">
                  {l.nombre}
                </span>
                <span className="shrink-0 text-right font-mono text-xs tabular-nums text-fog-500">
                  {l.cantidad} × US${l.precio_unitario.toFixed(2)}
                  <span className="ml-2 text-fog-100">
                    US$ {(l.cantidad * l.precio_unitario).toFixed(2)}
                  </span>
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-1 border-t border-ink-800 pt-3">
            <div className="flex justify-between gap-3">
              <span className="font-mono text-2xs uppercase tracking-wider text-fog-600">
                subtotal
              </span>
              <span className="font-mono text-sm tabular-nums text-fog-100">
                US${despacho.subtotal.toFixed(2)}
              </span>
            </div>
            {(() => {
              const mora = despacho.mora_total_usd ?? 0;
              const iva = despacho.iva_total_usd ?? 0;
              const base = despacho.total - mora - iva;
              const descuentoMonto = Math.max(0, despacho.subtotal - base);
              return (
                <>
                  {descuentoMonto > 0 && (
                    <div className="flex justify-between gap-3 text-danger">
                      <span className="font-mono text-2xs uppercase tracking-wider">
                        descuento{' '}
                        {despacho.descuento_pct > 0
                          ? `${despacho.descuento_pct}%`
                          : `US$${despacho.descuento_monto_usd?.toFixed(2)}`}
                      </span>
                      <span className="font-mono text-sm tabular-nums">
                        −US${descuentoMonto.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {mora > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="font-mono text-2xs uppercase tracking-wider">
                        recargo por mora{' '}
                        {despacho.mora_pct > 0
                          ? `${despacho.mora_pct}%`
                          : `US$${(despacho.mora_monto_usd ?? 0).toFixed(2)}`}
                      </span>
                      <span className="font-mono text-sm tabular-nums text-fog-100">
                        +US${mora.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {iva > 0 && (
                    <div className="flex justify-between gap-3">
                      <span className="font-mono text-2xs uppercase tracking-wider">
                        IVA {despacho.iva_pct}%
                      </span>
                      <span className="font-mono text-sm tabular-nums text-fog-100">
                        +US${iva.toFixed(2)}
                      </span>
                    </div>
                  )}
                </>
              );
            })()}
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-ink-800 pt-2">
              <span className="font-mono text-2xs uppercase tracking-wider text-fog-600">
                total
              </span>
              <span className="font-mono text-lg tabular-nums text-signal">
                US${despacho.total.toFixed(2)}
              </span>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-3 border-t border-ink-800 pt-3 sm:grid-cols-2">
            <Campo label="condición">{despacho.condicion}</Campo>
            <Campo label="promotor">{despacho.promotor ?? identidadDe(despacho.created_by)}</Campo>
            <Campo label="supervisor">{despacho.supervisor ?? '—'}</Campo>
            <Campo label="fecha de entrega">{estadoEntrega}</Campo>
          </dl>
        </section>

        {/* 3 · Datos de cliente: contacto + ubicación */}
        <section className="rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-card">
          <h2 className="font-mono text-2xs uppercase tracking-wider text-fog-600">
            datos de cliente
          </h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Campo label="nombre">{cliente?.nombre ?? despacho.cliente_nombre}</Campo>
            <Campo label="cédula/rif">{cliente?.documento ?? '—'}</Campo>
            <Campo label="teléfono">
              {cliente?.telefono ? (
                <a
                  href={`tel:${cliente.telefono}`}
                  className="underline decoration-ink-600 underline-offset-2 hover:text-signal"
                >
                  {cliente.telefono}
                </a>
              ) : (
                '—'
              )}
              {cliente?.telefono2 ? ` · ${cliente.telefono2}` : ''}
            </Campo>
            <Campo label="zona">
              {zona ? `${zona.nombre} · ${zona.municipio} · ${zona.estado}` : '—'}
            </Campo>
            <Campo label="dirección" className="sm:col-span-2">
              {cliente?.direccion ?? '—'}
            </Campo>
            <Campo label="notas de referencia" className="sm:col-span-2">
              {cliente?.notas_referencia ?? '—'}
            </Campo>
            <Campo label="ubicación" className="sm:col-span-2">
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
                (cliente?.plus_code ?? '—')
              )}
            </Campo>
          </dl>
        </section>

        {/* 4 · Metadata: auditoría + seguimiento (changelog) — lo último, solo
            cuando hace falta auditar. */}
        <section className="rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-card">
          <h2 className="font-mono text-2xs uppercase tracking-wider text-fog-600">metadata</h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Campo label="creado por">{identidadDe(despacho.created_by)}</Campo>
            <Campo label="creado">{fechaCorta(despacho.created_at)}</Campo>
            <Campo label="editado por">
              {despacho.updated_by ? identidadDe(despacho.updated_by) : '—'}
            </Campo>
            <Campo label="editor rol">{despacho.editor_role}</Campo>
            <Campo label="actualizado">{fechaCorta(despacho.updated_at)}</Campo>
          </dl>

          <div className="mt-3 border-t border-ink-800 pt-3">
            <h3 className="font-mono text-2xs uppercase tracking-wider text-fog-600">
              seguimiento · {hitos.length}
            </h3>
            <ol className="mt-3 flex flex-col gap-4 border-l border-ink-700 pl-4">
              {hitos.map((h, i) => (
                <li key={i} className="relative">
                  <span
                    className="absolute -left-[calc(0.5rem+1px)] top-1.5 size-2 rounded-full bg-signal"
                    aria-hidden="true"
                  />
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">
                      {h.etiqueta}
                    </p>
                    <time className="shrink-0 font-mono text-2xs tabular-nums text-fog-500">
                      {fechaCorta(h.cuando)}
                    </time>
                  </div>
                  {(h.autor || h.nota) && (
                    <p className="text-xs text-fog-500">
                      {[h.autor ? identidadDe(h.autor) : '', h.nota].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function Campo({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-mono text-2xs uppercase tracking-wider text-fog-600">{label}</dt>
      <dd className="mt-0.5 text-sm text-fog-100">{children}</dd>
    </div>
  );
}
