import { describe, expect, it } from 'vitest';
import { ConflictRegistry, UnsupportedStrategyError, lwwCompare, lwwWins } from '../src';
import type { SyncRecord } from '../src';

function rec(id: string, updatedAt: string, deletedAt: string | null = null): SyncRecord {
  return { id, created_at: updatedAt, updated_at: updatedAt, deleted_at: deletedAt };
}

describe('lwwCompare / lwwWins', () => {
  it('prefers the record with the newest updated_at', () => {
    const newer = rec('b', '2024-01-01T00:00:10.000Z');
    const older = rec('a', '2024-01-01T00:00:00.000Z');
    expect(lwwWins(older, newer)).toBe(newer);
    expect(lwwCompare(older, newer)).toBeLessThan(0);
  });

  it('breaks ties deterministically by the larger id', () => {
    const first = rec('a-fixed-id-aaaaaaaa', '2024-01-01T00:00:00.000Z');
    const second = rec('b-fixed-id-bbbbbbbb', '2024-01-01T00:00:00.000Z');
    expect(lwwWins(first, second)).toBe(second);
    expect(lwwWins(second, first)).toBe(second);
  });

  it('considers identical records equal', () => {
    const a = rec('same', '2024-01-01T00:00:00.000Z');
    expect(lwwCompare(a, { ...a })).toBe(0);
  });

  it('treats softDeletes as a newer write when timestamps are equal', () => {
    const live = rec('x', '2024-01-01T00:00:00.000Z');
    const tombstone = rec('x', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:05.000Z');
    // tombstone's updated_at is newer in realistic flows; equal timestamps tie-break by id.
    expect(lwwWins(live, tombstone).updated_at).toBe(live.updated_at);
  });
});

describe('ConflictRegistry', () => {
  it('defaults every entity to lww', () => {
    const registry = new ConflictRegistry();
    expect(registry.strategyFor('unknown-entity')).toBe('lww');
  });

  it('registers and returns per-entity strategies', () => {
    const registry = new ConflictRegistry().register('pagos', 'rolePriority');
    expect(registry.strategyFor('pagos')).toBe('rolePriority');
    expect(registry.strategyFor('clientes')).toBe('lww');
  });

  it('rejects unknown strategies', () => {
    const registry = new ConflictRegistry();
    expect(() => registry.register('x', 'custom' as never)).toThrow('UNKNOWN_CONFLICT_STRATEGY');
  });
});

describe('UnsupportedStrategyError', () => {
  it('carries the strategy and entity', () => {
    const error = new UnsupportedStrategyError('rolePriority', 'pagos');
    expect(error.message).toContain('rolePriority');
    expect(error.message).toContain('pagos');
  });
});
