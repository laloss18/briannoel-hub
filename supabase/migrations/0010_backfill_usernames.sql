-- 0010_backfill_usernames.sql
-- Backfill de `username` para perfiles `app_users` creados antes de la 0009.
-- El body que escribía `upsert_app_user` (0003) no traía `username`, así que
-- `listAppUsers()` los mostraba sin nombre visible (la UI degradaba a `name`/
-- `email`). Debe correr DESPUÉS de `0009_admin_usuarios.sql`.
--
-- Idempotente: solo toca perfiles vivos que siguen sin `username` y garantiza
-- unicidad (case-insensitive) contra el índice parcial `app_users_username_uniq`.
-- La base del nombre es el `name` del perfil si es un nombre real; si falta o es
-- el propio correo (la 0003 guardaba `name = coalesce(p_name, p_email)`), se usa
-- la parte local del correo. El resultado cumple `usernameSchema` de
-- packages/shared (3–40, empieza por letra/número, sin `@`).

do $$
declare
  r record;
  v_base text;
  v_cand text;
  v_n int;
begin
  for r in
    select id, body
    from public.server_records
    where entity = 'app_users'
      and deleted_at is null
      and (body ->> 'username' is null or btrim(body ->> 'username') = '')
    order by client_created_at, id
  loop
    v_base := left(
      coalesce(
        nullif(
          case
            when btrim(coalesce(r.body ->> 'name', '')) <> ''
              and (r.body ->> 'name') not like '%@%'
              then btrim(r.body ->> 'name')
          end,
          ''
        ),
        split_part(coalesce(r.body ->> 'email', ''), '@', 1)
      ),
      32
    );
    if length(v_base) < 3 then
      v_base := 'usuario';
    end if;

    v_cand := v_base;
    v_n := 1;
    while exists (
      select 1
      from public.server_records
      where entity = 'app_users'
        and deleted_at is null
        and lower(body ->> 'username') = lower(v_cand)
    ) loop
      v_n := v_n + 1;
      v_cand := left(v_base, 32) || ' ' || v_n;
    end loop;

    update public.server_records
    set body = body || jsonb_build_object('username', v_cand),
        client_updated_at = now()
    where entity = 'app_users' and id = r.id;
  end loop;
end $$;

-- Alinea la meta de auth (es el fallback que lee `admin_update_app_user` cuando
-- el campo se omite). Solo donde todavía no hay `username`.
update auth.users u
set raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('username', sr.body ->> 'username'),
    updated_at = now()
from public.server_records sr
where sr.entity = 'app_users'
  and sr.id = u.id::text
  and sr.deleted_at is null
  and coalesce(u.raw_user_meta_data ->> 'username', '') = ''
  and coalesce(sr.body ->> 'username', '') <> '';
