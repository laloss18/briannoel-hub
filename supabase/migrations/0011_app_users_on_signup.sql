-- 0011_app_users_on_signup.sql
-- Alta de usuarios gestionada directamente en Supabase (PRD §3.4 revisado).
--
-- La UI de Usuarios se retiró de la app: las cuentas autenticadas se crean a
-- mano en el panel de Supabase (Auth → Add user) y su identidad visible/rol se
-- administra con SQL. Para que el dispositivo resuelva identidad y candidatos
-- sin ese panel, un trigger en `auth.users` materializa el perfil `app_users`
-- (misma forma que `upsert_app_user`, entidad server-only que baja por delta).
--
--   - Rol por defecto: `promotor`. Se toma de `raw_app_meta_data.roles` si el
--     alta lo trajo (admin API/service role); si no, promotor.
--   - Username visible: `raw_user_meta_data.username` si es válido; si no, la
--     parte local del correo; siempre saneado y único (case-insensitive) para
--     cumplir `usernameSchema` (3–40, sin control/`@`, empieza por letra/número).
--   - La lista de roles NO se borra: el perfil (offline) y `app_metadata.roles`
--     (JWT que lee `supabaseGateway.toSession`) deben coincidir. Para cambiarlos
--     en conjunto usar `public.set_app_user_roles(email, roles)` (SQL editor).

-- Saneado del username candidato (mismo alfabeto que `usernameSchema`): se
-- descartan los caracteres fuera de letras/números/espacio/`.,'_-`. Devuelve
-- `''` si el resultado no llega a 3 caracteres. Se usa `[[:alnum:]]` porque el
-- motor de regex de Postgres no soporta `\p{L}`.
create or replace function public.app_users_sanitize_username(p_raw text)
returns text
language sql
immutable
as $$
  select case
    when length(v) < 3 then ''
    else v
  end
  from (
    select left(
      regexp_replace(
        btrim(regexp_replace(
          regexp_replace(btrim(coalesce(p_raw, '')), '[^[:alnum:] .,''_-]', '', 'g'),
          '[[:space:]]+', ' ', 'g'
        )),
        '^[^[:alnum:]]+', ''
      ), 40) as v
  ) t;
$$;

-- Garantiza unicidad case-insensitive del username contra el índice parcial
-- `app_users_username_uniq` (0009): si el candidato está tomado agrega un
-- sufijo numérico. Cae a `usuario` si la base es demasiado corta.
create or replace function public.app_users_unique_username(p_base text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_base text := public.app_users_sanitize_username(p_base);
  v_cand text;
  v_n int := 0;
begin
  if length(v_base) < 3 then
    v_base := 'usuario';
  end if;
  v_cand := v_base;
  while exists (
    select 1
    from public.server_records
    where entity = 'app_users'
      and deleted_at is null
      and lower(body ->> 'username') = lower(v_cand)
  ) loop
    v_n := v_n + 1;
    v_cand := left(v_base, 36) || ' ' || v_n;
  end loop;
  return v_cand;
end;
$$;

-- Trigger: materializa el perfil al crear el `auth.users`.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(NEW.email, '')));
  v_raw_meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_app_meta jsonb := coalesce(NEW.raw_app_meta_data, '{}'::jsonb);
  v_username text;
  v_roles text[];
  v_name text;
begin
  -- Sin correo no hay identidad de auditoría: no materializamos perfil.
  if v_email = '' then
    return NEW;
  end if;

  -- Roles: los del alta si son válidos; ante cualquier duda, promotor.
  begin
    v_roles := public.admin_check_roles(
      coalesce(
        array(select jsonb_array_elements_text(v_app_meta -> 'roles')),
        array['promotor']::text[]
      )
    );
  exception when others then
    v_roles := array['promotor']::text[];
  end;

  -- Username: metadata válida o parte local del correo, saneado y único.
  v_username := public.app_users_sanitize_username(v_raw_meta ->> 'username');
  if length(v_username) < 3 then
    v_username := split_part(v_email, '@', 1);
  end if;
  v_username := public.app_users_unique_username(v_username);

  v_name := nullif(btrim(coalesce(v_raw_meta ->> 'name', v_raw_meta ->> 'full_name', '')), '');

  -- Refleja username/roles en `auth.users` para que el JWT los lleve.
  update auth.users
  set raw_app_meta_data = v_app_meta || jsonb_build_object('roles', to_jsonb(v_roles)),
      raw_user_meta_data = v_raw_meta || jsonb_build_object('username', v_username)
  where id = NEW.id;

  insert into public.server_records (
    entity, id, body, client_created_at, client_updated_at, deleted_at, op_id
  ) values (
    'app_users',
    NEW.id::text,
    jsonb_build_object(
      'user_id', NEW.id::text,
      'email', v_email,
      'name', coalesce(v_name, v_email),
      'username', v_username,
      'roles', to_jsonb(v_roles),
      'active', true
    ),
    now(), now(), null, null
  )
  on conflict (entity, id) do nothing;

  return NEW;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Cambia el rol de una cuenta por correo (SQL editor / service role). Escribe
-- los dos lugares a la vez (`app_metadata.roles` del JWT y el perfil `app_users`)
-- para que no diverjan. NO se expone a `authenticated`: es una herramienta de
-- operación del dueño del proyecto, no una RPC de la app.
create or replace function public.set_app_user_roles(p_email text, p_roles text[])
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid;
  v_roles text[] := public.admin_check_roles(p_roles);
begin
  select id into v_user_id from auth.users where email = lower(btrim(p_email));
  if v_user_id is null then
    raise exception 'no existe la cuenta %', p_email using errcode = 'P0002';
  end if;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
        || jsonb_build_object('roles', to_jsonb(v_roles)),
      updated_at = now()
  where id = v_user_id;

  update public.server_records
  set body = body || jsonb_build_object('roles', to_jsonb(v_roles)),
      client_updated_at = now()
  where entity = 'app_users' and id = v_user_id::text;
end;
$$;

revoke all on function public.set_app_user_roles(text, text[]) from public;
