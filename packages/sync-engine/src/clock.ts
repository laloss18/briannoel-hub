import type { ClockState } from './types';

/**
 * Estimates the offset between the device clock and the server clock.
 *
 * `serverNow()` must resolve to an ISO timestamp read from the server. The
 * round-trip midpoint is used to compensate network latency in both directions.
 */
export async function measureClockOffset(serverNow: () => Promise<string>): Promise<ClockState> {
  const before = Date.now();
  const iso = await serverNow();
  const after = Date.now();
  const serverMs = Date.parse(iso);
  if (Number.isNaN(serverMs)) {
    throw new Error('SERVER_TIME_INVALID');
  }
  const midpoint = Math.round((before + after) / 2);
  return { offsetMs: serverMs - midpoint, measured_at: new Date().toISOString() };
}

/**
 * Corrects a client-generated timestamp so it sits on the server's time frame.
 * Without this, LWW ordering on BYOD devices with drifted clocks is unreliable.
 */
export function normalizeTimestamp(clock: ClockState, clientIso: string): string {
  const t = Date.parse(clientIso);
  if (Number.isNaN(t)) {
    throw new Error('CLIENT_TIMESTAMP_INVALID');
  }
  return new Date(t + clock.offsetMs).toISOString();
}
