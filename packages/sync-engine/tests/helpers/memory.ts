import type {
  CursorStore,
  DeltaPage,
  EventLog,
  LocalStore,
  OutboxEntry,
  OutboxStore,
  OutboxStatus,
  SyncEvent,
  SyncRecord,
  SyncTransport,
} from '../../src';

export class MemoryStore implements LocalStore {
  db = new Map<string, Map<string, SyncRecord>>();

  async get(entity: string, id: string): Promise<SyncRecord | undefined> {
    return this.db.get(entity)?.get(id);
  }

  async upsert(entity: string, record: SyncRecord): Promise<void> {
    const table = this.db.get(entity) ?? new Map<string, SyncRecord>();
    table.set(record.id, { ...record });
    this.db.set(entity, table);
  }

  async softDelete(entity: string, id: string, deletedAt: string): Promise<void> {
    const record = await this.get(entity, id);
    if (!record) {
      return;
    }
    await this.upsert(entity, { ...record, deleted_at: deletedAt, updated_at: deletedAt });
  }
}

export class MemoryOutbox implements OutboxStore {
  rows: OutboxEntry[] = [];

  async add(entry: OutboxEntry): Promise<void> {
    this.rows.push({ ...entry });
  }

  async list(status: OutboxStatus, limit?: number): Promise<OutboxEntry[]> {
    const filtered = this.rows.filter((r) => r.status === status);
    return typeof limit === 'number' ? filtered.slice(0, limit) : filtered;
  }

  async listAll(): Promise<OutboxEntry[]> {
    return this.rows.map((r) => ({ ...r }));
  }

  async update(entry: OutboxEntry): Promise<void> {
    const index = this.rows.findIndex((r) => r.op_id === entry.op_id);
    if (index >= 0) {
      this.rows[index] = { ...entry };
    }
  }

  async markSynced(opIds: string[], syncedAt: string): Promise<void> {
    for (const r of this.rows) {
      if (opIds.includes(r.op_id)) {
        r.status = 'synced';
        r.synced_at = syncedAt;
      }
    }
  }

  async markFailed(opIds: string[], error: string): Promise<void> {
    for (const r of this.rows) {
      if (opIds.includes(r.op_id)) {
        r.status = 'failed';
        r.last_error = error;
      }
    }
  }

  async requeue(opIds: string[]): Promise<void> {
    for (const r of this.rows) {
      if (opIds.includes(r.op_id)) {
        r.status = 'pending';
        r.last_error = null;
      }
    }
  }

  async purgeSynced(olderThan: Date): Promise<number> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => {
      const settled = r.status === 'synced' && r.synced_at !== null;
      return !(settled && r.synced_at !== null && new Date(r.synced_at) < olderThan);
    });
    return before - this.rows.length;
  }
}

export class MemoryCursors implements CursorStore {
  private cursors = new Map<string, string>();

  async get(entity: string): Promise<string | null> {
    return this.cursors.get(entity) ?? null;
  }

  async set(entity: string, cursor: string | null): Promise<void> {
    if (cursor === null) {
      this.cursors.delete(entity);
    } else {
      this.cursors.set(entity, cursor);
    }
  }
}

export class MemoryEvents implements EventLog {
  events: SyncEvent[] = [];

  async record(event: SyncEvent): Promise<void> {
    this.events.push(event);
  }
}

type ServerRow = SyncRecord & { deleted_at: string | null };

/**
 * In-memory HTTP stand-in. The "server" dedupes by id and applies LWW guards
 * (behaves like an upsert with a WHERE updated_at guard), so replayed ops never
 * apply twice and stale writes cannot clobber newer ones (PRD §5.4, §5.1).
 */
export class MemoryTransport implements SyncTransport {
  server = new Map<string, Map<string, ServerRow>>();
  failNextPush = false;
  pageSize = 50;
  serverNowValue = '2024-01-01T00:00:00.000Z';

  setNow(iso: string): void {
    this.serverNowValue = iso;
  }

  seed(entity: string, records: SyncRecord[]): void {
    const table = this.server.get(entity) ?? new Map<string, ServerRow>();
    for (const r of records) {
      table.set(r.id, { ...r });
    }
    this.server.set(entity, table);
  }

  async serverNow(): Promise<string> {
    return this.serverNowValue;
  }

  async pushBulk(entries: OutboxEntry[]): Promise<void> {
    if (this.failNextPush) {
      this.failNextPush = false;
      throw new Error('SIMULATED_NETWORK_ERROR');
    }
    for (const e of entries) {
      const table = this.server.get(e.entity) ?? new Map<string, ServerRow>();
      const existing = table.get(e.id);
      // Simulates ON CONFLICT (id) with LWW guard for updates: a duplicate/older
      // write is dropped (idempotent), a newer write replaces the row.
      const applied =
        existing === undefined ||
        existing.updated_at < e.updated_at ||
        (existing.updated_at === e.updated_at && existing.deleted_at !== e.deleted_at);
      if (applied) {
        table.set(e.id, {
          id: e.id,
          client_id: e.client_id,
          created_at: e.created_at,
          updated_at: e.updated_at,
          deleted_at: e.deleted_at,
        });
      }
      this.server.set(e.entity, table);
    }
  }

  async pullDelta(entity: string, cursor: string | null): Promise<DeltaPage> {
    const table = this.server.get(entity) ?? new Map<string, ServerRow>();
    let rows = Array.from(table.values()).sort(
      (a, b) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id),
    );
    if (cursor) {
      const [ts, id] = cursor.split('::') as [string, string];
      rows = rows.filter((r) => r.updated_at > ts || (r.updated_at === ts && r.id > id));
    }
    const page = rows.slice(0, this.pageSize);
    if (page.length === 0) {
      return { records: [], nextCursor: null };
    }
    const last = page[page.length - 1]!;
    return {
      records: page,
      nextCursor: `${last.updated_at}::${last.id}`,
    };
  }
}
