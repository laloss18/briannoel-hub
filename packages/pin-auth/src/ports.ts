import type { CachedSession } from '@brian/shared';

/**
 * Persistencia del estado de PIN + sesión offline (PRD §3.4). Un adapter en
 * memoria para tests, Dexie (IndexedDB) en la PWA. Solo este puerto toca el
 * disco: el módulo nunca escribe él mismo.
 */
export interface PinStore {
  read(): Promise<StoredState | null>;
  write(state: StoredState): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Estado interno persistido. `hash`/`salt`/`iterations` son el PIN derivado con
 * PBKDF2-SHA-256 (WebCrypto); nunca se guarda el PIN ni su forma débil.
 */
export interface StoredState {
  /** Base64 del derivado PBKDF2-SHA-256. */
  hash: string;
  /** Base64 del salt aleatorio. */
  salt: string;
  /** Iteraciones PBKDF2 usadas al derivar. */
  iterations: number;
  /** Intentos fallidos consecutivos (bloqueo tras `PIN_MAX_ATTEMPTS`). */
  attempts: number;
  /** Sello ISO del próximo intento permitido; null = desbloqueado. */
  lockout_until: string | null;
  /** Sesión offline cacheada; null = aún no hay sesión. */
  session: CachedSession | null;
}

/** Reloj inyectable para testear expiración por inactividad sin esperar. */
export interface Clock {
  now(): Date;
}

/**
 * Puente online (Supabase Auth en la PWA, fake en tests): login con usuario +
 * contraseña y renovación de tokens. El módulo PIN es 100% offline; esto solo
 * se usa para reponer la sesión cuando expiró.
 */
export interface AuthGateway {
  signIn(email: string, password: string): Promise<CachedSession>;
  refresh(refreshToken: string): Promise<CachedSession>;
  signOut(): Promise<void>;
}
