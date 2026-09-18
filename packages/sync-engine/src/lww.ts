import type { SyncRecord } from './types';

/**
 * LWW comparison: newest `updated_at` wins; ties broken deterministically by
 * the larger `id` (ULIDs are sortable, so string comparison is stable).
 * Returns: negative if a < b, 0 if equal, positive if a > b.
 */
export function lwwCompare(a: SyncRecord, b: SyncRecord): number {
  if (a.updated_at !== b.updated_at) {
    return a.updated_at > b.updated_at ? 1 : -1;
  }
  if (a.id !== b.id) {
    return a.id > b.id ? 1 : -1;
  }
  return 0;
}

export function lwwWins(a: SyncRecord, b: SyncRecord): SyncRecord {
  return lwwCompare(a, b) >= 0 ? a : b;
}

/** Conflict resolution strategy per entity (PRD §5.1 hybrid model). */
export const CONFLICT_STRATEGIES = ['lww', 'rolePriority'] as const;
export type ConflictStrategy = (typeof CONFLICT_STRATEGIES)[number];

/**
 * Registry mapping entity -> conflict strategy so each module can opt in.
 * Phase 0 implements `lww`; `rolePriority` (critical entities: pagos, notas de
 * crédito, despachos) is the extension point wired in Fase 4.
 */
export class ConflictRegistry {
  #strategies = new Map<string, ConflictStrategy>();

  register(entity: string, strategy: ConflictStrategy): this {
    if (!CONFLICT_STRATEGIES.includes(strategy)) {
      throw new Error(`UNKNOWN_CONFLICT_STRATEGY: ${strategy}`);
    }
    this.#strategies.set(entity, strategy);
    return this;
  }

  strategyFor(entity: string): ConflictStrategy {
    return this.#strategies.get(entity) ?? 'lww';
  }
}

export class UnsupportedStrategyError extends Error {
  constructor(strategy: string, entity: string) {
    super(`Conflict strategy '${strategy}' not implemented yet for entity '${entity}'`);
  }
}
