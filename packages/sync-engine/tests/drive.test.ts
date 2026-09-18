import { describe, expect, it } from 'vitest';
import { StellarDrive, createOutboxEntry, UnsupportedStrategyError } from '../src';
import type { ClockState } from '../src';
import {
  MemoryCursors,
  MemoryEvents,
  MemoryOutbox,
  MemoryStore,
  MemoryTransport,
} from './helpers/memory';

function makeDrive(transport = new MemoryTransport(), clock: ClockState | null = null) {
  const store = new MemoryStore();
  const outbox = new MemoryOutbox();
  const cursors = new MemoryCursors();
  const events = new MemoryEvents();
  const drive = new StellarDrive({
    transport,
    store,
    outbox,
    cursors,
    events,
    clock,
  }).registerEntity('sync_demo');
  return { drive, transport, store, outbox, cursors, events };
}

function demoEntry(
  id: string,
  updatedAt: string,
  operation: 'create' | 'update' | 'softDelete' = 'create',
  createdAt = updatedAt,
) {
  return createOutboxEntry({
    id,
    client_id: 'device-1',
    created_at: createdAt,
    updated_at: updatedAt,
    deleted_at: null,
    entity: 'sync_demo',
    operation,
    data: { label: `rec-${id}`, value: 1 },
  });
}

describe('initialSync / under-demand', () => {
  it('downloads everything for an entity from scratch', async () => {
    const t = new MemoryTransport();
    t.seed('sync_demo', [
      {
        id: 'a',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        deleted_at: null,
      },
      {
        id: 'b',
        created_at: '2024-01-01T00:00:01.000Z',
        updated_at: '2024-01-01T00:00:01.000Z',
        deleted_at: null,
      },
    ]);
    const { drive, store, cursors } = makeDrive(t);

    const result = await drive.initialSync('sync_demo');

    expect(result.applied).toBe(2);
    expect(await store.get('sync_demo', 'a')).toBeDefined();
    expect(await store.get('sync_demo', 'b')).toBeDefined();
    expect(await cursors.get('sync_demo')).not.toBeNull();
  });

  it('paginates large initial downloads using the opaque cursor', async () => {
    const t = new MemoryTransport();
    const t0 = Date.parse('2024-01-01T00:00:00.000Z');
    t.seed(
      'sync_demo',
      Array.from({ length: 120 }, (_, i) => ({
        id: `id-${String(i).padStart(3, '0')}`,
        created_at: new Date(t0 + i).toISOString(),
        updated_at: new Date(t0 + i).toISOString(),
        deleted_at: null,
      })),
    );
    const { drive, store } = makeDrive(t);

    const result = await drive.initialSync('sync_demo');

    expect(result.applied).toBe(120);
    expect(store.db.get('sync_demo')?.size).toBe(120);
  });

  it('skips tombstones for records never seen locally', async () => {
    const t = new MemoryTransport();
    t.seed('sync_demo', [
      {
        id: 'ghost',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:10.000Z',
        deleted_at: '2024-01-01T00:00:10.000Z',
      },
    ]);
    const { drive } = makeDrive(t);

    const result = await drive.initialSync('sync_demo');

    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
  });
});

