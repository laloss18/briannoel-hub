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

/** Nombre de usuario: identidad visible de la app (PRD §3.4). Alfanumérico,
 *  sin espacios ni acentos (3–24), para poder escribirlo en un formulario y
 *  mostrarlo en cualquier lugar sin formato. */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'el usuario necesita al menos 3 caracteres')
  .max(24, 'el usuario admite hasta 24 caracteres')
  .regex(/^[a-zA-Z0-9._-]+$/, 'solo letras, números, punto, guion y guion bajo');

/** Sesión de usuario cacheada offline (PRD §3.4: indispensble offline, expira por inactividad 5 días).
 *  `username` es opcional: las sesiones cacheadas antes del alta por admin no lo traen y
 *  la UI degrada al email. El email es la clave de auditoría, nunca cambia (PRD §3.4). */
export const sessionSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  username: usernameSchema.optional(),
  roles: z.array(z.enum(ROLES)),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  last_active_at: z.string().datetime(),
});

export type CachedSession = z.infer<typeof sessionSchema>;

/** Perfil de usuario materializado por la RPC `upsert_app_user` (entidad `app_users`,
 *  solo en servidor; nunca en la outbox del dispositivo — lo escribe el admin).
 *  `id` es el `user_id` de auth (uuid en texto), no un ULID: así el perfil y la
 *  cuenta comparten clave. */
export const appUserSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  email: z.string().email(),
  username: usernameSchema,
  name: z.string().trim().optional(),
  roles: z.array(z.enum(ROLES)),
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  deleted_at: z.string().datetime().nullable(),
});

export type AppUser = z.infer<typeof appUserSchema>;

/** Username → email: índice de display para pintar identidades sin tocar el
 *  dominio (los documentos guardan email, no username). La app lo mantiene en
 *  memoria; `identidadDe` resuelve con fallback al email si aún no llegó. */
export type IdentidadIndice = ReadonlyMap<string, string>;

/** Nombre a mostrar para un email: el username si está en el índice, el email si no. */
export function identidadDe(indice: IdentidadIndice | undefined, email: string | null | undefined): string {
  if (!email) return '—';
  const username = indice?.get(email.toLowerCase());
  return username ?? email;
}

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
  telefono2: z.string().min(1).max(30).optional(),
  notas_referencia: z.string().min(1).max(400).optional(),
  direccion: z.string().min(1).max(400).optional(),
  lat: z.number().finite().nullable().optional(),
  lng: z.number().finite().nullable().optional(),
  plus_code: z.string().min(1).max(40).optional(),
  zona_id: z.string().min(1).max(64).nullable().optional(),
  consentimiento: consentimientoSchema,
  /** Fotos comprimidas del registro del cliente (fachada, cliente, cédula):
   *  data URL JPEG ~800px q70, viajan dentro de la entidad con la sync (§8.6). */
  foto_fachada: z.string().optional(),
  foto_cliente: z.string().optional(),
  foto_cedula: z.string().optional(),
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
 * catálogo configurable por admin con precio según la condición (crédito/contado).
 * Sincroniza por LWW (no crítica §5.1). (El canal mayor/detal se retiró en Fase 3.)
 */
export const itemSchema = baseRecordSchema.extend({
  nombre: z.string().min(1).max(200),
  precio_contado: z.number().positive(),
  precio_credito: z.number().positive(),
});

export type Item = z.infer<typeof itemSchema>;

/**
 * Persona de la operación (promotor/entregador, PRD §3.1 roster): lista que el
 * admin gestiona (alta/edición/baja) y se sincroniza para que al tomar/corregir
 * un pedido se elija QUIÉN captó el cliente y quién lo entregó. Entidad LWW.
 */
export const personalSchema = baseRecordSchema.extend({
  nombre: z.string().min(1).max(120),
  telefono: z.string().min(1).max(30).optional(),
  email: z.string().email().optional(),
  rol: z.enum(ROLES).default('promotor'),
  created_by: z.string().min(1),
  updated_by: z.string().min(1),
});

export type Personal = z.infer<typeof personalSchema>;

/** Condición de pago de un despacho (PRD §2.2): crédito o contado. */
export const CONDICIONES = ['credito', 'contado'] as const;
export type Condicion = (typeof CONDICIONES)[number];

/**
 * Estado de un despacho (PRD §2.6 inmutabilidad): `pedido` (promotor toma el
 * pedido), `entregado` (inmutable, se revierte con nota de crédito en Fase 4),
 * `anulado` (fase 4 nota de débito/crédito). Eliminable solo en `pedido`
 * (permiso `delete_dispatch_pending`).
 */
export const DESPACHO_ESTADOS = ['pedido', 'entregado', 'anulado'] as const;
export type DespachoEstado = (typeof DESPACHO_ESTADOS)[number];

/** Línea de un despacho: ítem + cantidad + precio unitario de la condición. */
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
  lineas: z.array(despachoItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  /** Snapshot de la tasa BCV (Bs/USD) solo útil para registrar pagos (§2.6);
   *  si no hay tasa configurada el despacho se cierra igual (0 = sin snapshot). */
  tasa_bcv: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  estado: z.enum(DESPACHO_ESTADOS).default('pedido'),
  /** Aprobación de descuento (§3.3): admin 1 paso, supervisor 2. Null = sin descuento.
   *  `descuento_pct` aplica en modo porcentaje; `descuento_monto_usd` en modo
   *  monto fijo (una u otra, nunca ambas). */
  descuento_pct: z.number().min(0).max(100).default(0),
  descuento_monto_usd: z.number().nonnegative().nullable().default(null),
  descuento_aprobado_por: z.string().nullable().default(null),
  descuento_pasos: z.number().int().positive().nullable().default(null),
  /** Quién captó al cliente (nombre del roster `personal`): se elige al
   *  registrar la venta; fallback de visualización = `cliente.created_by`. */
  promotor: z.string().nullable().default(null),
  /** Supervisor a cargo del pedido (se elige al registrar; auto si quien
   *  registra es supervisor). Solo ese supervisor (o el admin) gestiona el
   *  pedido: editar, entregar, eliminar. */
  supervisor: z.string().nullable().default(null),
  created_by: z.string().min(1),
  updated_by: z.string().min(1),
  editor_role: z.enum(ROLES).default('promotor'),
  entregado_at: z.string().datetime().nullable().default(null),
  /** Quién entregó el despacho (nombre del roster `personal` o email de quien
   *  marcó la entrega). */
  entregado_por: z.string().nullable().default(null),
});

export type Despacho = z.infer<typeof despachoSchema>;
