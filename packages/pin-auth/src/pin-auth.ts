import type { CachedSession } from '@brian/shared';
import type { Clock, PinStore, StoredState } from './ports';

export interface PinAuthOptions {
  store: PinStore;
  clock?: Clock;
  gateway?: AuthGatewayLike;
}

/** Solo las funciones de AuthGateway que usa el módulo (signIn es la app). */
export interface AuthGatewayLike {
  refresh(refreshToken: string): Promise<CachedSession>;
}

export type VerifyOutcome =
  { ok: true } | { ok: false; reason: 'invalid' | 'locked'; attempts_left: number };

export interface PinAuthState {
  has_pin: boolean;
  locked: boolean;
  attempts_left: number;
  has_session: boolean;
  session_expires_at: string | null;
}

const PIN_MIN = 4;
const PIN_MAX = 8;
const MAX_ATTEMPTS_LIMIT = 5;
const SESSION_TTL_MS = 5 * 24 * 60 * 60 * 1000;

/**
 * Módulo profundo: detrás de una interfaz mínima (getState/set/verify/touch/unlock)
 * concentra toda la lógica de PIN + sesión offline: PBKDF2 (WebCrypto), lockout por
 * intentos, expiración por inactividad §3.4, recuperación por admin. El caller solo
 * aprende 5 métodos; nada de hashing, timing-safe compare ni reloj en la app.
 */
export class PinAuth {
  private readonly store: PinStore;
  private readonly clock: Clock;
  private readonly gateway?: AuthGatewayLike;

  constructor(options: PinAuthOptions) {
    this.store = options.store;
    this.clock = options.clock ?? { now: () => new Date() };
    this.gateway = options.gateway;
  }

  /** Lee el estado persistido; null = nunca configurado. */
  private async read(): Promise<StoredState | null> {
    return this.store.read();
  }

  /** ¿PIN configurado en este dispositivo? */
  async hasPin(): Promise<boolean> {
    return (await this.read()) !== null;
  }

  /** Snapshot de estado para la UI (sin exponer hash ni sesión). */
  async getState(): Promise<PinAuthState> {
    const state = await this.read();
    if (!state) {
      return {
        has_pin: false,
        locked: false,
        attempts_left: MAX_ATTEMPTS_LIMIT,
        has_session: false,
        session_expires_at: null,
      };
    }
    const locked =
      state.lockout_until !== null &&
      this.clock.now().getTime() < new Date(state.lockout_until).getTime();
    const exp = state.session?.last_active_at
      ? new Date(new Date(state.session.last_active_at).getTime() + SESSION_TTL_MS)
      : null;
    return {
      has_pin: true,
      locked,
      attempts_left: Math.max(0, MAX_ATTEMPTS_LIMIT - state.attempts),
      has_session: state.session !== null,
      session_expires_at: exp ? exp.toISOString() : null,
    };
  }

  /** Crea el PIN por primera vez (tras login online). Falla si ya existe. */
  async setPin(pin: string): Promise<void> {
    const existing = await this.read();
    if (existing) throw new Error('pin already configured');
    const { hash, salt, iterations } = await hashPin(pin);
    await this.store.write({
      hash,
      salt,
      iterations,
      attempts: 0,
      lockout_until: null,
      session: null,
    });
  }

  /** Verifica el PIN (con lockout por intentos fallidos). No toca la sesión. */
  async verify(pin: string): Promise<VerifyOutcome> {
    const state = await this.read();
    if (!state) throw new Error('pin not configured');

    const now = this.clock.now().getTime();
    if (state.lockout_until && now < new Date(state.lockout_until).getTime()) {
      return { ok: false, reason: 'locked', attempts_left: 0 };
    }

    const matches = await verifyPin(pin, state);
    if (matches) {
      if (state.attempts !== 0) {
        await this.store.write({ ...state, attempts: 0, lockout_until: null });
      }
      return { ok: true };
    }

    const attempts = state.attempts + 1;
    const locked = attempts >= MAX_ATTEMPTS_LIMIT;
    await this.store.write({
      ...state,
      attempts,
      lockout_until: locked ? new Date(now + 60_000).toISOString() : null,
    });
    return {
      ok: false,
      reason: locked ? 'locked' : 'invalid',
      attempts_left: Math.max(0, MAX_ATTEMPTS_LIMIT - attempts),
    };
  }

