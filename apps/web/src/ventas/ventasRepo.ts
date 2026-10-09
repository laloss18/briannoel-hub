import { createOutboxEntry } from '@brian/sync-engine';
import {
  corregirDespacho as corregirDespachoDomain,
  crearDespacho as crearDespachoDomain,
  editarDespachoPendiente as editarDespachoPendienteDomain,
  eliminarDespachoPendiente as eliminarDespachoPendienteDomain,
  entregarDespacho as entregarDespachoDomain,
  type CorregirDespachoInput,
  type CrearDespachoInput,
  type DescuentoAprobado,
  type EditarDespachoInput,
  type RecargoMora,
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
  lineas: { item: Item; cantidad: number }[];
  /** Tasa BCV (Bs/USD) vigente al registrar; 0 si aún no configurada (§2.6). */
  tasa_bcv?: number;
  descuento?: DescuentoAprobado;
  /** Recargo por mora (solo crédito): % sobre subtotal o monto fijo en USD. */
  mora?: RecargoMora;
  /** IVA (%) sobre la base con recargo; 0 = sin IVA. */
  iva_pct?: number;
  /** Promotor que captó al cliente (nombre del roster `personal`), opcional. */
  promotor?: string | null;
  /** Supervisor a cargo (nombre del roster o identidad de quien registra). */
  supervisor?: string | null;
  vendedor: string;
  editor_role: Role;
}

/** Crea y persiste un despacho (reglas de dominio + outbox para la próxima sync). */
export async function crearDespachoLocal(input: NuevaVentaRepoInput): Promise<Despacho> {
  const despacho = crearDespachoDomain({
    cliente: input.cliente,
    condicion: input.condicion,
    lineas: input.lineas,
    tasa_bcv: input.tasa_bcv,
    descuento: input.descuento,
    mora: input.mora,
    iva_pct: input.iva_pct,
    promotor: input.promotor,
    supervisor: input.supervisor,
    vendedor: input.vendedor,
    editor_role: input.editor_role,
  } satisfies CrearDespachoInput);
  await persistDespacho(despacho, 'create');
  return despacho;
}

export interface EditarVentaRepoInput {
  cliente?: Cliente;
  condicion: 'credito' | 'contado';
  lineas: { item: Item; cantidad: number }[];
  tasa_bcv?: number;
  descuento?: DescuentoAprobado;
  /** Recargo por mora (solo crédito): % sobre subtotal o monto fijo en USD. */
  mora?: RecargoMora;
  /** IVA (%) sobre la base con recargo; 0 = sin IVA. */
  iva_pct?: number;
  vendedor: string;
  editor_role: Role;
}

/** Edita un despacho en `pedido` (solo admin; el entregado es inmutable §2.6). */
export async function editarDespachoLocal(
  prev: Despacho,
  input: EditarVentaRepoInput,
): Promise<Despacho> {
  const despacho = editarDespachoPendienteDomain(prev, {
    cliente: input.cliente,
    condicion: input.condicion,
    lineas: input.lineas,
    tasa_bcv: input.tasa_bcv,
    descuento: input.descuento,
    mora: input.mora,
    iva_pct: input.iva_pct,
    editor: input.vendedor,
    editor_role: input.editor_role,
  } satisfies EditarDespachoInput);
  await persistDespacho(despacho, 'update');
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

/** Corrección admin: cambio de estado (rectificar) y/o reasignación de promotor/entrega. */
export async function corregirDespachoLocal(
  prev: Despacho,
  input: Omit<CorregirDespachoInput, 'clock'>,
): Promise<Despacho> {
  const despacho = corregirDespachoDomain(prev, input);
  await persistDespacho(despacho, 'update');
  return despacho;
}

export const DESPACHOS_ENTITY = ENTITY;
export type { CrearDespachoInput };