import { afterEach, describe, expect, it, vi } from 'vitest';
import { measureClockOffset, normalizeTimestamp } from '../src';

afterEach(() => {
  vi.useRealTimers();
});

describe('measureClockOffset', () => {
  it('computes the device<->server offset from the round-trip midpoint', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const clock = await measureClockOffset(async () => '2024-01-01T00:00:05.000Z');

    expect(clock.offsetMs).toBe(5000);
    expect(clock.measured_at).toBe('2024-01-01T00:00:00.000Z');
  });

  it('yields a negative offset when the server clock lags the device', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:05:00.000Z'));

    const clock = await measureClockOffset(async () => '2024-01-01T00:00:00.000Z');

    expect(clock.offsetMs).toBe(-300000);
  });

  it('rejects an invalid server timestamp', async () => {
    await expect(measureClockOffset(async () => 'nope')).rejects.toThrow('SERVER_TIME_INVALID');
  });
});

describe('normalizeTimestamp', () => {
  it('adds the offset to a client timestamp', () => {
    const clock = { offsetMs: 5000, measured_at: '2024-01-01T00:00:01.000Z' };
    expect(normalizeTimestamp(clock, '2024-01-01T00:00:00.000Z')).toBe('2024-01-01T00:00:05.000Z');
  });

  it('rejects an invalid client timestamp', () => {
    const clock = { offsetMs: 0, measured_at: '2024-01-01T00:00:01.000Z' };
    expect(() => normalizeTimestamp(clock, 'garbage')).toThrow('CLIENT_TIMESTAMP_INVALID');
  });

  it('normalizes a SKEWED device clock back to true time (±5 min)', () => {
    // Device is 5 minutes AHEAD of the server.
    const skewedClock = { offsetMs: -300000, measured_at: '2024-01-01T00:00:01.000Z' };
    expect(normalizeTimestamp(skewedClock, '2024-01-01T01:05:00.000Z')).toBe(
      '2024-01-01T01:00:00.000Z',
    );
  });
});
