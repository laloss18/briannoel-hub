import { createOutboxEntry } from '@brian/sync-engine';
import {
  crearDespacho as crearDespachoDomain,
  eliminarDespachoPendiente as eliminarDespachoPendienteDomain,
  entregarDespacho as entregarDespachoDomain,
  type CrearDespachoInput,
} from '@brian/ventas';
import {
  despachoSchema,
  type Cliente,
  type Despacho,
  type Item,
  type Role,
} from '@brian/shared';
import { DexieLocalStore, DexieOutbox, hub } from '../sync/db';

const ENTITY = 'despachos';

/** Despachos del mirror local (no borrados), ordenados por updated_at desc. */
export async function listDespachos(): Promise<Despacho[]> {
  const rows = await hub.records
    .where('entity')
    .equals(ENTITY)
    .filter((r) => r.deleted_at === null || r.deleted_at === undefined)
    .toArray();
  return rows
    .map((r) => despachoSchema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

/** Despachos abiertos a crédito de un cliente (para el indicador "crédito bloqueado"). */
export async function listDespachosAbiertosCredito(clienteId: string): Promise<Despacho[]> {
  const todos = await listDespachos();
  return todos.filter(
    (d) =>
      d.cliente_id === clienteId &&
      d.condicion === 'credito' &&
      d.estado !== 'anulado',
  );
}

export async function persistDespacho(
  despacho: Despacho,
  operation: 'create' | 'update' | 'softDelete',
): Promise<void> {
  await new DexieLocalStore().upsert(ENTITY, { ...despacho });
  await new DexieOutbox().add(
    createOutboxEntry({
      entity: ENTITY,
      operation,
      id: despacho.id,
      created_at: despacho.created_at,
      updated_at: despacho.updated_at,
      deleted_at: despacho.deleted_at,
      data: { ...despacho },
    }),
  );
}

export interface NuevaVentaRepoInput {
  cliente: Cliente;
  condicion: 'credito' | 'contado';
  canal: 'mayor' | 'detal';
  lineas: { item: Item; cantidad: number }[];
  tasa_bcv: number;
  descuento?: { pct: number; aprobado_por: string; pasos: number };
  vendedor: string;
  editor_role: Role;
}

/** Crea y persiste un despacho (reglas de dominio + outbox para la próxima sync). */
export async function crearDespachoLocal(input: NuevaVentaRepoInput): Promise<Despacho> {
  const despacho = crearDespachoDomain({
    cliente: input.cliente,
    condicion: input.condicion,
    canal: input.canal,
    lineas: input.lineas,
    tasa_bcv: input.tasa_bcv,
    descuento: input.descuento,
    vendedor: input.vendedor,
    editor_role: input.editor_role,
  } satisfies CrearDespachoInput);
  await persistDespacho(despacho, 'create');
  return despacho;
}

/** Entrega el despacho (inmutable tras la entrega, §2.6). Caller valida `deliver_dispatch`. */
export async function entregarDespachoLocal(
  prev: Despacho,
  entregado_por: string,
  editor_role: Role,
): Promise<Despacho> {
  const despacho = entregarDespachoDomain(prev, entregado_por, editor_role);
  await persistDespacho(despacho, 'update');
  return despacho;
}

/** Elimina un despacho NO entregado (soft delete, §3.3). Caller valida `delete_dispatch_pending`. */
export async function eliminarDespachoPendienteLocal(
  prev: Despacho,
  editor: string,
): Promise<Despacho> {
  const despacho = eliminarDespachoPendienteDomain(prev, editor);
  await persistDespacho(despacho, 'softDelete');
  return despacho;
}

export const DESPACHOS_ENTITY = ENTITY;
export type { CrearDespachoInput };