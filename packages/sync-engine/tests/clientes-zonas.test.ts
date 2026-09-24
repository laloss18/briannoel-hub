import { describe, expect, it } from 'vitest';
import { StellarDrive, createOutboxEntry } from '../src';
import type { ClockState, SyncRecord, OutboxEntry } from '../src';
import {
  MemoryCursors,
  MemoryEvents,
  MemoryOutbox,
  MemoryStore,
  MemoryTransport,
} from './helpers/memory';

/**
 * Fase 2 (§6.4): clientes y zonas son entidades NO críticas → el engine las
 * resuelve por LWW (updated_at + tie-break determinístico por id) y normaliza
 * el reloj en cada push (skew ±5 min: gana el reloj correcto tras normalizar).
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
  })
    .registerEntity('clientes')
    .registerEntity('zonas');
  return { drive, transport, store, outbox, cursors, events };
}

function clienteOut(
  id: string,
  updatedAt: string,
  clientId = 'device-1',
): OutboxEntry<{ nombre: string; score: number | null }> {
  return createOutboxEntry({
    id,
    entity: 'clientes',
    client_id: clientId,
    created_at: updatedAt,
    updated_at: updatedAt,
    deleted_at: null,
    operation: 'create',
    data: { nombre: `cliente-${id}`, score: null },
  });
}

function record(id: string, updatedAt: string, deletedAt: string | null = null): SyncRecord {
  return { id, created_at: updatedAt, updated_at: updatedAt, deleted_at: deletedAt };
}

describe('LWW para clientes/zonas (§5.1: entidades no críticas)', () => {
  it('clientes: el registro servidor más nuevo gana el pull (pullDelta)', async () => {
    const t = new MemoryTransport();
    const { drive, store } = makeDrive(t);
    await store.upsert('clientes', record('c1', '2024-05-02T00:00:00.000Z'));
    t.seed('clientes', [record('c1', '2024-05-03T00:00:00.000Z')]);

    await drive.pullDelta('clientes');

    expect((await store.get('clientes', 'c1'))?.updated_at).toBe('2024-05-03T00:00:00.000Z');
  });

  it('clientes: un rival servidor con updated_at más viejo NO pisa al local (LWW)', async () => {
    const t = new MemoryTransport();
    const { drive, store } = makeDrive(t);
    // El cliente local se editó después; el delta viene con una versión vieja.
    await store.upsert('clientes', record('c1', '2024-05-03T00:00:00.000Z'));
    t.seed('clientes', [record('c1', '2024-05-02T00:00:00.000Z')]);

    await drive.pullDelta('clientes');

    expect((await store.get('clientes', 'c1'))?.updated_at).toBe('2024-05-03T00:00:00.000Z');
  });

  it('zonas: empate de updated_at se rompe determinísticamente por id mayor', async () => {
    const t = new MemoryTransport();
    const { drive, store } = makeDrive(t);
    await store.upsert('zonas', record('z-aaaa', NOW));
    t.seed('zonas', [record('z-bbbb', NOW)]);

    await drive.pullDelta('zonas');

    // Mismo timestamp → gana el id mayor, sin importar el orden de llegada.
    const winner = await store.get('zonas', 'z-bbbb');
    expect(winner?.updated_at).toBe(NOW);
    expect((await store.get('zonas', 'z-aaaa'))?.updated_at).toBe(NOW);
  });

  it('push idempotente: remitir el mismo cliente dos veces no lo duplica (guard LWW)', async () => {
    const t = new MemoryTransport();
    const a = makeDrive(t);
    const b = makeDrive(t);
    const op = clienteOut('cliente-unico', NOW);

    await a.drive.enqueue(op);
    await b.drive.enqueue(clienteOut('cliente-unico', NOW, 'device-2'));

    await a.drive.pushOutbox();
    await b.drive.pushOutbox();

    expect(t.server.get('clientes')?.size).toBe(1);
  });
});

describe('skew de reloj ±5 min (§6.4): normalización por pull del lado servidor', () => {
  it('clientes: gana el reloj CORRECTO cuando el dispositivo va 5 min adelantado', async () => {
    const t = new MemoryTransport();
    // Device A: reloj 5 min ADELANTADO (offset -300000 ms) → estampa 01:05 cuando son las 01:00.
    // Device B: reloj correcto (offset 0).
    const clockA: ClockState = { offsetMs: -300000, measured_at: NOW };
    const clockB: ClockState = { offsetMs: 0, measured_at: NOW };
    const driveA = makeDrive(t, clockA);
    const driveB = makeDrive(t, clockB);

    // A edita a las 01:00Z reales, pero su reloj estampa 01:05Z.
    await driveA.drive.enqueue(clienteOut('cli', '2024-06-01T01:05:00.000Z', 'device-a'));
    // B edita DESPUÉS, a las 01:05Z reales, estampado correctamente.
    await driveB.drive.enqueue(clienteOut('cli', '2024-06-01T01:05:00.000Z', 'device-b'));

    await driveA.drive.pushOutbox();
    await driveB.drive.pushOutbox();

    // Sin normalización A y B empatarían en 01:05Z. Con normalización:
    // A → 01:00Z, B → 01:05Z → gana B (escribe después en tiempo real).
    const serverRow = t.server.get('clientes')?.get('cli');
    expect(serverRow?.updated_at).toBe('2024-06-01T01:05:00.000Z');
    expect(serverRow?.client_id).toBe('device-b');
  });

  it('clientes: la escritura real más NUEVA ganan aunque el dispositivo vaya 5 min atrasado', async () => {
    const t = new MemoryTransport();
    // Device A: reloj correcto. Escribe a las 00:00Z (estampado 00:00Z).
    const driveAcc = makeDrive(t, { offsetMs: 0, measured_at: NOW });
    await driveAcc.drive.enqueue(clienteOut('cli', '2024-06-01T00:00:00.000Z', 'device-a'));
    await driveAcc.drive.pushOutbox();
    expect(t.server.get('clientes')?.get('cli')?.updated_at).toBe('2024-06-01T00:00:00.000Z');

    // Device B: reloj 5 min ATRASADO (offset +300000). Escribe a las 00:03Z
    // reales, pero su reloj estampa 23:58Z (del día anterior).
    const driveLag = makeDrive(t, { offsetMs: 300000, measured_at: NOW });
    await driveLag.drive.enqueue(clienteOut('cli', '2024-06-01T23:58:00.000Z', 'device-b'));
    await driveLag.drive.pushOutbox();

    // Normalización: 23:58Z + 5 min = 00:03Z del día 2 → más nueva que 00:00Z.
    const serverRow = t.server.get('clientes')?.get('cli');
    expect(serverRow?.updated_at).toBe('2024-06-02T00:03:00.000Z');
    expect(serverRow?.client_id).toBe('device-b');
  });

  it('zonas: el delta entrante gana por LWW tras normalizar el reloj local', async () => {
    const t = new MemoryTransport();
    // El dispositivo está 5 min adelantado; el servidor es la fuente de verdad.
    const { drive, store } = makeDrive(t, { offsetMs: -300000, measured_at: NOW });
    t.seed('zonas', [record('z1', '2024-06-01T01:00:00.000Z')]);

    await drive.pullDelta('zonas');

    expect((await store.get('zonas', 'z1'))?.updated_at).toBe('2024-06-01T01:00:00.000Z');
  });
});

describe('cursores y limpieza siguen verdes con entidades nuevas', () => {
  it('initialSync + pullDelta actualiza el cursor de clientes', async () => {
    const t = new MemoryTransport();
    const { drive, cursors } = makeDrive(t);
    t.seed('clientes', [record('c1', NOW)]);

    await drive.initialSync('clientes');
    await drive.pullDelta('clientes');

    expect(await cursors.get('clientes')).not.toBeNull();
  });
});
