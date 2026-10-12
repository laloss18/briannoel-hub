import { createOutboxEntry } from '@brian/sync-engine';
import { itemSchema, type Item } from '@brian/shared';
import { ulid } from 'ulidx';
import { DexieLocalStore, DexieOutbox, hub } from '../sync/db';

const ENTITY = 'items';

/** Ítems del catálogo local (PRD §2.2, no borrados), ordenados por nombre. */
export async function listItems(): Promise<Item[]> {
  const rows = await hub.records
    .where('entity')
    .equals(ENTITY)
    .filter((r) => r.deleted_at === null || r.deleted_at === undefined)
    .toArray();
  return rows
    .map((r) => itemSchema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

async function persistItem(
  item: Item,
  operation: 'create' | 'update' | 'softDelete',
): Promise<void> {
  await new DexieLocalStore().upsert(ENTITY, { ...item });
  await new DexieOutbox().add(
    createOutboxEntry({
      entity: ENTITY,
      operation,
      id: item.id,
      created_at: item.created_at,
      updated_at: item.updated_at,
      deleted_at: item.deleted_at,
      data: { ...item },
    }),
  );
}

export interface NuevoItemRepoInput {
  nombre: string;
  precio_contado: number;
  precio_credito: number;
}

function validar(nombre: string, precios: Omit<NuevoItemRepoInput, 'nombre'>): Item {
  const parsed = itemSchema.safeParse({
    id: ulid(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    nombre: nombre.trim(),
    ...precios,
  });
  if (!parsed.success) {
    throw new Error('El ítem no cumple el catálogo (nombre o precios inválidos).');
  }
  return parsed.data;
}

/** Crea un ítem y lo persiste (outbox → sync). Caller valida `manage_items`. */
export async function crearItemLocal(input: NuevoItemRepoInput): Promise<Item> {
  const item = validar(input.nombre, input);
  await persistItem(item, 'create');
  return item;
}

/** Actualiza nombre/precios de un ítem (LWW por updated_at). Caller valida `manage_items`. */
export async function editarItemLocal(
  prev: Item,
  patch: Partial<Omit<NuevoItemRepoInput, ''>>,
): Promise<Item> {
  const item = validar(patch.nombre ?? prev.nombre, {
    precio_contado: patch.precio_contado ?? prev.precio_contado,
    precio_credito: patch.precio_credito ?? prev.precio_credito,
  });
  const updated: Item = {
    ...prev,
    nombre: item.nombre,
    precio_contado: item.precio_contado,
    precio_credito: item.precio_credito,
    updated_at: item.updated_at,
  };
  await persistItem(updated, 'update');
  return updated;
}

/** Borrado lógico del ítem (sale del catálogo local; LWW lo propaga). Caller valida `manage_items`. */
