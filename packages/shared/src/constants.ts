export const ROLES = ['admin', 'supervisor', 'promotor', 'cobrador'] as const;
export type Role = (typeof ROLES)[number];

export const SYNC_ENTITIES = ['sync_demo'] as const;
export type SyncEntityName = (typeof SYNC_ENTITIES)[number];

export const OUTBOX_RETENTION_DAYS = 7;
export const AUDIT_RETENTION_DAYS = 90;

export const SYNC_PAGE_SIZE = 100;
export const MAX_PUSH_BATCH = 50;
export const MAX_OUTBOX_ATTEMPTS = 3;

export const PIN_MAX_ATTEMPTS = 5;
export const SESSION_INACTIVITY_DAYS = 5;
