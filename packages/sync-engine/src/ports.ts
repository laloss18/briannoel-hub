import type { OutboxEntry, OutboxStatus, SyncEvent, SyncRecord } from './types';

/** Local mirror of synced records (IndexedDB in the PWA, in-memory in tests). */
export interface LocalStore {
  get(entity: string, id: string): Promise<SyncRecord | undefined>;
  upsert(entity: string, record: SyncRecord): Promise<void>;
  softDelete(entity: string, id: string, deletedAt: string): Promise<void>;
}

export interface OutboxStore {
  add(entry: OutboxEntry): Promise<void>;
  list(status: OutboxStatus, limit?: number): Promise<OutboxEntry[]>;
  listAll(): Promise<OutboxEntry[]>;
  update(entry: OutboxEntry): Promise<void>;
  markSynced(opIds: string[], syncedAt: string): Promise<void>;
  markFailed(opIds: string[], error: string): Promise<void>;
  requeue(opIds: string[]): Promise<void>;
  purgeSynced(olderThan: Date): Promise<number>;
}

export interface CursorStore {
  get(entity: string): Promise<string | null>;
  set(entity: string, cursor: string | null): Promise<void>;
}

export interface EventLog {
  record(event: SyncEvent): Promise<void>;
}

/** Pull page returned by the transport for a delta query. */
export interface DeltaPage {
  records: SyncRecord[];
  nextCursor: string | null;
}

export interface PullOptions {
  limit?: number;
}

export interface SyncTransport {
  pullDelta(entity: string, cursor: string | null, opts?: PullOptions): Promise<DeltaPage>;
  pushBulk(entries: OutboxEntry[]): Promise<void>;
  serverNow(): Promise<string>;
}
