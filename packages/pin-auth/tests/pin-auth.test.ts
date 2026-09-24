import { describe, expect, it, beforeEach } from 'vitest';
import type { CachedSession } from '@brian/shared';
import { PinAuth, type PinStore, type StoredState, type Clock } from '../src/index';

class MemoryPinStore implements PinStore {
  state: StoredState | null = null;
  async read(): Promise<StoredState | null> {
    return this.state
      ? { ...this.state, session: this.state.session ? { ...this.state.session } : null }
      : null;
  }
  async write(state: StoredState): Promise<void> {
    this.state = { ...state, session: state.session ? { ...state.session } : null };
  }
  async clear(): Promise<void> {
    this.state = null;
  }
}

class FakeClock implements Clock {
  ms = Date.parse('2024-05-01T00:00:00.000Z');
  advance(ms: number): void {
    this.ms += ms;
  }
  now(): Date {
    return new Date(this.ms);
  }
}

const session: CachedSession = {
  user_id: 'user-1',
  email: 'luis@briannoel.com',
  roles: ['admin'],
  access_token: 'at-1',
  refresh_token: 'rt-1',
  last_active_at: '2024-05-01T00:00:00.000Z',
};

describe('PinAuth', () => {
  let store: MemoryPinStore;
  let clock: FakeClock;
  let auth: PinAuth;

  beforeEach(() => {
    store = new MemoryPinStore();
    clock = new FakeClock();
    auth = new PinAuth({ store, clock });
  });

  it('no PIN configurado al iniciar', async () => {
    expect(await auth.hasPin()).toBe(false);
    const s = await auth.getState();
    expect(s.has_pin).toBe(false);
    expect(s.locked).toBe(false);
  });

  it('setPin crea el PIN y hasPin lo refleja', async () => {
    await auth.setPin('1234');
    expect(await auth.hasPin()).toBe(true);
    const s = await auth.getState();
    expect(s.has_pin).toBe(true);
    expect(s.attempts_left).toBe(5);
  });

  it('setPin rechaza PINs no numéricos o fuera de rango', async () => {
    await expect(auth.setPin('12a4')).rejects.toThrow();
    await expect(auth.setPin('123')).rejects.toThrow();
    await expect(auth.setPin('123456789')).rejects.toThrow();
  });

  it('setPin dos veces falla', async () => {
    await auth.setPin('1234');
    await expect(auth.setPin('5678')).rejects.toThrow('already configured');
  });

  it('verify aprueba el PIN correcto', async () => {
    await auth.setPin('1234');
    const r = await auth.verify('1234');
    expect(r.ok).toBe(true);
  });

  it('verify rechaza PIN incorrecto descontando intentos', async () => {
    await auth.setPin('1234');
    for (let i = 0; i < 4; i++) {
      const r = await auth.verify('0000');
      expect(r.ok).toBe(false);
      if (r.ok === false) expect(r.attempts_left).toBe(5 - (i + 1));
    }
    const state = await auth.getState();
    expect(state.attempts_left).toBe(1);
  });

  it('bloquea tras 5 intentos fallidos y el admin desbloquea', async () => {
    await auth.setPin('1234');
    for (let i = 0; i < 5; i++) await auth.verify('0000');
    const locked = await auth.verify('1234');
    expect(locked.ok).toBe(false);
    if (locked.ok === false) expect(locked.reason).toBe('locked');

    await auth.adminUnlock();
    const r = await auth.verify('1234');
    expect(r.ok).toBe(true);
  });

  it('el lockout expira por tiempo aunque el PIN sea correcto (persistencia de lockout)', async () => {
    await auth.setPin('1234');
    for (let i = 0; i < 5; i++) await auth.verify('0000');
    clock.advance(120_000);
    const r = await auth.verify('1234');
    expect(r.ok).toBe(true);
  });

  it('cacheSession y session devuelven la sesión vigente', async () => {
    await auth.setPin('1234');
    await auth.cacheSession(session);
    const got = await auth.session();
    expect(got?.user_id).toBe('user-1');
    expect(got?.roles).toEqual(['admin']);
  });

  it('session expira tras 5 días sin actividad (PRD §3.4)', async () => {
    await auth.setPin('1234');
    await auth.cacheSession(session);
    clock.advance(6 * 24 * 60 * 60 * 1000);
    expect(await auth.session()).toBeNull();
  });

  it('touch re-marca actividad y mantiene la sesión vigente', async () => {
    await auth.setPin('1234');
    await auth.cacheSession(session);
    clock.advance(4 * 24 * 60 * 60 * 1000);
    await auth.touch();
    clock.advance(2 * 24 * 60 * 60 * 1000);
    expect(await auth.session()).not.toBeNull();
  });

  it('touch refresca vía gateway cuando quedó inactiva y el gateway responde', async () => {
    let called = '';
    const gateway = {
      refresh: async (rt: string) => {
        called = rt;
        return { ...session, access_token: 'at-2', last_active_at: '2024-05-06T00:00:00.000Z' };
      },
    };
    const withGateway = new PinAuth({ store, clock, gateway });
    await withGateway.setPin('1234');
    await withGateway.cacheSession(session);
    clock.advance(6 * 24 * 60 * 60 * 1000);
    const refreshed = await withGateway.touch();
    expect(called).toBe('rt-1');
    expect(refreshed?.access_token).toBe('at-2');
  });

  it('changePin exige el PIN actual', async () => {
    await auth.setPin('1234');
    await expect(auth.changePin('0000', '9999')).rejects.toThrow('wrong');
    await auth.changePin('1234', '9999');
    expect((await auth.verify('1234')).ok).toBe(false);
    expect((await auth.verify('9999')).ok).toBe(true);
  });

  it('wipe elimina PIN y sesión (purga local §3.5)', async () => {
    await auth.setPin('1234');
    await auth.cacheSession(session);
    await auth.wipe();
    expect(await auth.hasPin()).toBe(false);
    expect(await auth.session()).toBeNull();
  });

  it('verify sin PIN configurado lanza error (nunca debe pasar en la app)', async () => {
    await expect(auth.verify('1234')).rejects.toThrow('not configured');
  });

  it('getState reporta sesión y expiración', async () => {
    await auth.setPin('1234');
    await auth.cacheSession(session);
    const s = await auth.getState();
    expect(s.has_session).toBe(true);
    expect(s.session_expires_at).toBe('2024-05-06T00:00:00.000Z');
  });

  it('cacheSession antes del PIN NO cuenta como PIN configurado (bug: solicitaba PIN sin haberlo creado)', async () => {
    await auth.cacheSession(session);
    expect(await auth.hasPin()).toBe(false);
    const s = await auth.getState();
    expect(s.has_pin).toBe(false);
    expect(s.has_session).toBe(true);
  });

  it('setPin tras cacheSession (flujo login→setup) preserva la sesión cacheada', async () => {
    await auth.cacheSession(session);
    await auth.setPin('1234');
    const s = await auth.getState();
    expect(s.has_pin).toBe(true);
    expect(s.has_session).toBe(true);
    expect((await auth.session())?.user_id).toBe('user-1');
  });

  it('verify sin PIN real (solo sesión cacheada) lanza error y no revienta PBKDF2 con iterations=0', async () => {
    await auth.cacheSession(session);
    await expect(auth.verify('1234')).rejects.toThrow('not configured');
  });
});

describe('PinAuth con session null desde el inicio', () => {
  it('setPin soporta no tener sesión aún (bandera antes del primer login online)', async () => {
    const store = new MemoryPinStore();
    const auth = new PinAuth({ store, clock: new FakeClock() });
    await auth.setPin('1234');
    expect(await auth.getState()).toMatchObject({ has_pin: true, has_session: false });
  });
});
