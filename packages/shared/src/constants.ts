export const ROLES = ['admin', 'supervisor', 'promotor', 'cobrador'] as const;
export type Role = (typeof ROLES)[number];

/**
 * Permisos del PRD §3.3. `authorize_credit` y `discount` distinguen la cantidad
 * de pasos de aprobación por rol (admin = 1, supervisor = 2); la UI lo resuelve
 * con `approvalSteps(permission, roles)`.
 */
export const PERMISSIONS = [
  'authorize_credit',
  'edit_client',
  'delete_dispatch_pending',
  'close_route',
  'view_saldos',
  'view_kpis',
  'discount',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Matriz rol → permisos (PRD §3.2 tabla + §3.3 permisos clave). */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [...PERMISSIONS],
  supervisor: [
    'authorize_credit',
    'edit_client',
    'delete_dispatch_pending',
    'close_route',
    'view_saldos',
    'view_kpis',
    'discount',
  ],
  promotor: ['delete_dispatch_pending'],
  cobrador: ['close_route', 'view_saldos'],
};

/** Pasos de aprobación: admin = 1, supervisor = 2 (§3.3). Otros roles no aprueban. */
export const APPROVAL_STEPS: Record<Permission, Partial<Record<Role, number>>> = {
  authorize_credit: { admin: 1, supervisor: 2 },
  discount: { admin: 1, supervisor: 2 },
  edit_client: {},
  delete_dispatch_pending: {},
  close_route: {},
  view_saldos: {},
  view_kpis: {},
};

/** Cualquier usuario con ≥1 de estos roles ve el indicador "crédito bloqueado". */
export const CREDIT_BLOCK_INDICATOR_ROLES = ['promotor'] as const;

/** Entidades que el app sincroniza con el servidor. `sync_demo` es de Fase 0. */
export const SYNC_ENTITIES = ['sync_demo', 'app_users', 'app_config'] as const;
export type SyncEntityName = (typeof SYNC_ENTITIES)[number];

export const OUTBOX_RETENTION_DAYS = 7;
export const AUDIT_RETENTION_DAYS = 90;

export const SYNC_PAGE_SIZE = 100;
export const MAX_PUSH_BATCH = 50;
export const MAX_OUTBOX_ATTEMPTS = 3;

export const PIN_MAX_ATTEMPTS = 5;
export const SESSION_INACTIVITY_DAYS = 5;
