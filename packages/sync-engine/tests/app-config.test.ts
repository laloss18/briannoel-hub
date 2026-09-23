import { describe, expect, it } from 'vitest';
import { StellarDrive, createOutboxEntry } from '../src';
import type { ClockState } from '../src';
import {
  MemoryCursors,
  MemoryEvents,
  MemoryOutbox,
  MemoryStore,
  MemoryTransport,
} from './helpers/memory';

/**
 * Gate Fase 1 — sync del módulo "Auth + Configuración + Bimoneda/BCV".
 * `app_config` (registro global 'global', id fijo) sincroniza igual que el resto:
 * outbox → push idempotente, pull por delta, y CONFLICTO LWW con normalización de
 * reloj (skew ±5 min, PRD §5.1): la tasa que realmente se escribió después gana.
 */
const entity = 'app_config';

function drive(transport: MemoryTransport, clock: ClockState | null = null) {
  return new StellarDrive({
    transport,
    store: new MemoryStore(),
    outbox: new MemoryOutbox(),
    cursors: new MemoryCursors(),
    events: new MemoryEvents(),
    clock,
  }).registerEntity(entity);
}

function configEntry(
  updatedAt: string,
  data: { bcv_rate: number; bcv_rate_source: 'BCV_API' | 'manual' },
  clientId = 'device-1',
) {
  return createOutboxEntry({
    entity,
    id: 'global',
    operation: 'update',
    created_at: updatedAt,
    updated_at: updatedAt,
    deleted_at: null,
    client_id: clientId,
    data,
  });
}

describe('sync módulo 1 · app_config', () => {
  it('sube la tasa BCV desde el outbox y la baja en otro dispositivo', async () => {
    const t = new MemoryTransport();
    // Dispositivo A: supervisora guarda tasa manual.
    const a = drive(t, { offsetMs: 0, measured_at: '2024-05-01T00:00:00.000Z' });
    await a.enqueue(
      configEntry('2024-05-01T00:10:00.000Z', { bcv_rate: 36.5, bcv_rate_source: 'manual' }),
    );

    const push = await a.pushOutbox();
    expect(push.pushed).toBe(1);

    // Dispositivo B: pull delta inicial (bajo demanda) recibe la config.
    const b = drive(t, { offsetMs: 0, measured_at: '2024-05-01T00:10:01.000Z' });
    const result = await b.initialSync(entity);
    expect(result.applied).toBe(1);
  });

  it('conflicto LWW con reloj ±5 min adelantado: gana la tasa escrita de verdad después', async () => {
    const t = new MemoryTransport();
    // A corre 5 minutos ADELANTADA (offset -300000 ms): marcaría 01:05 como 01:10.
    const clockA: ClockState = { offsetMs: -300000, measured_at: '2024-05-01T00:00:00.000Z' };
    const clockB: ClockState = { offsetMs: 0, measured_at: '2024-05-01T00:00:00.000Z' };

    // A (tasa vieja 36.2) escribe a las 00:05 real, pero su reloj la marca 00:10.
    const driveA = drive(t, clockA);
    await driveA.enqueue(
      configEntry('2024-05-01T00:10:00.000Z', { bcv_rate: 36.2, bcv_rate_source: 'manual' }),
    );
    await driveA.pushOutbox();

    // B (tasa nueva 37.1, oficial) escribe a las 00:12 real, correcta.
    const driveB = drive(t, clockB);
    await driveB.enqueue(
      configEntry(
        '2024-05-01T00:12:00.000Z',
        { bcv_rate: 37.1, bcv_rate_source: 'BCV_API' },
        'device-2',
      ),
    );
    await driveB.pushOutbox();

    // Normalización: A = 00:10 - 5 min = 00:05; B = 00:12. Gana B (más reciente).
    const serverRow = t.server.get(entity)?.get('global');
    expect(serverRow?.client_id).toBe('device-2');
    expect(serverRow?.updated_at).toBe('2024-05-01T00:12:00.000Z');
  });

  it('conflicto LWW con reloj ±5 min ATRASADO: la tasa vieja no pisa a la nueva', async () => {
    const t = new MemoryTransport();
    // A corre 5 minutos ATRASADA (+300000 ms): marcaría 00:12 como 00:07.
    const clockA: ClockState = { offsetMs: 300000, measured_at: '2024-05-01T00:00:00.000Z' };
    const clockB: ClockState = { offsetMs: 0, measured_at: '2024-05-01T00:00:00.000Z' };

    const driveB = drive(t, clockB);
    await driveB.enqueue(
      configEntry(
        '2024-05-03T00:12:00.000Z',
        { bcv_rate: 37.1, bcv_rate_source: 'BCV_API' },
        'device-2',
      ),
    );
    await driveB.pushOutbox();

    // A intenta sobrescribir tarde con una tasa añeja (00:05 real, reloj atrasado
    // la marca 00:05 → offset +5min la normaliza a 00:10, más vieja que 00:12).
    const driveA = drive(t, clockA);
    await driveA.enqueue(
      configEntry('2024-05-03T00:05:00.000Z', { bcv_rate: 36.2, bcv_rate_source: 'manual' }),
    );
    await driveA.pushOutbox();

    const serverRow = t.server.get(entity)?.get('global');
    expect(serverRow?.client_id).toBe('device-2');
    expect(serverRow?.updated_at).toBe('2024-05-03T00:12:00.000Z');
  });

  it('lee app_config con id fijo no-ULID en el motor (LWW por updated_at)', async () => {
    const t = new MemoryTransport();
    const a = drive(t, { offsetMs: 0, measured_at: '2024-05-01T00:00:00.000Z' });
    await a.enqueue(
      configEntry('2024-05-01T00:20:00.000Z', { bcv_rate: 38.0, bcv_rate_source: 'BCV_API' }),
    );
    await a.pushOutbox();

    // la entidad se sincroniza con id fijo y updated_at correcto.
    expect(t.server.get(entity)?.get('global')).toMatchObject({
      id: 'global',
      updated_at: '2024-05-01T00:20:00.000Z',
    });
  });
});