describe('pullDelta / cursor', () => {
  it('pulls only changes since the last cursor', async () => {
    const t = new MemoryTransport();
    t.seed('sync_demo', [
      {
        id: 'a',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        deleted_at: null,
      },
    ]);
    const { drive } = makeDrive(t);
    await drive.initialSync('sync_demo');

    t.seed('sync_demo', [
      {
        id: 'c',
        created_at: '2024-01-01T00:00:02.000Z',
        updated_at: '2024-01-01T00:00:02.000Z',
        deleted_at: null,
      },
    ]);

    const result = await drive.pullDelta('sync_demo');

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('is idempotent: a repeated pull applies nothing twice', async () => {
    const t = new MemoryTransport();
    t.seed('sync_demo', [
      {
        id: 'a',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        deleted_at: null,
      },
    ]);
    const { drive } = makeDrive(t);
    await drive.initialSync('sync_demo');

    const again = await drive.pullDelta('sync_demo');

    // The cursor is at the head, so the repeated pull fetches nothing.
    expect(again.applied).toBe(0);
    expect(again.skipped).toBe(0);
  });

  it('resolves conflicts by LWW when pulling a stale record', async () => {
    const t = new MemoryTransport();
    const { drive, store } = makeDrive(t);
    await store.upsert('sync_demo', {
      id: 'a',
      updated_at: '2024-01-01T00:00:05.000Z',
      created_at: '2024-01-01T00:00:00.000Z',
      deleted_at: null,
    });
    t.seed('sync_demo', [
      {
        id: 'a',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:10.000Z',
        deleted_at: null,
      },
    ]);

    const result = await drive.pullDelta('sync_demo');

    expect(result.applied).toBe(1);
    expect((await store.get('sync_demo', 'a'))?.updated_at).toBe('2024-01-01T00:00:10.000Z');
  });

  it('propagates soft deletes from the server', async () => {
    const t = new MemoryTransport();
    t.seed('sync_demo', [
      {
        id: 'a',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        deleted_at: null,
      },
    ]);
    const { drive, store } = makeDrive(t);
    await drive.initialSync('sync_demo');

    t.seed('sync_demo', [
      {
        id: 'a',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:08.000Z',
        deleted_at: '2024-01-01T00:00:08.000Z',
      },
    ]);
    await drive.pullDelta('sync_demo');

    expect((await store.get('sync_demo', 'a'))?.deleted_at).toBe('2024-01-01T00:00:08.000Z');
  });

  it('rejects rolePriority conflicts until the strategy lands in Fase 4', async () => {
    const t = new MemoryTransport();
    const { drive, store } = makeDrive(t);
    drive.registry.register('sync_demo', 'rolePriority');
    await store.upsert('sync_demo', {
      id: 'a',
      updated_at: '2024-01-01T00:00:05.000Z',
      created_at: '2024-01-01T00:00:00.000Z',
      deleted_at: null,
    });
    t.seed('sync_demo', [
      {
        id: 'a',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:10.000Z',
        deleted_at: null,
      },
    ]);

    await expect(drive.pullDelta('sync_demo')).rejects.toBeInstanceOf(UnsupportedStrategyError);
  });
});

describe('pushOutbox / idempotency', () => {
  it('flushes pending ops and marks them synced', async () => {
    const { drive, transport, outbox } = makeDrive();
    await drive.enqueue(demoEntry('a', '2024-01-01T00:00:00.000Z'));

    const result = await drive.pushOutbox();

    expect(result.pushed).toBe(1);
    expect(transport.server.get('sync_demo')?.size).toBe(1);
    expect((await outbox.list('pending')).length).toBe(0);
    expect((await outbox.list('synced')).length).toBe(1);
  });

  it('does not re-send ops that were already pushed (idempotent push)', async () => {
    const { drive } = makeDrive();
    await drive.enqueue(demoEntry('a', '2024-01-01T00:00:00.000Z'));
    await drive.pushOutbox();

    const second = await drive.pushOutbox();

    expect(second.pushed).toBe(0);
  });

  it('never applies a duplicated payment-like op twice server-side', async () => {
    const t = new MemoryTransport();
    const driveA = makeDrive(t);
    const driveB = makeDrive(t);

    const op = demoEntry('same-id', '2024-01-01T00:00:00.000Z');
    await driveA.drive.enqueue(op);
    await driveB.drive.enqueue({ ...op, client_id: 'device-2' });

    await driveA.drive.pushOutbox();
    await driveB.drive.pushOutbox();

    expect(t.server.get('sync_demo')?.size).toBe(1);
  });

  it('moves ops to failed after exhausting the attempt budget and audits the error', async () => {
    const t = new MemoryTransport();
    const { drive, events } = makeDrive(t);
    await drive.enqueue(demoEntry('a', '2024-01-01T00:00:00.000Z'));

    t.failNextPush = true;
    await drive.pushOutbox(); // attempt 1 -> attempts=1, stays pending
    t.failNextPush = true;
    await drive.pushOutbox(); // attempt 2 -> stays pending
    t.failNextPush = true;
    const third = await drive.pushOutbox(); // attempt 3 -> failed (>= MAX_OUTBOX_ATTEMPTS=3)

    expect(third.failed.length).toBe(1);
    expect(third.failed[0]?.status).toBe('failed');
    expect(third.failed[0]?.last_error).toContain('SIMULATED_NETWORK_ERROR');
    expect(events.events.some((e) => e.type === 'error')).toBe(true);
  });

  it('requeues failed ops for manual retry', async () => {
    const t = new MemoryTransport();
    const { drive, outbox } = makeDrive(t);
    await drive.enqueue(demoEntry('a', '2024-01-01T00:00:00.000Z'));
    t.failNextPush = true;
    await drive.pushOutbox();
    t.failNextPush = true;
    await drive.pushOutbox();
    t.failNextPush = true;
    await drive.pushOutbox();

    const failed = await outbox.list('failed');
    await drive.requeue(failed.map((f) => f.op_id));

    expect((await outbox.list('pending')).length).toBe(1);
    expect((await outbox.list('failed')).length).toBe(0);
  });

  it('syncAll pushes then pulls deltas for registered entities', async () => {
    const t = new MemoryTransport();
    const { drive, store } = makeDrive(t);
    await drive.enqueue(demoEntry('a', '2024-01-01T00:00:00.000Z'));
    t.seed('sync_demo', [
      {
        id: 'b',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        deleted_at: null,
      },
    ]);

    const result = await drive.syncAll();

    expect(result.push.pushed).toBe(1);
    // The pull re-fetches what this device just pushed (server cursor unknown)
    // plus the seeded record.
    expect(result.pulls[0]?.applied).toBe(2);
    expect(await store.get('sync_demo', 'b')).toBeDefined();
  });
});

describe('clock skew hardening', () => {
  it('lets the CORRECT clock win after normalization (device 5 min ahead)', async () => {
    // Device A clock runs 5 minutes AHEAD of true time; device B is accurate.
    const t = new MemoryTransport();
    const clockA: ClockState = { offsetMs: -300000, measured_at: '2024-01-01T00:00:00.000Z' };
    const clockB: ClockState = { offsetMs: 0, measured_at: '2024-01-01T00:00:00.000Z' };
    const driveA = makeDrive(t, clockA);
    const driveB = makeDrive(t, clockB);

    // A edits at TRUE 01:00:00Z, but its clock stamps 01:05:00Z.
    await driveA.drive.enqueue(demoEntry('pay', '2024-01-01T01:05:00.000Z'));
    // B edits later at TRUE 01:05:00Z, stamped correctly.
    await driveB.drive.enqueue({
      ...demoEntry('pay', '2024-01-01T01:05:00.000Z'),
      client_id: 'device-2',
    });

    await driveA.drive.pushOutbox();
    await driveB.drive.pushOutbox();

    // B wrote last (true time); normalization must make B's branch win LWW.
    const serverRow = t.server.get('sync_demo')?.get('pay');
    expect(serverRow?.updated_at).toBe('2024-01-01T01:05:00.000Z');
    expect(serverRow?.client_id).toBe('device-2');
  });

  it('measureClock refreshes the drive offset from the transport', async () => {
    const t = new MemoryTransport();
    const { drive } = makeDrive(t);
    await drive.measureClock();
    expect(drive.clock).not.toBeNull();
  });
});

describe('purge (retention)', () => {
  it('removes settled ops older than the retention window', async () => {
    const { drive, outbox } = makeDrive();
    const old = {
      ...demoEntry('a', '2024-01-01T00:00:00.000Z'),
      status: 'synced' as const,
      synced_at: '2024-01-01T00:00:00.000Z',
    };
    await drive.enqueue(old);
    const recent = {
      ...demoEntry('b', '2024-01-10T00:00:00.000Z'),
      status: 'synced' as const,
      synced_at: '2024-01-10T00:00:00.000Z',
    };
    await drive.enqueue(recent);

    const purged = await drive.purgeOutbox(new Date('2024-01-08T00:00:00.000Z'));

    expect(purged).toBe(1);
    expect((await outbox.listAll()).length).toBe(1);
  });
});

describe('volume (200 ops)', () => {
  it('drains 200 queue entries within a reasonable time', async () => {
    const t = new MemoryTransport();
    const { drive } = makeDrive(t);
    const t0 = Date.parse('2024-01-01T00:00:00.000Z');

    for (let i = 0; i < 200; i += 1) {
      await drive.enqueue(demoEntry(`vol-${i}`, new Date(t0 + i).toISOString()));
    }

    const start = performance.now();
    let pushed = 0;
    for (let round = 0; round < 10 && pushed < 200; round += 1) {
      const result = await drive.pushOutbox();
      pushed += result.pushed;
    }
    const elapsed = performance.now() - start;

    expect(pushed).toBe(200);
    expect(t.server.get('sync_demo')?.size).toBe(200);
    expect(elapsed).toBeLessThan(5000);
    expect(await drive.pullDelta('sync_demo')).toMatchObject({ applied: 200 });
  });
});
