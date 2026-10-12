import { useLiveQuery } from 'dexie-react-hooks';
import { appUserSchema, type AppUser, ROLES, type Role } from '@brian/shared';
import { hub } from '../sync/db';
import { supabase } from '../sync/supabase';

const ENTITY = 'app_users';

/**
 * Perfiles de usuario (`app_users`, PRD §3.4). El alta/edición NO pasa por el
 * outbox: la entidad es server-only y la escriben las RPC de admin (0009) —
 * escribirla desde el dispositivo la borraría el `admin_delete` de cada push.
 * Solo se lee el espejo local (baja por delta) para resolver identidades.
 */
export async function listAppUsers(): Promise<AppUser[]> {
  const rows = await hub.records.where('entity').equals(ENTITY).toArray();
  return rows
    .map((r) => appUserSchema.safeParse(r))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => (a.username ?? a.email).localeCompare(b.username ?? b.email));
}

/** Suscripción para la UI (índice de identidades, panel de usuarios). */
export function useAppUsers(): AppUser[] {
  return useLiveQuery(() => listAppUsers(), []) ?? [];
}

export interface AltaUsuario {
  email: string;
  username: string;
  password: string;
  roles: readonly Role[];
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw new Error('Supabase no configurado (VITE_SUPABASE_*)');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

/** Alta de una cuenta (solo admin, §3.4). La RPC es `SECURITY DEFINER`: el
 *  gate de admin vive en el servidor, no en la UI. */
export async function adminCrearUsuario(alta: AltaUsuario): Promise<string> {
  return rpc<string>('admin_create_app_user', {
    p_email: alta.email,
    p_username: alta.username,
    p_password: alta.password,
    p_roles: [...alta.roles],
    p_name: null,
  });
}

export interface EdicionUsuario {
  user_id: string;
  username?: string;
  roles?: readonly Role[];
  active?: boolean;
}

/** Username/roles/estado de una cuenta. Los campos omitidos se conservan. */
export async function adminEditarUsuario(edicion: EdicionUsuario): Promise<void> {
  await rpc<null>('admin_update_app_user', {
    p_user_id: edicion.user_id,
    p_username: edicion.username ?? null,
    p_roles: edicion.roles ? [...edicion.roles] : null,
    p_name: null,
    p_active: edicion.active ?? null,
  });
}

/** Contraseña inicial o reseteo. El MVP no tiene "olvidé mi contraseña". */
export const APP_USERS_ENTITY = ENTITY;
export { ROLES };
