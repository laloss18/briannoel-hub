import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { OutboxEntry, SyncRecord, SyncEvent } from '@brian/sync-engine';
import { hub } from '../sync/db';

interface Fila {
  id: string;
  at: string;
  label: string;
  detail: string;
  state: 'ok' | 'pendiente' | 'fallo' | 'evento';
}

/** El payload de la operación se esparce en el registro (createOutboxEntry). */
interface ClienteOp extends SyncRecord {
  nombre?: string;
}

function toLabel(op: OutboxEntry): { label: string; detail: string } {
  const entidad =
    op.entity === 'clientes'
      ? 'cliente'
      : op.entity === 'zonas'
        ? 'zona'
        : op.entity === 'app_config'
          ? 'configuración'
          : op.entity;
  const accion = op.operation === 'create' ? 'creado' : op.operation === 'update' ? 'editado' : op.operation;
  const nombre = (op as ClienteOp).nombre;
  return { label: `${entidad} ${accion}`, detail: nombre ? nombre : '' };
}

function toEventLabel(e: SyncEvent): { label: string; detail: string } {
  const tipo =
    e.type === 'success' ? 'sync completada' : e.type === 'push' ? 'push' : e.type === 'pull' ? 'pull' : e.type;
  return { label: tipo, detail: e.detail ?? '' };
}

/**
 * Histórico de operaciones de la home (roles sin `view_kpis`): las operaciones
 * reales que ya se pueden registrar hoy (outbox: clientes/zonas/config, sync
 * events). Muestra 5 registros con lazy loading (cargar más bajo demanda). El
 * CTA "Registrar venta" queda listo pero marcado fase 3 · pendiente hasta
 * construir el módulo de ventas/despachos.
 */
const PAGE = 5;

export default function HomeHistorial() {
  const outbox = useLiveQuery(() => hub.outbox.orderBy('updated_at').reverse().limit(30).toArray(), []);
  const events = useLiveQuery(
    () => hub.events.orderBy('created_at').reverse().limit(30).toArray(),
    [],
  );
  const [visible, setVisible] = useState(PAGE);

  const todas: Fila[] = [
    ...(outbox ?? []).map<Fila>((op) => {
      const t = toLabel(op);
      return {
        id: op.op_id,
        at: op.updated_at,
        label: t.label,
        detail: t.detail,
        state: op.status === 'synced' ? 'ok' : op.status === 'failed' ? 'fallo' : 'pendiente',
      };
    }),
    ...(events ?? []).map<Fila>((e) => {
      const t = toEventLabel(e);
      return {
        id: `ev-${e.id}`,
        at: e.created_at,
        label: t.label,
        detail: t.detail,
        state: 'evento' as const,
      };
    }),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const filas = todas.slice(0, visible);
  const hasMore = todas.length > visible;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-fog-100">Registrar venta</p>
        <button
          type="button"
          disabled
          aria-disabled="true"
          className="cursor-default rounded-md border border-ink-700/50 px-3 py-1.5 text-sm font-medium text-fog-700"
          title="El módulo de ventas/despachos es la Fase 3"
        >
          fase 3 · pendiente
        </button>
      </div>

      <section aria-label="Histórico de operaciones" className="rounded-xl border border-ink-700 bg-ink-900 p-4">
        <p className="text-sm font-medium text-fog-100">Operaciones recientes</p>
        <p className="mt-1 text-xs text-fog-500">
          {filas.length ? 'Registro local: cambios y sincronizaciones de este dispositivo.' : 'Sin operaciones aún.'}
        </p>

        <div className="mt-3 flex flex-col gap-2">
          {filas.length === 0 && (
            <p className="border-t border-ink-700/60 pt-2 text-xs text-fog-700">
              Cuando crees un cliente, cambies la configuración o sincronices, aparecerá aquí.
            </p>
          )}
          {filas.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 border-t border-ink-700/60 pt-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium capitalize text-fog-100">{f.label}</p>
                {f.detail && <p className="truncate font-mono text-[10px] text-fog-700">{f.detail}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={`size-1.5 rounded-full ${
                    f.state === 'ok'
                      ? 'bg-ok'
                      : f.state === 'fallo'
                        ? 'bg-danger'
                        : f.state === 'pendiente'
                          ? 'bg-signal'
                          : 'bg-fog-700'
                  }`}
                  aria-hidden="true"
                />
                <time className="font-mono text-[10px] tabular-nums text-fog-700">
                  {new Date(f.at).toLocaleString('es-VE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </time>
              </div>
            </div>
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setVisible((v) => v + PAGE)}
              className="mt-1 self-start rounded-md border border-ink-700 px-3 py-1.5 font-mono text-[11px] text-fog-100 transition-colors hover:border-ink-600"
            >
              cargar más ({todas.length - visible} restantes)
            </button>
          )}
        </div>
      </section>
    </div>
  );
}