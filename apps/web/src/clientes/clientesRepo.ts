import { createOutboxEntry } from '@brian/sync-engine';
import {
  aplicarOverride,
  aplicarScore,
  crearCliente,
  editarCliente,
  matchZona,
  type ScoreOverrideInput,
} from '@brian/clientes';
import { clienteSchema, type Cliente, type Consentimiento, type Zona } from '@brian/shared';
import { hasPermission, type Role } from '@brian/shared';
import { DexieLocalStore, DexieOutbox, hub } from '../sync/db';
import { listDespachos } from '../ventas/ventasRepo';

const ENTITY = 'clientes';

/** Clientes del mirror local (no borrados), ordenados por updated_at desc. */
export async function listClientes(): Promise<Cliente[]> {
  const rows = await hub.records
    .where('entity')
    .equals(ENTITY)
    .filter((r) => r.deleted_at === null || r.deleted_at === undefined)
    .toArray();
  return rows
    .map((r) => clienteSchema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

async function persistLocal(cliente: Cliente): Promise<void> {
  await new DexieLocalStore().upsert(ENTITY, { ...cliente });
  await new DexieOutbox().add(
    createOutboxEntry({
      entity: ENTITY,
      operation: 'create',
      id: cliente.id,
      created_at: cliente.created_at,
      updated_at: cliente.updated_at,
      deleted_at: null,
      data: { ...cliente },
    }),
  );
}

export interface NuevoClienteRepoInput {
  nombre: string;
  documento?: string;
  telefono?: string;
  telefono2?: string;
  notas_referencia?: string;
  direccion?: string;
  lat?: number | null;
  lng?: number | null;
  plus_code?: string;
  foto_fachada?: string;
  foto_cliente?: string;
  foto_cedula?: string;
  consentimiento: Consentimiento;
  creado_por: string;
}

/** Crea y persiste un cliente (reglas de dominio + outbox para la próxima sync).
 *  `zonaOverride` permite fijar la zona elegida en la venta cuando la geo no
 *  coincide automáticamente (el dominio igual calcula la zona por cercanía). */
export async function crearClienteLocal(
  input: NuevoClienteRepoInput,
  zonas: Zona[],
  zonaOverride?: string | null,
): Promise<Cliente> {
  const cliente = crearCliente(
    {
      nombre: input.nombre,
      documento: input.documento,
      telefono: input.telefono,
      telefono2: input.telefono2,
      notas_referencia: input.notas_referencia,
      direccion: input.direccion,
      geo: {
        lat: input.lat,
        lng: input.lng,
        plus_code: input.plus_code,
      },
      foto_fachada: input.foto_fachada,
      foto_cliente: input.foto_cliente,
      foto_cedula: input.foto_cedula,
      consentimiento: input.consentimiento,
      creator: input.creado_por,
    },
    zonas,
  );
  const final =
    zonaOverride !== undefined && zonaOverride !== null && cliente.zona_id !== zonaOverride
      ? { ...cliente, zona_id: zonaOverride }
      : cliente;
  await persistLocal(final);
  return final;
}

/** Reasigna la zona por geo si cambió la dirección/ubicación (§3.3) y permite
 *  editar los datos principales del cliente. */
export async function editarClienteLocal(
  prev: Cliente,
  editor: string,
  zonas: Zona[],
  patch: {
    nombre?: string;
    documento?: string;
    telefono?: string;
    telefono2?: string;
    notas_referencia?: string;
    direccion?: string;
    lat?: number | null;
    lng?: number | null;
  },
): Promise<Cliente> {
  const updated = editarCliente(
    prev,
    {
      editor,
      nombre: patch.nombre,
      documento: patch.documento,
      telefono: patch.telefono,
      telefono2: patch.telefono2,
      notas_referencia: patch.notas_referencia,
      direccion: patch.direccion,
      geo:
        patch.lat !== undefined || patch.lng !== undefined
          ? { lat: patch.lat, lng: patch.lng }
          : undefined,
    },
    zonas,
  );
  await persistLocal(updated);
  return updated;
}

/** Override manual de score (§2.5): solo supervisor/admin lo autoriza (rol validado en la UI). */
export async function aplicarOverrideLocal(
  cliente: Cliente,
  override: ScoreOverrideInput,
): Promise<Cliente> {
  const updated = aplicarOverride(cliente, override);
  await persistLocal(updated);
  return updated;
}

/** Recálculo automático del score (§2.5) tras cada venta del cliente: el
 *  historial de compras (frecuencia + monto) se arma con sus despachos no
 *  eliminados y la antigüedad con `created_at`. Un override manual lo congela:
 *  el score recalculado no pisa lo que fijó supervisor/admin. */
export async function recalcularScoreDe(clienteId: string): Promise<void> {
  const [clientes, despachos] = await Promise.all([listClientes(), listDespachos()]);
  const cliente = clientes.find((c) => c.id === clienteId);
  if (!cliente) return;
  if (cliente.score_override !== null && cliente.score_override !== undefined) return;
  const compras = despachos
    .filter((d) => d.cliente_id === clienteId && (d.deleted_at ?? null) === null)
    .map((d) => ({ amount: d.total, at: d.created_at }));
  const tenureDays = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(cliente.created_at)) / 86_400_000),
  );
  const actualizado = aplicarScore(cliente, {
    tenureDays,
    purchases: compras,
    asOf: new Date().toISOString(),
  });
  await persistLocal(actualizado);
}

/** Permiso para editar clientes / fijar score (PRD §3.2). */
export function canEditClientes(roles: readonly Role[]): boolean {
  return hasPermission('edit_client', roles);
}

export { matchZona };
export const CLIENTES_ENTITY = ENTITY;