  /** Guarda la sesión cacheada offline (tras login online o refresh). */
  async cacheSession(session: CachedSession): Promise<void> {
    const state = (await this.read()) ?? {
      hash: '',
      salt: '',
      iterations: 0,
      attempts: 0,
      lockout_until: null,
      session: null,
    };
    await this.store.write({ ...state, session });
  }

  /** Sesión cacheada si sigue vigente (≤5 días inactiva, §3.4). */
  async session(): Promise<CachedSession | null> {
    const state = await this.read();
    if (!state?.session) return null;
    const last = new Date(state.session.last_active_at).getTime();
    if (this.clock.now().getTime() - last > SESSION_TTL_MS) {
      await this.store.write({ ...state, session: null });
      return null;
    }
    return state.session;
  }

  /** Marca actividad; refresca la sesión vía gateway si quedó inactiva. */
  async touch(): Promise<CachedSession | null> {
    const state = await this.read();
    if (!state?.session) return null;
    const stale =
      this.clock.now().getTime() - new Date(state.session.last_active_at).getTime() >
      SESSION_TTL_MS;
    if (stale && this.gateway) {
      try {
        const refreshed = await this.gateway.refresh(state.session.refresh_token);
        await this.store.write({
          ...state,
          session: { ...refreshed, last_active_at: this.clock.now().toISOString() },
        });
        return refreshed;
      } catch {
        return null;
      }
    }
    if (state.session.last_active_at !== this.clock.now().toISOString()) {
      await this.store.write({
        ...state,
        session: { ...state.session, last_active_at: this.clock.now().toISOString() },
      });
    }
    return state.session;
  }

  /** Desbloqueo por admin (recuperación §3.4): resetea intentos y lockout. */
  async adminUnlock(): Promise<void> {
    const state = await this.read();
    if (!state) throw new Error('pin not configured');
    await this.store.write({ ...state, attempts: 0, lockout_until: null });
  }

  /** Cambio de PIN (requiere clave actual correcta). */
  async changePin(current: string, next: string): Promise<void> {
    const state = await this.read();
    if (!state) throw new Error('pin not configured');
    const ok = await verifyPin(current, state);
    if (!ok) throw new Error('current pin is wrong');
    const { hash, salt, iterations } = await hashPin(next);
    await this.store.write({ ...state, hash, salt, iterations, attempts: 0, lockout_until: null });
  }

  /** Purga local completa (logout o limpieza remota §3.5). */
  async wipe(): Promise<void> {
    await this.store.clear();
  }
}

/* ── PBKDF2 helpers (WebCrypto; sin dependencias) ─────────────────────── */

interface PinHash {
  hash: string;
  salt: string;
  iterations: number;
}

const PBKDF2_ITERATIONS = 100_000;

function getSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('WebCrypto unavailable');
  return subtle;
}

function bufToB64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64ToBuf(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function deriveKeyMaterial(
  pin: string,
  salt: Uint8Array,
  iterations: number,
): Promise<ArrayBuffer> {
  const subtle = getSubtle();
  return subtle
    .importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
    .then((key) =>
      subtle.deriveBits(
        { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
        key,
        256,
      ),
    );
}

function assertPinShape(pin: string): void {
  if (!/^\d+$/.test(pin) || pin.length < PIN_MIN || pin.length > PIN_MAX) {
    throw new Error(`PIN must be ${PIN_MIN}-${PIN_MAX} digits`);
  }
}

async function hashPin(pin: string): Promise<PinHash> {
  assertPinShape(pin);
  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
  const derived = await deriveKeyMaterial(pin, salt, PBKDF2_ITERATIONS);
  return { hash: bufToB64(derived), salt: bufToB64(salt), iterations: PBKDF2_ITERATIONS };
}

async function verifyPin(pin: string, state: StoredState): Promise<boolean> {
  const salt = b64ToBuf(state.salt);
  const derived = await deriveKeyMaterial(pin, salt, state.iterations);
  return timingSafeEqual(new Uint8Array(derived), b64ToBuf(state.hash));
}

/** Compare de tiempo constante: evita medir prefijo del hash por timing. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}
