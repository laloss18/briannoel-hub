import { createOutboxEntry } from '@brian/sync-engine';
import { zonaSchema, type Zona } from '@brian/shared';
import { ulid } from 'ulidx';
import { DexieLocalStore, DexieOutbox, hub } from '../sync/db';

const ENTITY = 'zonas';

/** Zonas del mirror local (no borradas), ordenadas por estado → nombre. */
export async function listZonas(): Promise<Zona[]> {
  const rows = await hub.records
    .where('entity')
    .equals(ENTITY)
    .filter((r) => r.deleted_at === null || r.deleted_at === undefined)
    .toArray();
  return rows
    .map((r) => zonaSchema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => a.estado.localeCompare(b.estado) || a.nombre.localeCompare(b.nombre));
}

interface NuevoZonaInput {
  nombre: string;
  municipio: string;
  estado: string;
  lat?: number | null;
  lng?: number | null;
  plus_code?: string;
}

/** Alta de zona (backfill en migración 0004; la app también puede crearla). */
export async function crearZonaLocal(input: NuevoZonaInput): Promise<Zona> {
  const now = new Date().toISOString();
  const zona: Zona = {
    id: ulid(),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    nombre: input.nombre.trim(),
    municipio: input.municipio.trim(),
    estado: input.estado.trim(),
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    plus_code: input.plus_code,
  };
  await new DexieLocalStore().upsert(ENTITY, { ...zona });
  await new DexieOutbox().add(
    createOutboxEntry({
      entity: ENTITY,
      operation: 'create',
      id: zona.id,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      data: { ...zona },
    }),
  );
  return zona;
}

export async function editarZonaLocal(zona: Zona, input: NuevoZonaInput): Promise<Zona> {
  const now = new Date().toISOString();
  const actualizado: Zona = {
    ...zona,
    nombre: input.nombre.trim(),
    municipio: input.municipio.trim(),
    estado: input.estado.trim(),
    lat: input.lat ?? zona.lat ?? null,
    lng: input.lng ?? zona.lng ?? null,
    plus_code: input.plus_code ?? zona.plus_code,
    updated_at: now,
  };
  await new DexieLocalStore().upsert(ENTITY, { ...actualizado });
  await new DexieOutbox().add(
    createOutboxEntry({
      entity: ENTITY,
      operation: 'update',
      id: actualizado.id,
      created_at: zona.created_at,
      updated_at: now,
      deleted_at: null,
      data: { ...actualizado },
    }),
  );
  return actualizado;
}
