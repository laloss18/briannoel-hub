import Dexie, { type EntityTable } from 'dexie';
import type { StoredState } from '@brian/pin-auth';
import type {
  CursorStore,
  EventLog,
  LocalStore,
  OutboxEntry,
  OutboxStore,
  SyncEvent,
  SyncRecord,
  SyncRecordWithData,
} from '@brian/sync-engine';

/** Espejo Dexie (PRD §5.5): la app usa IndexedDB, el engine solo ve ports. */
export const hub = new Dexie('briannoel-hub') as Dexie & {
  records: EntityTable<SyncRecordWithData & { entity: string }, 'id'>;
  outbox: EntityTable<OutboxEntry & { entity: string }, 'op_id'>;
  cursors: EntityTable<{ entity: string; cursor: string | null }, 'entity'>;
  events: EntityTable<SyncEvent & { entity: string | null }, 'id'>;
  pin: EntityTable<{ key: 'state'; state: StoredState }, 'key'>;
};

hub.version(1).stores({
  records: 'id, entity, updated_at, deleted_at',
  outbox: 'op_id, entity, status, updated_at',
  cursors: 'entity',
  events: 'id, entity, created_at',
});

hub.version(2).stores({
  records: 'id, entity, updated_at, deleted_at',
  outbox: 'op_id, entity, status, updated_at',
  cursors: 'entity',
  events: 'id, entity, created_at',
  pin: 'key',
});

/** LocalStore → Dexie (mirror local idempotente, PRD §5.2). */
export class DexieLocalStore implements LocalStore {
  async get(entity: string, id: string): Promise<SyncRecord | undefined> {
    return hub.records
      .where('id')
      .equals(id)
      .and((r) => r.entity === entity)
      .first();
  }
  async upsert(entity: string, record: SyncRecord): Promise<void> {
    await hub.records.put({ ...(record as SyncRecordWithData & { entity: string }), entity });
  }
  async softDelete(entity: string, id: string, deletedAt: string): Promise<void> {
    const row = await hub.records
      .where('id')
      .equals(id)
      .and((r) => r.entity === entity)
      .first();
    if (row) await hub.records.put({ ...row, deleted_at: deletedAt, updated_at: deletedAt });
  }
}

/** OutboxStore → Dexie (cola idempotente + intentos, PRD §5.3). */
export class DexieOutbox implements OutboxStore {
  async add(entry: OutboxEntry): Promise<void> {
    await hub.outbox.put(entry as OutboxEntry & { entity: string });
  }
  async list(status: OutboxEntry['status'], limit?: number): Promise<OutboxEntry[]> {
    const rows = await hub.outbox.where('status').equals(status).toArray();
    return limit ? rows.slice(0, limit) : rows;
  }
  async listAll(): Promise<OutboxEntry[]> {
    return hub.outbox.toArray();
  }
  async update(entry: OutboxEntry): Promise<void> {
    await hub.outbox.put(entry as OutboxEntry & { entity: string });
  }
  async markSynced(opIds: string[], syncedAt: string): Promise<void> {
    await hub.transaction('rw', hub.outbox, async () => {
      for (const id of opIds) {
        const e = await hub.outbox.get(id);
        if (e)
          await hub.outbox.put({
            ...(e as OutboxEntry & { entity: string }),
            status: 'synced',
            synced_at: syncedAt,
          });
      }
    });
  }
  async markFailed(opIds: string[], error: string): Promise<void> {
    await hub.transaction('rw', hub.outbox, async () => {
      for (const id of opIds) {
        const e = await hub.outbox.get(id);
        if (e)
          await hub.outbox.put({
            ...(e as OutboxEntry & { entity: string }),
            status: 'failed',
            last_error: error,
          });
      }
    });
  }
  async requeue(opIds: string[]): Promise<void> {
    await hub.transaction('rw', hub.outbox, async () => {
      for (const id of opIds) {
        const e = await hub.outbox.get(id);
        if (e)
          await hub.outbox.put({ ...(e as OutboxEntry & { entity: string }), status: 'pending' });
      }
    });
  }
  async purgeSynced(olderThan: Date): Promise<number> {
    const rows = await hub.outbox
      .where('status')
      .equals('synced')
      .filter((e) => (e.synced_at ? new Date(e.synced_at) < olderThan : false))
      .toArray();
    await hub.outbox.bulkDelete(rows.map((r) => r.op_id));
    return rows.length;
  }
}

/** CursorStore → Dexie (cursor por entidad para delta §5.6). */
export class DexieCursorStore implements CursorStore {
  async get(entity: string): Promise<string | null> {
    const row = await hub.cursors.get(entity);
    return row?.cursor ?? null;
  }
  async set(entity: string, cursor: string | null): Promise<void> {
    await hub.cursors.put({ entity, cursor });
  }
}

/** EventLog → Dexie (auditoría sync_events, PRD §5.7). */
export class DexieEventLog implements EventLog {
  async record(event: SyncEvent): Promise<void> {
    await hub.events.put({ ...event, entity: event.entity ?? null });
  }
}
