import { describe, expect, it } from 'vitest';
import { createOutboxEntry, markAttempted, toFailed, toPending } from '../src';
import type { OutboxEntry } from '../src';

const base = {
  id: '01HXMS0A0A0A0A0A0A0A0A0A0A0',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  deleted_at: null,
};

describe('createOutboxEntry', () => {
  it('builds a pending entry with an op id, status and spreads the data', () => {
    const entry = createOutboxEntry({
      ...base,
      entity: 'sync_demo',
      operation: 'create',
      data: { label: 'demo', value: 42 },
    });

    expect(entry.op_id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(entry.entity).toBe('sync_demo');
    expect(entry.operation).toBe('create');
    expect(entry.status).toBe('pending');
    expect(entry.attempts).toBe(0);
    expect(entry.last_error).toBeNull();
    expect(entry.synced_at).toBeNull();
    expect(entry.label).toBe('demo');
    expect(entry.value).toBe(42);
  });

  it('keeps the business timestamps of the record', () => {
    const entry = createOutboxEntry({
      ...base,
      entity: 'e',
      operation: 'update',
      data: {},
    });
    expect(entry.created_at).toBe(base.created_at);
    expect(entry.updated_at).toBe(base.updated_at);
  });
});

describe('state transitions', () => {
  it('markAttempted increments the attempt counter', () => {
    const entry = createOutboxEntry({ ...base, entity: 'e', operation: 'create', data: {} });
    expect(markAttempted(entry).attempts).toBe(1);
  });

  it('toFailed flags the entry with an error', () => {
    const entry: OutboxEntry = {
      ...createOutboxEntry({ ...base, entity: 'e', operation: 'create', data: {} }),
    };
    const failed = toFailed(entry, 'NETWORK_DOWN');
    expect(failed.status).toBe('failed');
    expect(failed.last_error).toBe('NETWORK_DOWN');
    expect(entry.status).toBe('pending'); // immutable: original untouched
  });

  it('toPending clears the error and moves back to pending', () => {
    const failed: OutboxEntry = {
      ...createOutboxEntry({ ...base, entity: 'e', operation: 'create', data: {} }),
      status: 'failed',
      last_error: 'NETWORK_DOWN',
    };
    const pending = toPending(failed);
    expect(pending.status).toBe('pending');
    expect(pending.last_error).toBeNull();
  });
});
