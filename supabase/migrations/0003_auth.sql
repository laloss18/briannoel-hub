-- 0003_auth.sql
-- Fase 1: Auth + Configuración + Bimoneda/BCV.
-- Se reutiliza `server_records` como almacén de sync (el server sigue siendo un
-- store idempotente "tonto", PRD §5). Entidades nuevas que entran al motor:
--   - `app_users`  : perfiles/roles por usuario de auth (pull desde dispositivos).
--   - `app_config` : configuración global (bimoneda/BCV), un único registro.
-- Supabase Auth (login usuario+contraseña §3.4) crea los `auth.users`; esta
-- migración materializa los perfiles/roles de forma explícita (SECURITY DEFINER):
-- el admin invoca `upsert_app_user` para crear/editar un perfil, y dispositivos
-- lo bajan por delta. Así la app decide permisos offline (PRD §3.3).

-- Alta/edición idempotente de un perfil de usuario con sus roles.
create or replace function public.upsert_app_user(
  p_user_id uuid,
  p_email text,
  p_name text default null,
  p_roles text[] default array['promotor'],
  p_active boolean default true
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.server_records (
    entity, id, body, client_created_at, client_updated_at, deleted_at, op_id
  ) values (
    'app_users',
    p_user_id::text,
    jsonb_build_object(
      'user_id', p_user_id::text,
      'email', p_email,
      'name', coalesce(p_name, p_email),
      'roles', to_jsonb(coalesce(p_roles, array['promotor']::text[])),
      'active', p_active
    ),
    now(),
    now(),
    null,
    null
  )
  on conflict (entity, id) do update set
    body = excluded.body,
    client_updated_at = excluded.client_updated_at,
    deleted_at = null;
end;
$$;

-- Consulta de roles de un usuario (para la app/UI de admin; los dispositivos
-- sincronizan por pull_delta igualmente).
create or replace function public.app_role_for(p_user_id uuid)
returns text[]
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select array(
      select jsonb_array_elements_text(body -> 'roles')
      from public.server_records
      where entity = 'app_users' and id = p_user_id::text and deleted_at is null
    )),
    '{}'::text[]
  );
$$;

-- Backfill inicial: configuración global bimoneda (un único registro, LWW vía
-- sync normal). Sin usuarios seed: los perfiles los crea el admin tras tener
-- usuarios reales en auth (el proyecto ya tiene / se crearán manualmente).
insert into public.server_records (
  entity, id, body, client_created_at, client_updated_at, deleted_at, op_id
) values (
  'app_config',
  'global',
  jsonb_build_object('base_currency', 'USD', 'bcv_rate', null, 'bcv_rate_source', null),
  now(),
  now(),
  null,
  null
)
on conflict (entity, id) do nothing;

-- RLS: server_records ya está con RLS habilitado y se expone solo por las RPCs
-- SECURITY DEFINER pull_delta/push_bulk (grants a anon/authenticated desde 0002).
grant execute on function public.upsert_app_user(uuid, text, text, text[], boolean) to authenticated;
grant execute on function public.app_role_for(uuid) to authenticated;