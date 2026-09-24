import { createOutboxEntry } from '@brian/sync-engine';
import {
  aplicarOverride,
  crearCliente,
  editarCliente,
  matchZona,
  type ScoreOverrideInput,
} from '@brian/clientes';
import { clienteSchema, type Cliente, type Consentimiento, type Zona } from '@brian/shared';
import { hasPermission, type Role } from '@brian/shared';
import { DexieLocalStore, DexieOutbox, hub } from '../sync/db';

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
  direccion?: string;
  lat?: number | null;
  lng?: number | null;
  plus_code?: string;
  consentimiento: Consentimiento;
  creado_por: string;
}

/** Crea y persiste un cliente (reglas de dominio + outbox para la próxima sync). */
export async function crearClienteLocal(
  input: NuevoClienteRepoInput,
  zonas: Zona[],
): Promise<Cliente> {
  const cliente = crearCliente(
    {
      nombre: input.nombre,
      documento: input.documento,
      telefono: input.telefono,
      direccion: input.direccion,
      geo: {
        lat: input.lat,
        lng: input.lng,
        plus_code: input.plus_code,
      },
      consentimiento: input.consentimiento,
      creator: input.creado_por,
    },
    zonas,
  );
  await persistLocal(cliente);
  return cliente;
}

/** Reasigna la zona por geo si cambió la dirección/ubicación (§3.3). */
export async function editarClienteLocal(
  prev: Cliente,
  editor: string,
  zonas: Zona[],
  patch: { direccion?: string; lat?: number | null; lng?: number | null; telefono?: string },
): Promise<Cliente> {
  const updated = editarCliente(
    prev,
    {
      editor,
      telefono: patch.telefono,
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

/** Permiso para editar clientes / fijar score (PRD §3.2). */
export function canEditClientes(roles: readonly Role[]): boolean {
  return hasPermission('edit_client', roles);
}

export { matchZona };
export const CLIENTES_ENTITY = ENTITY;
