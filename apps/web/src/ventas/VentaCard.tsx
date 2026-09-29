import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Cliente, Item, Role } from '@brian/shared';
import { hasPermission } from '@brian/shared';
import { getBcvRate } from '../bimoneda/appConfig';
import { listClientes } from '../clientes/clientesRepo';
import {
  crearDespachoLocal,
  eliminarDespachoPendienteLocal,
  entregarDespachoLocal,
  listDespachos,
} from './ventasRepo';
import { listItems } from './itemsRepo';
import { VentaForm, type VentaFormInput } from './VentaForm';

interface VentaCardProps {
  roles: readonly Role[];
  /** Email del usuario de la sesión activa para auditoría (§3.1). */
  email: string;
}

/**
 * Módulo Ventas / despachos (PRD §2.2, §2.6): toma de pedido por el promotor,
 * entrega por el supervisor (inmutable, §2.6) y eliminación de pedido pendiente
 * (Admin/Supervisor/Promotor, `delete_dispatch_pending` §3.3). Sale de contado
 * y a crédito con snapshot de la tasa BCV.
 */
export default function VentaCard({ roles, email }: VentaCardProps) {
  const despachos = useLiveQuery(() => listDespachos(), []);
  const clientes = useLiveQuery(() => listClientes(), []);
  const items = useLiveQuery(() => listItems(), []);
  const [formOpen, setFormOpen] = useState(false);

  const canRecord = hasPermission('record_sale', roles);
  const canDeliver = hasPermission('deliver_dispatch', roles);
  const canDelete = hasPermission('delete_dispatch_pending', roles);
  const editorRole = roles[0] ?? 'promotor';

  const total = despachos?.length ?? 0;
  const pendientes = despachos?.filter((d) => d.estado === 'pedido').length ?? 0;
  const entregados = despachos?.filter((d) => d.estado === 'entregado').length ?? 0;

  const onSubmit = async (form: VentaFormInput) => {
    await crearDespachoLocal({ ...form, vendedor: email, editor_role: editorRole });
  };

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Ventas · despachos</p>
          <p className="mt-1 text-xs text-fog-500">
            {total} despacho{total === 1 ? '' : 's'} · {pendientes} pendiente{pendientes === 1 ? '' : 's'} de
            entrega · {entregados} entregado{entregados === 1 ? '' : 's'}
          </p>
        </div>
        {canRecord && (
          <button
            onClick={async () => {
              // Sin tasa BCV no se puede facturar (snapshot, §2.6); avisa antes de abrir.
              const rate = await getBcvRate();
              if (rate === null) {
                window.alert('Configura primero la tasa BCV en Configuración (snapshot del despacho §2.6).');
                return;
              }
              setFormOpen(true);
            }}
            className="rounded-md border border-signal px-3 py-1.5 text-sm font-medium text-signal transition-colors hover:bg-signal hover:text-ink-950"
          >
            Registrar venta
          </button>
        )}
      </div>

      {(!clientes || clientes.length === 0) && (
        <p className="mt-3 text-xs text-fog-700">
          Registra clientes primero: una venta siempre referencia un cliente del mirror local.
        </p>
      )}
      {(!items || items.length === 0) && (
        <p className="mt-3 text-xs text-fog-700">
          El catálogo de ítems está vacío: el administrador debe cargar el catálogo (sync) para poder vender.
        </p>
      )}
      {items && items.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          <p className="font-mono text-[10px] uppercase tracking-wider text-fog-700">catálogo</p>
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between gap-3 border-t border-ink-700/60 pt-1.5">
              <p className="truncate text-[13px] font-medium">{i.nombre}</p>
              <p className="shrink-0 font-mono text-[10px] tabular-nums text-fog-500">
                C {i.precio_credito_mayor.toFixed(2)} · {i.precio_contado_detal.toFixed(2)} D
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {despachos && despachos.length === 0 && (
          <p className="text-xs text-fog-700">
            Sin despachos todavía. Sincroniza tras registrar ya la entrada en el outbox.
          </p>
        )}
        {despachos?.map((d) => {
          const cliente = clientes?.find((c) => c.id === d.cliente_id);
          return (
            <div key={d.id} className="flex flex-col gap-2 border-t border-ink-700/60 pt-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium">
                    {cliente?.nombre ?? d.cliente_nombre}
                  </p>
                  <p className="truncate font-mono text-[10px] text-fog-700">
                    {d.nro_control} · {d.condicion} · {d.canal} ·{' '}
                    {new Date(d.updated_at).toLocaleString('es-VE', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${
                      d.estado === 'entregado'
                        ? 'border-ok/40 text-ok'
                        : d.estado === 'pedido'
                          ? 'border-signal/40 text-signal'
                          : 'border-ink-700 text-fog-700'
                    }`}
                  >
                    {d.estado}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums">{d.total.toFixed(2)}</span>
                </div>
              </div>
              <div className="flex w-fit flex-wrap items-center gap-1.5">
                {canDeliver && d.estado === 'pedido' && (
                  <button
                    type="button"
                    onClick={() => void entregarDespachoLocal(d, email, editorRole)}
                    className="rounded-md border border-ink-600 px-2 py-0.5 font-mono text-[10px] text-fog-100 transition-colors hover:border-ok"
                  >
                    entregar
                  </button>
                )}
                {canDelete && d.estado === 'pedido' && (
                  <button
                    type="button"
                    onClick={() => void eliminarDespachoPendienteLocal(d, email)}
                    className="rounded-md border border-ink-600 px-2 py-0.5 font-mono text-[10px] text-fog-100 transition-colors hover:border-danger"
                  >
                    eliminar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <VentaForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        roles={roles}
        clientes={clientes ?? []}
        items={items ?? []}
        email={email}
        onSubmit={onSubmit}
      />
    </div>
  );
}

export type { Cliente, Item };