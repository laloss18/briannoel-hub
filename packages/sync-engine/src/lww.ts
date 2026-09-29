import { ROLE_PRIORITY } from '@brian/shared';
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

/** Extrae el rol del editor desde el payload opaco de la entidad (PRD §3.2/§5.1). */
export function editorRoleOf(record: SyncRecord): string | undefined {
  const role = (record as { editor_role?: unknown }).editor_role;
  return typeof role === 'string' ? role : undefined;
}

export type RoleResolver = (record: SyncRecord) => string | undefined;

/**
 * Role-priority comparison for CRITICAL entities (PRD §5.1): pagos, notas de
 * crédito y despachos. El registro editado por un rol superior gana **aunque su
 * timestamp sea más viejo** (protege la inmutabilidad: un promotor offline no
 * puede pisar la entrega de un supervisor). Si falta el rol o hay empate de
 * prioridad, cae a LWW por `updated_at` con tie-break por `id`.
 */
export function rolePriorityCompare(
  a: SyncRecord,
  b: SyncRecord,
  roleOf: RoleResolver = editorRoleOf,
): number {
  const ra = roleOf(a);
  const rb = roleOf(b);
  if (ra !== undefined && rb !== undefined && ra !== rb) {
    const pa = ROLE_PRIORITY[ra as keyof typeof ROLE_PRIORITY] ?? 0;
    const pb = ROLE_PRIORITY[rb as keyof typeof ROLE_PRIORITY] ?? 0;
    if (pa !== pb) return pa > pb ? 1 : -1;
  }
  return lwwCompare(a, b);
}

export function rolePriorityWins(
  a: SyncRecord,
  b: SyncRecord,
  roleOf: RoleResolver = editorRoleOf,
): SyncRecord {
  return rolePriorityCompare(a, b, roleOf) >= 0 ? a : b;
}

/** Conflict resolution strategy per entity (PRD §5.1 hybrid model). */
export const CONFLICT_STRATEGIES = ['lww', 'rolePriority'] as const;
export type ConflictStrategy = (typeof CONFLICT_STRATEGIES)[number];

/**
 * Registry mapping entity -> conflict strategy so each module can opt in.
 * `lww` es el default para entidades no críticas; `rolePriority` (pagos, notas
 * de crédito, despachos, §5.1) resuelve por rol con caída a LWW.
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
