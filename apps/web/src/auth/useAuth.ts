import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CachedSession } from '@brian/shared';
import { PinAuth } from '@brian/pin-auth';
import { DexiePinStore } from './pinStore';
import { SupabaseAuthGateway } from './supabaseGateway';

export type AuthScreen = 'loading' | 'login' | 'setup-pin' | 'unlock' | 'home';

export interface UseAuthResult {
  screen: AuthScreen;
  state: Awaited<ReturnType<PinAuth['getState']>>;
  /** Última sesión cacheada (roles para permisos §3.2). */
  session: CachedSession | null;
  login: (email: string, password: string) => Promise<void>;
  setupPin: (pin: string) => Promise<void>;
  unlock: (pin: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [screen, setScreen] = useState<AuthScreen>('loading');
  const auth = useMemo(
    () => new PinAuth({ store: new DexiePinStore(), gateway: new SupabaseAuthGateway() }),
    [],
  );
  const [state, setState] = useState<Awaited<ReturnType<PinAuth['getState']>>>({
    has_pin: false,
    locked: false,
    attempts_left: 5,
    has_session: false,
    session_expires_at: null,
  });
  const [session, setSession] = useState<CachedSession | null>(null);

  const refreshState = useCallback(async () => {
    setState(await auth.getState());
    setSession(await auth.session());
  }, [auth]);

  /** Boot: sin PIN → login; PIN sin sesión → login; sesión vigente → unlock. */
  useEffect(() => {
    (async () => {
      const s = await auth.getState();
      setState(s);
      if (!s.has_pin) setScreen('login');
      else if (!s.has_session) setScreen('login');
      else setScreen('unlock');
    })();
  }, [auth]);

  /** Login online (§3.4): valida credenciales, cachea la sesión; si nunca hubo PIN lo pide crear. */
  const login = useCallback(
    async (email: string, password: string) => {
      const gateway = new SupabaseAuthGateway();
      const session = await gateway.signIn(email, password);
      await auth.cacheSession(session);
      await refreshState();
      const s = await auth.getState();
      setScreen(s.has_pin ? 'unlock' : 'setup-pin');
    },
    [auth, refreshState],
  );

  const setupPin = useCallback(
    async (pin: string) => {
      await auth.setPin(pin);
      await refreshState();
      setScreen('unlock');
    },
    [auth, refreshState],
  );

  const unlock = useCallback(
    async (pin: string): Promise<boolean> => {
      const r = await auth.verify(pin);
      if (r.ok) await auth.touch();
      await refreshState();
      return r.ok;
    },
    [auth, refreshState],
  );

  const logout = useCallback(async () => {
    await new SupabaseAuthGateway().signOut().catch(() => undefined);
    await auth.wipe();
    await refreshState();
    setScreen('login');
  }, [auth, refreshState]);

  return { screen, state, session, login, setupPin, unlock, logout };
}
