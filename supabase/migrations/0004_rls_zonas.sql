-- 0004_rls_zonas.sql
-- Fase 2 (§2.8 módulos 2 y 3: Clientes + Zonas, PRD §3.3 geo, §3.5 consentimiento).
-- Dos cosas:
--   1) Lockdown de `server_records`: 0001 habilitó RLS pero no agregó políticas.
--      Los clientes (anon/authenticated) solo deben tocar la tabla a través de
--      las RPCs SECURITY DEFINER pull_delta/push_bulk (corren como el dueño
--      `postgres`, que RLS no alcanza porque no está en FORCE). Lectura directa
--      queda denegada explícitamente para los roles de cliente.
--   2) Backfill de zonas geográficas (estado Carabobo + Aragua) como filas LWW
--      normales: los dispositivos las bajan por pull_delta igual que cualquier
--      otra entidad. `plus_code` se omite a propósito (opcional) para que la
--      asignación por geolocalización use haversine sobre lat/lng.

-- ───────────────────────────── 1) Lockdown ─────────────────────────────
alter table public.server_records enable row level security;

-- Belt & suspenders: niega cualquier acceso directo a los roles de cliente.
-- No afecta a las RPCs SECURITY DEFINER (se ejecutan como `postgres`, dueño
-- de la tabla, y RLS sin FORCE no aplica al dueño).
drop policy if exists server_records_deny_client_roles on public.server_records;
create policy server_records_deny_client_roles
  on public.server_records
  for all
  to anon, authenticated
  using (false)
  with check (false);

-- Los privilegios de tabla nunca deben existir para clientes: solo las RPCs.
revoke all on table public.server_records from anon, authenticated;

-- ───────────────────────────── 2) Seed de zonas ─────────────────────────────
-- Zona → municipio → estado. lat/lng ~ centroides para haversine (ZONA_RADIO_KM).
insert into public.server_records (entity, id, body, client_created_at, client_updated_at, deleted_at)
select * from (values
  -- Carabobo (Valencia y alrededores)
  ('zonas', '01M3A2XTGYZRSEJ4GV1FXVVYTY', '{"nombre":"Carmen","municipio":"Valencia","estado":"Carabobo","lat":10.1621,"lng":-68.0077}'),
  ('zonas', '01M3A2XTH3R4SKYTCZH0KPJP5D', '{"nombre":"San Blas","municipio":"Valencia","estado":"Carabobo","lat":10.1378,"lng":-68.0136}'),
  ('zonas', '01M3A2XTH31TBMVR3SRGG7J7WC', '{"nombre":"La Isabelica","municipio":"Valencia","estado":"Carabobo","lat":10.1367,"lng":-68.0258}'),
  ('zonas', '01M3A2XTH4YRGJCPEATJMYCD22', '{"nombre":"Naguanagua","municipio":"Naguanagua","estado":"Carabobo","lat":10.2464,"lng":-68.0153}'),
  ('zonas', '01M3A2XTH48EC48CT8NXBWC3RZ', '{"nombre":"San Diego","municipio":"San Diego","estado":"Carabobo","lat":10.2536,"lng":-67.9244}'),
  ('zonas', '01M3A2XTH4QBX1GK81RSYH5DHC', '{"nombre":"Guacara","municipio":"Guacara","estado":"Carabobo","lat":10.2356,"lng":-67.8819}'),
  ('zonas', '01M3A2XTH4VZ6C9P9MK48KK2EA', '{"nombre":"Mariara","municipio":"Mariara","estado":"Carabobo","lat":10.3164,"lng":-67.8931}'),
  ('zonas', '01M3A2XTH40QSVGA9PRGPE1PYJ', '{"nombre":"Puerto Cabello","municipio":"Puerto Cabello","estado":"Carabobo","lat":10.4731,"lng":-68.0125}'),
  ('zonas', '01M3A2XTH4A4ZKTZ958G2VNC7Y', '{"nombre":"Los Guayos","municipio":"Los Guayos","estado":"Carabobo","lat":10.2047,"lng":-67.9647}'),
  -- Aragua
  ('zonas', '01M3A2XTH46VE1NR81KSB1CP6C', '{"nombre":"Maracay","municipio":"Girardot","estado":"Aragua","lat":10.2469,"lng":-67.5958}'),
  ('zonas', '01M3A2XTH5P0A5TBMHBG5NMBEF', '{"nombre":"Turmero","municipio":"Mariño","estado":"Aragua","lat":10.2386,"lng":-67.4894}'),
  ('zonas', '01M3A3123NBN4NXFZCCM5VW9G0', '{"nombre":"El Limón","municipio":"Girardot","estado":"Aragua","lat":10.3053,"lng":-67.6256}'),
  ('zonas', '01M3A3123TQQ0M4ENGJ34VR0AN', '{"nombre":"Villa de Cura","municipio":"Zamora","estado":"Aragua","lat":10.0544,"lng":-67.4600}')
) as seed(entity, id, body)
on conflict (entity, id) do nothing;
