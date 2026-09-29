import { itemSchema, type Item } from '@brian/shared';
import { hub } from '../sync/db';

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

export const ITEMS_ENTITY = ENTITY;