-- 0002_delta_rpcs.sql
-- Delta + bulk RPCs for `SyncTransport`. The migration 0001 exposes tables only
-- through these RPCs (never direct anon reads). They are SECURITY DEFINER so the
-- publishable (anon) key can call them without an RLS grant, keeping the secret
-- key server-only (AGENTS.md / PRD §5.4, §5.6).

-- Delta pull: records changed after `p_cursor` (server_updated_at), sorted for
-- deterministic apply, capped so one round-trip stays small. `p_cursor = NULL`
-- means "first sync" → returns everything (SQL `x > NULL` is NULL, so it must be
-- `p_cursor IS NULL OR ...`, otherwise the first pull would be empty).
-- Returns the page as a JSON doc { records, next_cursor }.
create or replace function public.pull_delta(
  p_entity text,
  p_cursor timestamptz default null
) returns jsonb
language sql
security definer
stable
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'records', coalesce(
          jsonb_agg(
            jsonb_build_object(
              'id', id,
              'created_at', client_created_at::text,
              'updated_at', client_updated_at::text,
              'deleted_at', deleted_at::text,
              'body', body,
              'server_updated_at', server_updated_at::text
            ) order by server_updated_at, id
          ) filter (where p_cursor is null or server_updated_at > p_cursor),
          '[]'::jsonb
        ),
        'next_cursor', max(server_updated_at)::text
      )
      from public.server_records
      where entity = p_entity and (p_cursor is null or server_updated_at > p_cursor)
    ),
    jsonb_build_object('records', '[]'::jsonb, 'next_cursor', null)
  );
$$;

revoke all on function public.pull_delta(text, timestamptz) from anon, authenticated;
grant execute on function public.pull_delta(text, timestamptz) to anon, authenticated;

-- Idempotent bulk push: retransmitted ops (same entity+id) are dropped server-side
-- by upsert_record's ON CONFLICT DO NOTHING (PRD §5.4). Returns applied/duplicated.
create or replace function public.push_bulk(
  p_entries jsonb
) returns jsonb
language plpgsql
security definer
as $$
declare
  entry jsonb;
  applied int := 0;
  duplicates int := 0;
begin
  for entry in select jsonb_array_elements(p_entries)
  loop
    insert into public.server_records (
      entity, id, body, client_created_at, client_updated_at, deleted_at, op_id
    ) values (
      entry ->> 'entity',
      (entry ->> 'id'),
      coalesce(entry -> 'body', '{}'::jsonb),
      (entry ->> 'created_at')::timestamptz,
      (entry ->> 'updated_at')::timestamptz,
      nullif((entry ->> 'deleted_at'), '')::timestamptz,
      (entry ->> 'op_id')
    )
    on conflict (entity, id) do nothing;
    if found then
      applied := applied + 1;
    else
      duplicates := duplicates + 1;
    end if;
  end loop;
  return jsonb_build_object('applied', applied, 'duplicates', duplicates);
end;
$$;

revoke all on function public.push_bulk(jsonb) from anon, authenticated;
grant execute on function public.push_bulk(jsonb) to anon, authenticated;

-- Idempotent single-record upsert, used by push_bulk internally and available to
-- clients that sync a single record. Identical semantics to upsert_record.
create or replace function public.server_now() returns timestamptz
language sql stable security definer
as $$ select now() $$;