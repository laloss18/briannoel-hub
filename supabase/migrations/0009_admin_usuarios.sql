-- 0009_admin_usuarios.sql
-- Identidad por nombre de usuario + alta de usuarios SOLO por el admin (PRD §3.4).
--
-- Antes: `auth.users` se poblaba a mano y el perfil (`app_users`) lo escribía
-- cualquier `authenticated` con `upsert_app_user`. El correo era lo único visible.
-- Ahora:
--   - El **nombre de usuario** es la identidad visible de la app y es único.
--   - El **correo sigue siendo la clave de auditoría** (`created_by`/`updated_by`,
--     `puedeGestionarDespacho`): no se toca ningún documento, solo el perfil.
--   - **No hay signup público**: las cuentas las da de alta el admin con estas
--     RPCs `SECURITY DEFINER`, que escriben en `auth.users` + `auth.identities`
--     y materializan el perfil en `app_users`.
--   - `raw_app_meta_data.roles` es la fuente que el cliente lee al iniciar sesión
--     (`supabaseGateway.toSession`), así que cualquier cambio de roles se
--     propaga ahí; el dispositivo sin red decide permisos con el perfil que
--     baja por `pull_delta`.

-- ---------------------------------------------------------------- usernames
-- Unicidad a nivel de motor: dos cuentas con el mismo nombre visible romperían
-- la auditoría en pantalla. Índice parcial: solo perfiles vivos.
create unique index if not exists app_users_username_uniq
  on public.server_records (lower(body ->> 'username'))
  where entity = 'app_users'
    and deleted_at is null
    and body ? 'username'
    and nullif(body ->> 'username', '') is not null;

-- ¿El llamador es administrador? El JWT (`app_metadata.roles`) es la vía normal;
-- `app_role_for` cubre el caso de un token emitido antes de que el admin subiera
-- su propio rol, para que un admin legítimo no se quede fuera de su propia app.
create or replace function public.is_app_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  with j as (
    select coalesce(auth.jwt() -> 'app_metadata' -> 'roles', '[]'::jsonb) as roles
  )
  select coalesce(
    'admin' = any (select jsonb_array_elements_text(j.roles) from j)
    or 'admin' = any (coalesce(public.app_role_for(auth.uid()), '{}'::text[])),
    false
  );
$$;

-- Filtro de entrada compartido: el nombre de usuario es el nombre visible de la
-- persona, así que admite letras (con acentos), números y espacios (3–40), en
-- línea con `usernameSchema` de packages/shared. Solo se rechazan los caracteres
-- de control y las longitudes extremas.
create or replace function public.admin_check_username(p_username text)
returns text
language plpgsql
immutable
as $$
declare
  v text := btrim(coalesce(p_username, ''));
begin
  if length(v) < 3 or length(v) > 40 or v ~ '[[:cntrl:]]' then
    raise exception 'nombre de usuario inválido: 3-40 caracteres'
      using errcode = '22023';
  end if;
  return v;
end;
$$;

-- Roles admitidos: los mismos cuatro de `ROLES` en packages/shared. Sin esto un
-- typo en el panel del admin dejaría al usuario sin ningún permiso.
create or replace function public.admin_check_roles(p_roles text[])
returns text[]
language plpgsql
immutable
as $$
declare
  v_bad text[];
begin
  if p_roles is null or cardinality(p_roles) = 0 then
    raise exception 'el usuario necesita al menos un rol' using errcode = '22023';
  end if;
  select coalesce(array_agg(r), '{}') into v_bad
  from unnest(p_roles) as r
  where r not in ('admin', 'supervisor', 'promotor', 'cobrador');
  if cardinality(v_bad) > 0 then
    raise exception 'rol desconocido: %', array_to_string(v_bad, ', ') using errcode = '22023';
  end if;
  return p_roles;
end;
$$;

