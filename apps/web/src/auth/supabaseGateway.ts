import type { CachedSession } from '@brian/shared';
import type { AuthGateway } from '@brian/pin-auth';
import type { User } from '@supabase/supabase-js';
import { requireSupabase } from '../sync/supabase';
import { ROLES, usernameSchema, type Role } from '@brian/shared';

function toSession(user: User, accessToken: string, refreshToken: string): CachedSession {
  const raw = user.app_metadata?.roles as string[] | undefined;
  const roles: Role[] = Array.isArray(raw)
    ? raw.filter((r): r is Role => (ROLES as readonly string[]).includes(r))
    : ['promotor'];
  // Username = identidad visible (PRD §3.4). Lo escribe el admin en
  // `user_metadata.username` (RPC 0009); si no hay o es inválido, la sesión
  // degrada al email en vez de romper el arranque.
  const rawUsername = user.user_metadata?.username;
  const username =
    typeof rawUsername === 'string' && usernameSchema.safeParse(rawUsername).success
      ? rawUsername
      : undefined;
  return {
    user_id: user.id,
    email: user.email ?? '',
    ...(username ? { username } : {}),
    roles: roles.length ? roles : ['promotor'],
    access_token: accessToken,
    refresh_token: refreshToken,
    last_active_at: new Date().toISOString(),
  };
}

/**
 * AuthGateway → Supabase Auth (§3.4): login usuario+contraseña, refresh y
 * signOut. Los roles se leen de `app_metadata.roles` (los carga el backend,
 * migración 0003 + upsert_app_user).
 */
export class SupabaseAuthGateway implements AuthGateway {
  async signIn(email: string, password: string): Promise<CachedSession> {
    const { data, error } = await requireSupabase().auth.signInWithPassword({ email, password });
    if (error) throw new Error(`login: ${error.message}`);
    const session = data.session;
    if (!session?.user) throw new Error('login: sin sesión en la respuesta');
    return toSession(session.user, session.access_token, session.refresh_token);
  }

  async refresh(refreshToken: string): Promise<CachedSession> {
    const { data, error } = await requireSupabase().auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error) throw new Error(`refresh: ${error.message}`);
    const session = data.session;
    if (!session?.user) throw new Error('refresh: sin sesión en la respuesta');
    return toSession(session.user, session.access_token, session.refresh_token);
  }

  async signOut(): Promise<void> {
    const { error } = await requireSupabase().auth.signOut();
    if (error) throw new Error(`signOut: ${error.message}`);
  }
}
