import type { OutboxEntry, OutboxStatus, SyncOperation, SyncRecord } from './types';
import { newOpId } from './id';

export interface CreateOutboxInput<T extends object> extends SyncRecord {
  entity: string;
  operation: SyncOperation;
  data: T;
}

/**
 * Builds a new outbox entry. The record-level fields (id, created_at,
 * updated_at, deleted_at) are the ones LWW/push will operate on; `data` holds
 * entity-specific columns.
 */
export function createOutboxEntry<T extends object>(input: CreateOutboxInput<T>): OutboxEntry<T> {
  return {
    op_id: newOpId(),
    entity: input.entity,
    operation: input.operation,
    id: input.id,
    client_id: input.client_id,
    created_at: input.created_at,
    updated_at: input.updated_at,
    deleted_at: input.deleted_at,
    ...input.data,
    status: 'pending',
    attempts: 0,
    last_error: null,
    synced_at: null,
  };
}

export function markAttempted(op: OutboxEntry): OutboxEntry {
  return { ...op, attempts: op.attempts + 1 };
}

/** Persistently fails an op after it exceeded its retry budget (PRD §5.3). */
export function toFailed(op: OutboxEntry, error: string): OutboxEntry {
  return { ...op, status: 'failed', last_error: error };
}

export function toPending(op: OutboxEntry): OutboxEntry {
  return { ...op, status: 'pending', last_error: null };
}

export type OutboxStatusFilter = OutboxStatus | 'all';
