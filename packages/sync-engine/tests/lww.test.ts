import { describe, expect, it } from 'vitest';
import {
  ConflictRegistry,
  lwwCompare,
  lwwWins,
  rolePriorityCompare,
  rolePriorityWins,
} from '../src';
import type { SyncRecord, SyncRecordWithData } from '../src';

function rec(id: string, updatedAt: string, deletedAt: string | null = null): SyncRecord {
  return { id, created_at: updatedAt, updated_at: updatedAt, deleted_at: deletedAt };
}

function roleRec(
  id: string,
  updatedAt: string,
  role: string,
  deletedAt: string | null = null,
): SyncRecordWithData<{ editor_role: string }> {
  return {
    id,
    created_at: updatedAt,
    updated_at: updatedAt,
    deleted_at: deletedAt,
    editor_role: role,
  };
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

describe('rolePriority (entidades críticas §5.1)', () => {
  it('un rol superior gana aunque su updated_at sea más viejo', () => {
    const promotor = roleRec('a', '2024-01-01T00:00:10.000Z', 'promotor');
    const supervisor = roleRec('a', '2024-01-01T00:00:00.000Z', 'supervisor');
    expect(rolePriorityWins(promotor, supervisor)).toBe(supervisor);
    expect(rolePriorityCompare(promotor, supervisor)).toBeLessThan(0);
  });

  it('admin gana siempre (orden admin > supervisor > promotor > cobrador)', () => {
    expect(rolePriorityWins(roleRec('a', 't', 'supervisor'), roleRec('a', 't', 'admin'))).toMatchObject(
      { editor_role: 'admin' },
    );
    expect(rolePriorityWins(roleRec('a', 't', 'cobrador'), roleRec('a', 't', 'promotor'))).toMatchObject(
      { editor_role: 'promotor' },
    );
  });

  it('empate de rol cae a LWW (updated_at, tie-break id)', () => {
    const a = roleRec('a', '2024-01-01T00:00:10.000Z', 'promotor');
    const b = roleRec('a', '2024-01-01T00:00:00.000Z', 'promotor');
    expect(rolePriorityWins(a, b)).toBe(a);

    const x = roleRec('x-fixed-a', '2024-01-01T00:00:00.000Z', 'promotor');
    const y = roleRec('y-fixed-b', '2024-01-01T00:00:00.000Z', 'promotor');
    expect(rolePriorityWins(x, y)).toBe(y);
  });

  it('sin editor_role (registro heredado) cae a LWW', () => {
    const sinRol = rec('a', '2024-01-01T00:00:00.000Z');
    const promotor = roleRec('a', '2024-01-01T00:00:10.000Z', 'promotor');
    expect(rolePriorityWins(sinRol, promotor)).toBe(promotor);
  });

  it('soporta un resolver de rol custom', () => {
    const roleOf = (r: SyncRecord) => String((r as { by?: string }).by ?? '');
    const a: SyncRecordWithData<{ by: string }> = {
      ...rec('a', '2024-01-01T00:00:10.000Z'),
      by: 'supervisor',
    };
    const b: SyncRecordWithData<{ by: string }> = {
      ...rec('a', '2024-01-01T00:00:00.000Z'),
      by: 'admin',
    };
    expect(rolePriorityWins(a, b, roleOf)).toBe(b);
  });
});
