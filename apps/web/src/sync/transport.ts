import type { DeltaPage, OutboxEntry, SyncRecord, SyncTransport } from '@brian/sync-engine';
import { requireSupabase } from './supabase';

interface ServerRow {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  body: Record<string, unknown>;
  /** ignored: used only server-side as the delta cursor */
  [key: string]: unknown;
}

/**
 * SupabaseTransport: pullDelta + pushBulk + serverNow contra las RPCs schema
 * (migraciones 0001+0002, SECURITY DEFINER → la publishable key basta, nunca la
 * secret en el cliente). ON CONFLICT DO NOTHING en server_records = idempotencia.
 */
export class SupabaseTransport implements SyncTransport {
  async pullDelta(entity: string, cursor: string | null): Promise<DeltaPage> {
    const { data, error } = await requireSupabase().rpc('pull_delta', {
      p_entity: entity,
      p_cursor: cursor,
    });
    if (error) throw new Error(`pull_delta ${entity}: ${error.message}`);
    const page = data as {
      records: ServerRow[] | null;
      next_cursor: string | null;
    } | null;
    const records: SyncRecord[] = (page?.records ?? []).map((row) => ({
      ...row.body,
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }));
    return { records, nextCursor: page?.next_cursor ?? null };
  }

  async pushBulk(entries: OutboxEntry[]): Promise<void> {
    const { error } = await requireSupabase().rpc('push_bulk', {
      p_entries: entries.map((e) => ({
        entity: e.entity,
        id: e.id,
        body: { ...e },
        created_at: e.created_at,
        updated_at: e.updated_at,
        deleted_at: e.deleted_at,
        op_id: e.op_id,
      })),
    });
    if (error) throw new Error(`push_bulk: ${error.message}`);
  }

  async serverNow(): Promise<string> {
    const { data, error } = await requireSupabase().rpc('server_now');
    if (error) throw new Error(`server_now: ${error.message}`);
    return (data as string) ?? new Date().toISOString();
  }
}
