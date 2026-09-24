import { MAX_OUTBOX_ATTEMPTS, MAX_PUSH_BATCH } from '@brian/shared';
import { measureClockOffset, normalizeTimestamp } from './clock';
import { ConflictRegistry, lwwWins, UnsupportedStrategyError } from './lww';
import { markAttempted, toFailed, toPending } from './outbox';
import type { CursorStore, EventLog, LocalStore, OutboxStore, SyncTransport } from './ports';
import type {
  ClockState,
  OutboxEntry,
  PullResult,
  PushResult,
  SyncEventType,
  SyncRecord,
} from './types';

export interface StellarDriveOptions {
  transport: SyncTransport;
  store: LocalStore;
  outbox: OutboxStore;
  cursors: CursorStore;
  events: EventLog;
  clock: ClockState | null;
  registry?: ConflictRegistry;
  /** Entities the engine should sync when `syncAll()` is called. */
  entities?: string[];
}

export class StellarDrive {
  readonly transport: SyncTransport;
  readonly store: LocalStore;
  readonly outbox: OutboxStore;
  readonly cursors: CursorStore;
  readonly events: EventLog;
  readonly registry: ConflictRegistry;
  #clock: ClockState | null;

  constructor(opts: StellarDriveOptions) {
    this.transport = opts.transport;
    this.store = opts.store;
    this.outbox = opts.outbox;
    this.cursors = opts.cursors;
    this.events = opts.events;
    this.registry = opts.registry ?? new ConflictRegistry();
    this.#clock = opts.clock;
  }

  get clock(): ClockState | null {
    return this.#clock;
  }

  /**
   * Recomputes the device<->server clock offset. Must be applied after (re)
   * acquiring a connection so pushed timestamps are normalized (PRD §5.1).
   */
  async measureClock(): Promise<ClockState> {
    const clock = await measureClockOffset(() => this.transport.serverNow());
    this.#clock = clock;
    return clock;
  }

  /** Queues an operation locally; nothing is sent until `pushOutbox()`. */
  async enqueue(entry: OutboxEntry): Promise<void> {
    await this.outbox.add(entry);
  }

  async requeue(opIds: string[]): Promise<void> {
    await this.outbox.requeue(opIds);
  }

  /**
   * Flushes the pending outbox to the server. Idempotent by design: the server
   * dedupes on `id`, so retransmitting a settled operation cannot apply twice
   * (PRD §5.4).
   */
  async pushOutbox(): Promise<PushResult> {
    const pending = await this.outbox.list('pending', MAX_PUSH_BATCH);
    if (pending.length === 0) {
      return { pushed: 0, failed: [] };
    }

    const attempted = pending.map(markAttempted);
    const normalized = this.#clock ? attempted.map((op) => this.#normalize(op)) : attempted;

    try {
      await this.transport.pushBulk(normalized);
      await this.outbox.markSynced(
        normalized.map((op) => op.op_id),
        new Date().toISOString(),
      );
      await this.#record('push', null, `pushed ${normalized.length} ops (batch)`);
      return { pushed: normalized.length, failed: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed = await this.#applyFailureBudget(normalized, message);
      await this.#record('error', null, `push failed: ${message}`);
      return { pushed: 0, failed };
    }
  }

  /** Pulls (and applies) all changes for `entity` since the last cursor. */
  async pullDelta(entity: string): Promise<PullResult> {
    const cursor = await this.cursors.get(entity);
    await this.#record('start', entity, `pull delta from cursor=${cursor ?? 'none'}`);
    const result = await this.#pull(entity, cursor);
    await this.#record('pull', entity, `applied=${result.applied} skipped=${result.skipped}`);
    return result;
  }

  /** Under-demand initial download for `entity`, ignoring any existing cursor (PRD §5.5). */
  async initialSync(entity: string): Promise<PullResult> {
    await this.#record('start', entity, 'initial sync (under demand)');
    const result = await this.#pull(entity, null);
    await this.#record(
      'pull',
      entity,
      `initial applied=${result.applied} skipped=${result.skipped}`,
    );
    return result;
  }

