import { describe, expect, it } from 'vitest';
import { ConflictRegistry, StellarDrive, createOutboxEntry } from '../src';
import type { ClockState, SyncRecord, OutboxEntry } from '../src';
import {
  MemoryCursors,
  MemoryEvents,
  MemoryOutbox,
  MemoryStore,
  MemoryTransport,
} from './helpers/memory';

/**
 * Fase 3 (§6.4): `despachos` es una entidad CRÍTICA → prioridad por rol del
 * editor (§5.1), NO LWW. Un supervisor que entrega gana aunque su timestamp sea
 * más viejo que el de un promotor que siguió editando offline; con el mismo rol,
 * cae a LWW normalizado por reloj (skew ±5 min).
 */

const NOW = '2024-06-01T00:00:00.000Z';

function makeDrive(transport: MemoryTransport, clock: ClockState | null = null) {
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
    registry: new ConflictRegistry().register('despachos', 'rolePriority'),
  }).registerEntity('despachos');
  return { drive, transport, store, outbox, cursors, events };
}

function despachoOut(
  id: string,
  updatedAt: string,
  role: string,
  clientId = 'device-1',
  deletedAt: string | null = null,
): OutboxEntry<{ editor_role: string; nro_control: string }> {
  return createOutboxEntry({
    id,
    entity: 'despachos',
    client_id: clientId,
    created_at: updatedAt,
    updated_at: updatedAt,
    deleted_at: deletedAt,
    operation: deletedAt === null ? 'create' : 'softDelete',
    data: { editor_role: role, nro_control: `D-${id.slice(0, 4).toUpperCase()}` },
  });
}

function record(
  id: string,
  updatedAt: string,
  role: string,
  deletedAt: string | null = null,
): SyncRecord & { editor_role: string } {
  return { id, created_at: updatedAt, updated_at: updatedAt, deleted_at: deletedAt, editor_role: role };
}

describe('despachos: prioridad por rol (§5.1, entidad crítica)', () => {
  it('un supervisor con timestamp MÁS VIEJO gana la entrega vs. la edición offline del promotor', async () => {
    const t = new MemoryTransport();
    const { drive, store } = makeDrive(t);
    // Local: el promotor edita a las 05 (más reciente) intentando reabrir la venta.
    await store.upsert('despachos', record('d1', '2024-06-01T00:00:05.000Z', 'promotor'));
    // Remoto: el supervisor entregó a las 00 (más viejo, pero rol superior).
    t.seed('despachos', [record('d1', '2024-06-01T00:00:00.000Z', 'supervisor')]);

    await drive.pullDelta('despachos');

    const winner = (await store.get('despachos', 'd1')) as SyncRecord & { editor_role: string };
    expect(winner?.editor_role).toBe('supervisor');
    // Se conserva el payload supervisor aunque sea el timestamp viejo.
    expect(winner?.updated_at).toBe('2024-06-01T00:00:00.000Z');
  });

  it('un admin gana siempre, incluso frente a un supervisor más nuevo', async () => {
    const t = new MemoryTransport();
    const { drive, store } = makeDrive(t);
    await store.upsert('despachos', record('d2', '2024-06-01T00:00:10.000Z', 'supervisor'));
    t.seed('despachos', [record('d2', '2024-06-01T00:00:00.000Z', 'admin')]);

    await drive.pullDelta('despachos');

    const winner = (await store.get('despachos', 'd2')) as SyncRecord & { editor_role: string };
    expect(winner?.editor_role).toBe('admin');
  });

  it('mismo rol → cae a LWW (el más nuevo con tie-break id)', async () => {
    const t = new MemoryTransport();
    const { drive, store } = makeDrive(t);
    await store.upsert('despachos', record('d3', '2024-06-01T00:00:00.000Z', 'promotor'));
    t.seed('despachos', [record('d3', '2024-06-01T00:00:07.000Z', 'promotor')]);

    await drive.pullDelta('despachos');

    expect((await store.get('despachos', 'd3'))?.updated_at).toBe('2024-06-01T00:00:07.000Z');
  });

  it('sin editor_role (registro heredado) no rompe: cae a LWW', async () => {
    const t = new MemoryTransport();
    const { drive, store } = makeDrive(t);
    await store.upsert('despachos', { id: 'd4', created_at: NOW, updated_at: NOW, deleted_at: null });
    t.seed('despachos', [{ id: 'd4', created_at: NOW, updated_at: '2024-06-01T00:00:09.000Z', deleted_at: null }]);

    await drive.pullDelta('despachos');

    expect((await store.get('despachos', 'd4'))?.updated_at).toBe('2024-06-01T00:00:09.000Z');
  });
});

describe('despachos: push + skew de reloj ±5 min (§6.4)', () => {
  it('al push idempotente: el rol del editor viaja en el payload y se conserva en el outbox', async () => {
    const t = new MemoryTransport();
    const { drive, outbox } = makeDrive(t);
    await drive.enqueue(despachoOut('d-push', NOW, 'supervisor', 'device-a'));

    await drive.pushOutbox();

    const pushed = (await outbox.listAll()).find((o) => o.id === 'd-push') as
      | (OutboxEntry & { editor_role: string; nro_control: string })
      | undefined;
    expect(pushed?.editor_role).toBe('supervisor');
    expect(pushed?.nro_control).toBe('D-D-PU');
    expect(pushed?.status).toBe('synced');
    expect(t.server.get('despachos')?.has('d-push')).toBe(true);
  });

  it('con reloj ±5 min: la escritura real más nueva gana cuando el rol empató', async () => {
    const t = new MemoryTransport();
    // Ambos son supervisores (empate de rol → LWW); A va 5 min adelantado.
    const clockA: ClockState = { offsetMs: -300000, measured_at: NOW };
    const clockB: ClockState = { offsetMs: 0, measured_at: NOW };
    const driveA = makeDrive(t, clockA);
    const driveB = makeDrive(t, clockB);

    // A estampa 01:05 (reloj adelantado, es real 01:00); B escribe a las 01:05 reales.
    await driveA.drive.enqueue(despachoOut('d-skew', '2024-06-01T01:05:00.000Z', 'supervisor', 'device-a'));
    await driveB.drive.enqueue(despachoOut('d-skew', '2024-06-01T01:05:00.000Z', 'supervisor', 'device-b'));

    await driveA.drive.pushOutbox();
    await driveB.drive.pushOutbox();

    // Normalización: A → 01:00, B → 01:05 → gana B (escribe después en tiempo real).
    const serverRow = t.server.get('despachos')?.get('d-skew') as
      | (SyncRecord & { client_id: string })
      | undefined;
    expect(serverRow?.updated_at).toBe('2024-06-01T01:05:00.000Z');
    expect(serverRow?.client_id).toBe('device-b');
  });

  it('una entrega de supervisor (rol superior) se propaga al pull aunque el local esté 5 min adelantado', async () => {
    const t = new MemoryTransport();
    const { drive, store } = makeDrive(t, { offsetMs: -300000, measured_at: NOW });
    // Local: promotor editó a las 06 local (01:06Z estampado). Remoto: supervisor a las 00.
    await store.upsert('despachos', record('d5', '2024-06-01T01:06:00.000Z', 'promotor'));
    t.seed('despachos', [record('d5', '2024-06-01T00:00:00.000Z', 'supervisor')]);

    await drive.pullDelta('despachos');

    const winner = (await store.get('despachos', 'd5')) as SyncRecord & { editor_role: string };
    expect(winner?.editor_role).toBe('supervisor');
  });
});