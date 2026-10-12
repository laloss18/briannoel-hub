import { useLiveQuery } from 'dexie-react-hooks';
import { appUserSchema, type AppUser } from '@brian/shared';
import { hub } from '../sync/db';

const ENTITY = 'app_users';

/**
 * Perfiles de usuario (`app_users`, PRD §3.4). La entidad es server-only: la
 * escribe el servidor (el trigger `on_auth_user_created` de la 0011 al crear la
 * cuenta en Supabase, y `upsert_app_user` para cambios) y baja por delta. El
 * dispositivo solo lee el espejo local para resolver identidades y candidatos.
 */
export async function listAppUsers(): Promise<AppUser[]> {
  const rows = await hub.records.where('entity').equals(ENTITY).toArray();
  return rows
    .map((r) => appUserSchema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => (a.username ?? a.email).localeCompare(b.username ?? b.email));
}

/** Suscripción para la UI (índice de identidades, candidatos de venta). */
export function useAppUsers(): AppUser[] {
  return useLiveQuery(() => listAppUsers(), []) ?? [];
}