-- ------------------------------------------------------- perfil (app_users)
-- `upsert_app_user` de 0003 + `username` + gate de admin. Dos razones por las que
-- 0003 lo dejaba abierto a cualquier `authenticated` ya no valen:
--   1. Con `p_username` el perfil pasa a ser la identidad visible, reescribirlo
--      es editar quién es quién en la auditoría de pantalla.
--   2. Sin gate, cualquier usuario con sesión podía llamar la RPC con
--      `p_roles = array['admin']` y ascenderse a sí mismo. Ahora solo el admin.
-- El parámetro nuevo va **al final** con default null para no romper las
-- llamadas posicionales ya en uso; `id = user_id` (el `app_users` sigue siendo
-- server-only y lo baja el dispositivo por delta).
create or replace function public.upsert_app_user(
  p_user_id uuid,
  p_email text,
  p_name text default null,
  p_roles text[] default array['promotor'],
  p_active boolean default true,
  p_username text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body jsonb;
begin
  if not public.is_app_admin() then
    raise exception 'solo el administrador puede editar usuarios' using errcode = '42501';
  end if;
  if p_username is not null then
    p_username := public.admin_check_username(p_username);
  end if;
  if p_roles is not null then
    p_roles := public.admin_check_roles(p_roles);
  end if;

  v_body := jsonb_build_object(
    'user_id', p_user_id::text,
    'email', p_email,
    'name', coalesce(p_name, p_email),
    'roles', to_jsonb(coalesce(p_roles, array['promotor']::text[])),
    'active', coalesce(p_active, true)
  );
  if p_username is not null then
    v_body := v_body || jsonb_build_object('username', p_username);
  end if;

  insert into public.server_records (
    entity, id, body, client_created_at, client_updated_at, deleted_at, op_id
  ) values (
    'app_users', p_user_id::text, v_body, now(), now(), null, null
  )
  on conflict (entity, id) do update set
    body = excluded.body,
    client_updated_at = excluded.client_updated_at,
    deleted_at = null;
end;
$$;

drop function if exists public.upsert_app_user(uuid, text, text, text[], boolean);

-- ------------------------------------------------------------- alta (admin)
-- Alta de una cuenta completa: `auth.users` + `auth.identities` + perfil
-- `app_users`. Devuelve el `user_id` para que la UI pueda enlazar el perfil.
create or replace function public.admin_create_app_user(
  p_email text,
  p_username text,
  p_password text,
  p_roles text[] default array['promotor'],
  p_name text default null
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_username text := public.admin_check_username(p_username);
  v_roles text[] := public.admin_check_roles(p_roles);
  v_user_id uuid;
  v_app_meta jsonb;
begin
  if not public.is_app_admin() then
    raise exception 'solo el administrador puede dar de alta usuarios' using errcode = '42501';
  end if;
  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'correo inválido' using errcode = '22023';
  end if;
  if coalesce(length(p_password), 0) < 8 then
    raise exception 'la contraseña necesita al menos 8 caracteres' using errcode = '22023';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'ya existe una cuenta con el correo %', v_email using errcode = '23505';
  end if;

  v_user_id := gen_random_uuid();
  v_app_meta := jsonb_build_object(
    'provider', 'email',
    'providers', jsonb_build_array('email'),
    'roles', to_jsonb(v_roles)
  );

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')), now(),
    v_app_meta, jsonb_build_object('username', v_username, 'name', coalesce(p_name, v_username)),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) values (
    v_user_id, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  perform public.upsert_app_user(v_user_id, v_email, p_name, v_roles, true, v_username);
  return v_user_id;
end;
$$;

-- ------------------------------------------------------- edición (admin)
-- Username, nombre, roles y estado. Cada campo omitido conserva lo que ya hay.
-- Los roles se propagan a `raw_app_meta_data` porque es lo que lee el cliente al
-- iniciar sesión; el perfil de `app_users` es lo que resuelve el dispositivo sin red.
create or replace function public.admin_update_app_user(
  p_user_id uuid,
  p_username text default null,
  p_roles text[] default null,
  p_name text default null,
  p_active boolean default null
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text;
  v_roles text[];
  v_username text;
  v_name text;
  v_active boolean;
begin
  if not public.is_app_admin() then
    raise exception 'solo el administrador puede editar usuarios' using errcode = '42501';
  end if;

  select email,
         coalesce(array(select jsonb_array_elements_text(raw_app_meta_data -> 'roles')), '{}'::text[]),
         raw_user_meta_data ->> 'username'
    into v_email, v_roles, v_username
    from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'no existe la cuenta %', p_user_id using errcode = 'P0002';
  end if;

  select body ->> 'name', (body ->> 'active')::boolean
    into v_name, v_active
    from public.server_records
    where entity = 'app_users' and id = p_user_id::text and deleted_at is null;

  v_name := coalesce(p_name, v_name, v_email);
  v_active := coalesce(p_active, v_active, true);
  v_roles := coalesce(p_roles, nullif(v_roles, '{}'::text[]), array['promotor']::text[]);
  v_username := coalesce(p_username, v_username);

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('roles', to_jsonb(v_roles)),
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('username', v_username),
      updated_at = now()
  where id = p_user_id;

  perform public.upsert_app_user(p_user_id, v_email, v_name, v_roles, v_active, v_username);
end;
$$;

-- Contraseña: la fija el admin (reseteo o primera entrega). El usuario no tiene
-- flujo de "olvidé mi contraseña" en el MVP (PRD §3.4).
create or replace function public.admin_set_app_user_password(
  p_user_id uuid,
  p_password text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_app_admin() then
    raise exception 'solo el administrador puede cambiar contraseñas' using errcode = '42501';
  end if;
  if coalesce(length(p_password), 0) < 8 then
    raise exception 'la contraseña necesita al menos 8 caracteres' using errcode = '22023';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'no existe la cuenta %', p_user_id using errcode = 'P0002';
  end if;

  update auth.users
  set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now()
  where id = p_user_id;
end;
$$;

-- Desactivar (no borrar) conserva la auditoría: el body se mantiene íntegro para
-- que el admin siga viendo quién era, y `deleted_at` saca el perfil del delta de
-- los dispositivos + libera el username para el índice parcial.
create or replace function public.admin_deactivate_app_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'solo el administrador puede desactivar usuarios' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'no puedes desactivar tu propia cuenta' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.server_records
    where entity = 'app_users' and id = p_user_id::text and deleted_at is null
  ) then
    raise exception 'no existe el perfil %', p_user_id using errcode = 'P0002';
  end if;

  update public.server_records
  set body = body || jsonb_build_object('active', false),
      client_updated_at = now(),
      deleted_at = now()
  where entity = 'app_users' and id = p_user_id::text;
end;
$$;

-- Reactiva un perfil desactivado (el username vuelve a ocupar el índice único).
create or replace function public.admin_reactivate_app_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'solo el administrador puede reactivar usuarios' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.server_records
    where entity = 'app_users' and id = p_user_id::text
  ) then
    raise exception 'no existe el perfil %', p_user_id using errcode = 'P0002';
  end if;

  update public.server_records
  set body = body || jsonb_build_object('active', true),
      client_updated_at = now(),
      deleted_at = null
  where entity = 'app_users' and id = p_user_id::text;
end;
$$;

-- Lista de cuentas para el panel del admin (no pasa por `server_records`, que el
-- cliente no puede leer directo: es `SECURITY DEFINER` y el gate es admin).
-- `body ->> 'user_id'` solo se castea a uuid si lo es: un perfil viejo o escrito
-- a mano no debe tumbar el listado entero.
create or replace function public.admin_list_app_users()
returns table (
  user_id uuid,
  email text,
  username text,
  name text,
  roles text[],
  active boolean,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select
    case when body ->> 'user_id' ~* '^[0-9a-f-]{36}$'
      then (body ->> 'user_id')::uuid
      else null end,
    body ->> 'email',
    body ->> 'username',
    body ->> 'name',
    coalesce(array(
      select jsonb_array_elements_text(body -> 'roles')
    ), '{}'::text[]),
    coalesce((body ->> 'active')::boolean, true) and deleted_at is null,
    client_created_at
  from public.server_records
  where entity = 'app_users'
    and public.is_app_admin()
  order by (body ->> 'username') nulls last, body ->> 'email';
$$;

-- ------------------------------------------------------------------ grants
grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.upsert_app_user(uuid, text, text, text[], boolean, text) to authenticated;
grant execute on function public.admin_create_app_user(text, text, text, text[], text) to authenticated;
grant execute on function public.admin_update_app_user(uuid, text, text[], text, boolean) to authenticated;
grant execute on function public.admin_set_app_user_password(uuid, text) to authenticated;
grant execute on function public.admin_deactivate_app_user(uuid) to authenticated;
grant execute on function public.admin_reactivate_app_user(uuid) to authenticated;
grant execute on function public.admin_list_app_users() to authenticated;
