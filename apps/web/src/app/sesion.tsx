import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { identidadDe, type IdentidadIndice, type Role } from '@brian/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { listAppUsers } from '../auth/usuariosRepo';

export interface Sesion {
  email: string;
  /** Nombre de usuario: la identidad visible (PRD §3.4). Puede faltar si la
   *  sesión se cacheó antes del alta por admin → la UI cae al email. */
  username?: string;
  roles: readonly Role[];
  onLogout: () => void;
}

interface SesionCtx extends Sesion {
  /** email → username, para pintar quién creó/editó sin tocar el dominio. */
  identidades: IdentidadIndice;
}

const Ctx = createContext<SesionCtx | null>(null);

/** Proveedor de identidad del hub. `app_users` es server-only pero baja por
 *  delta, así que el índice username→email se arma desde el espejo local. */
export function SesionProvider({ sesion, children }: { sesion: Sesion; children: ReactNode }) {
  const usuarios = useLiveQuery(() => listAppUsers(), []);

  const identidades = useMemo<IdentidadIndice>(() => {
    const m = new Map<string, string>();
    for (const u of usuarios ?? []) {
      if (u.deleted_at) continue;
      const email = u.email?.toLowerCase();
      if (email && u.username) m.set(email, u.username);
    }
    return m;
  }, [usuarios]);

  const valor = useMemo<SesionCtx>(
    () => ({ ...sesion, identidades }),
    [sesion, identidades],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSesion(): SesionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSesion fuera de SesionProvider');
  return v;
}

/** Nombre visible del usuario en sesión: su username, o el email si no tiene. */
// eslint-disable-next-line react-refresh/only-export-components
export function useMiIdentidad(): string {
  const { username, email, identidades } = useSesion();
  return username ?? identidadDe(identidades, email);
}

/** Nombre visible de un email cualquiera (autor de un documento, p. ej.). */
// eslint-disable-next-line react-refresh/only-export-components
export function useIdentidad(): (email: string | null | undefined) => string {
  const { identidades } = useSesion();
  return (email) => identidadDe(identidades, email);
}