export type SyncOperation = 'create' | 'update' | 'softDelete';

/** Any record persisted by the sync engine (mirrored in IndexedDB and Postgres). */
export interface SyncRecord {
  id: string;
  client_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * A `SyncRecord` with entity-specific payload columns merged in. The payload
 * default (`Record<string, unknown>`) matches the PRD: `data` holds opaque,
 * entity-specific columns; apps narrow `T` per entity (e.g.
 * `SyncRecordWithData<{ cantidad: number; precio: number }>`).
 */
export type SyncRecordWithData<T extends object = object> = SyncRecord & T;

export type OutboxStatus = 'pending' | 'synced' | 'failed';

/**
 * An outbox transaction: the LWW-level fields (id, created_at, updated_at,
 * deleted_at) plus outbox bookkeeping. Declared as an intersection type alias,
 * not an interface, because the payload columns (`T`) extend the base record
 * with an index signature; a type alias lets apps narrow the payload per entity
 * (e.g. `OutboxEntry<{ cantidad: number; precio: number }>`).
 */
export type OutboxEntry<T extends object = object> = SyncRecordWithData<T> & {
  op_id: string;
  entity: string;
  operation: SyncOperation;
  status: OutboxStatus;
  attempts: number;
  last_error: string | null;
  synced_at: string | null;
};

export type SyncEventType = 'start' | 'success' | 'push' | 'pull' | 'error';

export interface SyncEvent {
  id: string;
  type: SyncEventType;
  entity: string | null;
  created_at: string;
  detail: string | null;
}

export interface ClockState {
  /** deviceTs + offsetMs = serverTs (estimated). */
  offsetMs: number;
  measured_at: string;
}

export interface PushResult {
  pushed: number;
  failed: OutboxEntry[];
}

export interface PullResult {
  applied: number;
  skipped: number;
  cursor: string | null;
}
