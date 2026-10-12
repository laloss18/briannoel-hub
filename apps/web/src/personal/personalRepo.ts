import { createOutboxEntry } from '@brian/sync-engine';
import { personalSchema, type Personal, type Role } from '@brian/shared';
import { ulid } from 'ulidx';
import { DexieLocalStore, DexieOutbox, hub } from '../sync/db';

const ENTITY = 'personal';

/** Roster de personal (promotores/encargados, PRD §3.1), activos, por nombre. */
export async function listPersonal(): Promise<Personal[]> {
  const rows = await hub.records
    .where('entity')
    .equals(ENTITY)
    .filter((r) => r.deleted_at === null || r.deleted_at === undefined)
    .toArray();
  return rows
    .map((r) => personalSchema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

async function persistPersonal(
  persona: Personal,
  operation: 'create' | 'update' | 'softDelete',
): Promise<void> {
  await new DexieLocalStore().upsert(ENTITY, { ...persona });
  await new DexieOutbox().add(
    createOutboxEntry({
      entity: ENTITY,
      operation,
      id: persona.id,
      created_at: persona.created_at,
      updated_at: persona.updated_at,
      deleted_at: persona.deleted_at,
      data: { ...persona },
    }),
  );
}

export interface NuevaPersonalRepoInput {
  nombre: string;
  telefono?: string;
  email?: string;
  rol: Role;
}

function validar(input: NuevaPersonalRepoInput, editor: string): Personal {
  const parsed = personalSchema.safeParse({
    id: ulid(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    nombre: input.nombre.trim(),
    telefono: input.telefono?.trim() || undefined,
    email: input.email?.trim() || undefined,
    rol: input.rol,
    created_by: editor,
    updated_by: editor,
  });
  if (!parsed.success) {
    throw new Error('La persona no cumple el roster (nombre inválido o rol no permitido).');
  }
  return parsed.data;
}

/** Alta de una persona del roster (admin). Caller valida `manage_roster`. */
export async function crearPersonalLocal(
  input: NuevaPersonalRepoInput,
  editor: string,
): Promise<Personal> {
  const persona = validar(input, editor);
  await persistPersonal(persona, 'create');
  return persona;
}

/** Actualiza los datos de una persona del roster (LWW). Caller valida `manage_roster`. */
export async function editarPersonalLocal(
  prev: Personal,
  patch: Partial<NuevaPersonalRepoInput>,
  editor: string,
): Promise<Personal> {
  const persona = validar(
    {
      nombre: patch.nombre?.trim() ?? prev.nombre,
      telefono: patch.telefono !== undefined ? patch.telefono || undefined : prev.telefono,
      email: patch.email !== undefined ? patch.email || undefined : prev.email,
      rol: patch.rol ?? prev.rol,
    },
    editor,
  );
  const updated: Personal = {
    ...prev,
    ...persona,
    updated_at: persona.updated_at,
    updated_by: editor,
  };
  await persistPersonal(updated, 'update');
  return updated;
}

/** Baja lógica del roster (deja de aparecer en selecciones). Caller valida `manage_roster`. */
export async function eliminarPersonalLocal(prev: Personal): Promise<Personal> {
  const now = new Date().toISOString();
  const persona: Personal = { ...prev, updated_at: now, deleted_at: now };
  await persistPersonal(persona, 'softDelete');
  return persona;
}

export const PERSONAL_ENTITY = ENTITY;