  /** Push pending ops, then pull deltas for every registered entity. */
  async syncAll(): Promise<{ push: PushResult; pulls: PullResult[] }> {
    await this.#record('start', null, 'full sync');
    const push = await this.pushOutbox();
    const pulls: PullResult[] = [];
    for (const entity of this.entities()) {
      pulls.push(await this.pullDelta(entity));
    }
    await this.#record('success', null, `sync complete: push=${push.pushed} pulls=${pulls.length}`);
    return { push, pulls };
  }

  /** Deletes settled outbox entries older than `date` (retention, PRD §5.9). */
  async purgeOutbox(olderThan: Date): Promise<number> {
    const purged = await this.outbox.purgeSynced(olderThan);
    if (purged > 0) {
      await this.#record('success', null, `purged ${purged} settled ops`);
    }
    return purged;
  }

  #entities = new Set<string>();

  /** Registers an entity so `syncAll()` pulls its deltas. */
  registerEntity(entity: string): this {
    this.#entities.add(entity);
    return this;
  }

  entities(): string[] {
    return Array.from(this.#entities);
  }

  async #pull(entity: string, startCursor: string | null): Promise<PullResult> {
    let cursor = startCursor;
    // Preserve the previous cursor when the delta is empty: pulling a full page
    // re-syncs from scratch on the next call (PRD §5.6 rides the cursor).
    let lastCursor = startCursor ?? null;
    let applied = 0;
    let skipped = 0;

    for (;;) {
      const page = await this.transport.pullDelta(entity, cursor);
      for (const record of page.records) {
        if (await this.#applyIncoming(entity, record)) {
          applied += 1;
        } else {
          skipped += 1;
        }
      }
      if (page.records.length === 0) {
        break;
      }
      // Transport contract: nextCursor is set while records were returned (even
      // on the last page). Persisting it lets the next delta pull resume cleanly.
      lastCursor = page.nextCursor;
      cursor = lastCursor;
    }

    await this.cursors.set(entity, lastCursor);
    return { applied, skipped, cursor: lastCursor };
  }

  /** Applies one server record to the local mirror with idempotent + conflict handling. */
  async #applyIncoming(entity: string, incoming: SyncRecord): Promise<boolean> {
    const existing = await this.store.get(entity, incoming.id);

    if (existing === undefined) {
      if (incoming.deleted_at !== null) {
        return false; // tombstone for a record we never had: nothing to delete
      }
      await this.store.upsert(entity, incoming);
      return true;
    }

    // Exact duplicate (same updated_at and deleted_at): already applied.
    if (
      existing.updated_at === incoming.updated_at &&
      existing.deleted_at === incoming.deleted_at
    ) {
      return false;
    }

    const strategy = this.registry.strategyFor(entity);
    let winner: SyncRecord;
    if (strategy === 'lww') {
      winner = lwwWins(existing, incoming);
    } else if (strategy === 'rolePriority') {
      // Extension point wired in Fase 4 (pagos, notas de crédito, despachos).
      throw new UnsupportedStrategyError(strategy, entity);
    } else {
      winner = lwwWins(existing, incoming);
    }

    if (winner.deleted_at !== null) {
      await this.store.softDelete(entity, winner.id, winner.deleted_at);
    } else {
      await this.store.upsert(entity, winner);
    }
    return true;
  }

  /** Corrects record timestamps to the server time frame before pushing. */
  #normalize(op: OutboxEntry): OutboxEntry {
    const clock = this.#clock as ClockState;
    return {
      ...op,
      created_at: normalizeTimestamp(clock, op.created_at),
      updated_at: normalizeTimestamp(clock, op.updated_at),
      deleted_at: op.deleted_at === null ? null : normalizeTimestamp(clock, op.deleted_at),
    };
  }

  async #applyFailureBudget(ops: OutboxEntry[], message: string): Promise<OutboxEntry[]> {
    const failed: OutboxEntry[] = [];
    for (const attempted of ops) {
      const exceeded = attempted.attempts >= MAX_OUTBOX_ATTEMPTS;
      const next = exceeded ? toFailed(attempted, message) : toPending(attempted);
      await this.outbox.update(next);
      if (exceeded) {
        failed.push(next);
      }
    }
    return failed;
  }

  async #record(type: SyncEventType, entity: string | null, detail: string | null): Promise<void> {
    await this.events.record({
      id: crypto.randomUUID(),
      type,
      entity,
      created_at: new Date().toISOString(),
      detail,
    });
  }
}
