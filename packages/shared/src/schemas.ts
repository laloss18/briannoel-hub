import { z } from 'zod';
import { ROLES } from './constants';

const ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'must be a valid ULID');

export const baseRecordSchema = z.object({
  id: ulid,
  client_id: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable(),
});

export const syncDemoSchema = baseRecordSchema.extend({
  label: z.string().min(1).max(120),
  value: z.number().finite(),
});

export type SyncDemo = z.infer<typeof syncDemoSchema>;

/** Sesión de usuario cacheada offline (PRD §3.4: indispensble offline, expira por inactividad 5 días). */
export const sessionSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  roles: z.array(z.enum(ROLES)),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  last_active_at: z.string().datetime(),
});

export type CachedSession = z.infer<typeof sessionSchema>;

/** Estado local del PIN: hash PBKDF2 + contador de intentos + lockout. */
export const pinStateSchema = z.object({
  hash: z.string().min(1),
  salt: z.string().min(1),
  iterations: z.number().int().positive(),
  attempts: z.number().int().min(0),
  lockout_until: z.string().datetime().nullable(),
  session: sessionSchema.nullable(),
});

export type PinState = z.infer<typeof pinStateSchema>;

/** Snapshot de auth expirando; expone solo lo que la UI necesita (sin tokens). */
export const authStatusSchema = z.object({
  has_pin: z.boolean(),
  locked: z.boolean(),
  attempts_left: z.number().int().min(0),
  session_valid: z.boolean().nullable(),
});

export type AuthStatus = z.infer<typeof authStatusSchema>;

/** Configuración de bimoneda por dispositivo (PRD §2.6: tasa BCV + moneda). */
export const appConfigSchema = baseRecordSchema.omit({ id: true }).extend({
  /** Registro único global: id fijo 'global' (no ULID, PRD §7.4). */
  id: z.string().min(1),
  base_currency: z.enum(['USD', 'BsD']).default('USD'),
  bcv_rate: z.number().positive().optional(),
  bcv_rate_updated_at: z.string().datetime().optional(),
  bcv_rate_source: z.enum(['BCV_API', 'manual']).optional(),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
