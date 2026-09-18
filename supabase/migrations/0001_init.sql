-- 0001_init.sql
-- EAB project: Supabase Cloud store. Port: `SyncTransport.pullDelta/pushBulk/serverNow`.
-- Because StellarDrive already implements LWW + clock normalization client-side, the
-- server stays a dumb, idempotent store: upsert by (entity, id), update `server_updated_at`
-- on every write so it can serve as the delta cursor.

create extension if not exists "pgcrypto";

-- Change-tracked mirror of every synced record across all entities.
create table if not exists public.server_records (
  entity          text                     not null,
  id              uuid primary key,
  body            jsonb                    not null default '{}'::jsonb,
  client_created_at   timestamptz          not null,
  client_updated_at   timestamptz          not null,
  deleted_at          timestamptz,
  server_updated_at   timestamptz          not null default now(),
  op_id               uuid,
  constraint server_records_entity_id_uniq unique (entity, id)
);

-- Cursor for the delta pull is `server_updated_at`.
create index if not exists server_records_pull_idx
  on public.server_records (entity, server_updated_at);

-- Idempotent upsert: a retransmitted operation (same id) must not apply twice.
-- ON CONFLICT (entity, id) DO NOTHING guarantees duplicate outbox re-pushes are dropped
-- server-side, matching the PRD idempotency rule (§5.4).
create or replace function public.upsert_record(
  p_entity text,
  p_id uuid,
  p_body jsonb,
  p_client_created_at timestamptz,
  p_client_updated_at timestamptz,
  p_deleted_at timestamptz default null,
  p_op_id uuid default null
) returns void
language plpgsql as $$
begin
  insert into public.server_records (
    entity, id, body, client_created_at, client_updated_at, deleted_at, op_id
  ) values (
    p_entity, p_id, p_body, p_client_created_at, p_client_updated_at, p_deleted_at, p_op_id
  )
  on conflict (entity, id) do nothing;
end;
$$;

-- The client uses the server clock as the reference for LWW (clock sync, PRD §5.1).
create function public.server_now() returns timestamptz
language sql stable
as $$ select now() $$;

-- RLS: the sync transport uses the service-role key (server-side), so no row-level
-- policy is required for Phase 0. Tables are exposed only through the delta RPCs,
-- never as direct anon reads. Locking them down is a Fase 2 concern.
alter table public.server_records enable row level security;

-- Lightweight sanitized replica intended ONLY as model cards for the demo sync panel.
create table if not exists public.demo_clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
