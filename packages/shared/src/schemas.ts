import { z } from 'zod';
import { DEFAULT_CREDITO_DIAS, DEFAULT_CREDITO_LIMITE, ROLES } from './constants';

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

/** Consentimiento informado del cliente (PRD §3.5): registrado al crear el
 *  cliente y antes de capturar fotos. `foto_documento` = documento de
 *  identidad (opcional, solo con aviso explícito). */
export const consentimientoSchema = z
  .object({
    fecha: z.string().datetime(),
    foto_casa: z.boolean().default(false),
    foto_documento: z.boolean().default(false),
    aviso_documento: z.boolean().default(false),
  })
  .refine((c) => !c.foto_documento || c.aviso_documento, {
    message: 'foto_documento requiere aviso_documento (consentimiento previo, §3.5)',
  });

export type Consentimiento = z.infer<typeof consentimientoSchema>;

/** Cliente del negocio (PRD §2.5): sincroniza por LWW (no crítica §5.1). El
 *  crédito por defecto es 1 bolsa/pack con vencimiento de 15 días. */
export const clienteSchema = baseRecordSchema.extend({
  nombre: z.string().min(1).max(200),
  documento: z.string().min(1).max(30).optional(),
  telefono: z.string().min(1).max(30).optional(),
  direccion: z.string().min(1).max(400).optional(),
  lat: z.number().finite().nullable().optional(),
  lng: z.number().finite().nullable().optional(),
  plus_code: z.string().min(1).max(40).optional(),
  zona_id: z.string().min(1).max(64).nullable().optional(),
  consentimiento: consentimientoSchema,
  credito_limite: z.number().positive().default(DEFAULT_CREDITO_LIMITE),
  credito_dias: z.number().int().positive().default(DEFAULT_CREDITO_DIAS),
  score: z.number().int().min(0).max(100).nullable().default(null),
  score_override: z.number().int().min(0).max(100).nullable().default(null),
  score_grado: z.enum(['A', 'B', 'C', 'D', 'E']).nullable().default(null),
  created_by: z.string().min(1),
  updated_by: z.string().min(1),
});

export type Cliente = z.infer<typeof clienteSchema>;

/** Zona geográfica (PRD §2.8 módulo 3): zona → municipio → estado. */
export const zonaSchema = baseRecordSchema.extend({
  nombre: z.string().min(1).max(200),
  municipio: z.string().min(1).max(200),
  estado: z.string().min(1).max(200),
  lat: z.number().finite().nullable().optional(),
  lng: z.number().finite().nullable().optional(),
  plus_code: z.string().min(1).max(40).optional(),
});

export type Zona = z.infer<typeof zonaSchema>;

/**
 * ítem del catálogo de venta (PRD §2.2): sin inventario (§2.3 fuera del MVP),
 * catálogo configurable por admin con precio según condición (crédito/contado)
 * y canal (mayor/detal). Sincroniza por LWW (no crítica §5.1).
 */
export const itemSchema = baseRecordSchema.extend({
  nombre: z.string().min(1).max(200),
  precio_credito_mayor: z.number().positive(),
  precio_credito_detal: z.number().positive(),
  precio_contado_mayor: z.number().positive(),
  precio_contado_detal: z.number().positive(),
});

export type Item = z.infer<typeof itemSchema>;

/** Condición de pago de un despacho (PRD §2.2): crédito o contado. */
export const CONDICIONES = ['credito', 'contado'] as const;
export type Condicion = (typeof CONDICIONES)[number];

/** Canal de venta (PRD §2.2): mayor o detal. */
export const CANALES = ['mayor', 'detal'] as const;
export type Canal = (typeof CANALES)[number];

/**
 * Estado de un despacho (PRD §2.6 inmutabilidad): `pedido` (promotor toma el
 * pedido), `entregado` (inmutable, se revierte con nota de crédito en Fase 4),
 * `anulado` (fase 4 nota de débito/crédito). Eliminable solo en `pedido`
 * (permiso `delete_dispatch_pending`).
 */
export const DESPACHO_ESTADOS = ['pedido', 'entregado', 'anulado'] as const;
export type DespachoEstado = (typeof DESPACHO_ESTADOS)[number];

/** Línea de un despacho: ítem + cantidad + precio unitario de la condición/canal. */
export const despachoItemSchema = z.object({
  item_id: z.string().min(1).max(64),
  nombre: z.string().min(1).max(200),
  cantidad: z.number().int().positive(),
  precio_unitario: z.number().positive(),
});

export type DespachoItem = z.infer<typeof despachoItemSchema>;

/**
 * Despacho / nota de entrega (PRD §2.6, entidad crítica §5.1): venta tomada por
 * el promotor y entregada por el supervisor. Modelado preparado para facturación
 * electrónica (totales, tasa BCV snapshot, nº de control). `editor_role` es la
 * prioridad por rol para conflictos de sync (regla crítica ≠ LWW).
 */
export const despachoSchema = baseRecordSchema.extend({
  nro_control: z.string().min(1).max(40),
  cliente_id: z.string().min(1).max(64),
  cliente_nombre: z.string().min(1).max(200),
  condicion: z.enum(CONDICIONES),
  canal: z.enum(CANALES),
  lineas: z.array(despachoItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  tasa_bcv: z.number().positive(),
  total: z.number().nonnegative(),
  estado: z.enum(DESPACHO_ESTADOS).default('pedido'),
  /** Aprobación de descuento (§3.3): admin 1 paso, supervisor 2. Null = sin descuento. */
  descuento_pct: z.number().min(0).max(100).default(0),
  descuento_aprobado_por: z.string().nullable().default(null),
  descuento_pasos: z.number().int().positive().nullable().default(null),
  created_by: z.string().min(1),
  updated_by: z.string().min(1),
  editor_role: z.enum(ROLES).default('promotor'),
  entregado_at: z.string().datetime().nullable().default(null),
});

export type Despacho = z.infer<typeof despachoSchema>;
