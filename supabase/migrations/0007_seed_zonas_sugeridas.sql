-- 0007_seed_zonas_sugeridas.sql
-- Amplía las sugerencias de zonas por geolocalización (§2.8 módulo 3): completa
-- Carabobo (los 7 municipios que faltaban del seed 0004) y añade las principales
-- localidades urbanas de Aragua. Con más centroides dentro de ZONA_RADIO_KM=10,
-- «usar mi ubicación» sugiere la zona correcta de inmediato y el registro
-- (cliente/venta) puede confirmarla con un toque.
-- Formato idéntico al seed 0004 (filas LWW; edits posteriores ganan por LWW).

insert into public.server_records (entity, id, body, client_created_at, client_updated_at, deleted_at)
select entity, id, body::jsonb, now(), now(), null from (values
  -- Carabobo (resto de municipios)
  ('zonas', '01M3SJE2BV8EK97MFB28ADNH1P', '{"nombre":"Bejuma","municipio":"Bejuma","estado":"Carabobo","lat":10.1744,"lng":-68.2583}'),
  ('zonas', '01M3SJE2BY7VP4BVT0B8P4009Y', '{"nombre":"Güigüe","municipio":"Carlos Arvelo","estado":"Carabobo","lat":10.0700,"lng":-67.7770}'),
  ('zonas', '01M3SJE2BY2DZQ5QJ3G9KCXT8M', '{"nombre":"Tocuyito","municipio":"Libertador","estado":"Carabobo","lat":10.0900,"lng":-68.0850}'),
  ('zonas', '01M3SJE2BY09000YZM7B2HCG96', '{"nombre":"Miranda","municipio":"Miranda","estado":"Carabobo","lat":10.1411,"lng":-68.3938}'),
  ('zonas', '01M3SJE2BY07H3CFHR32BSF8BT', '{"nombre":"Montalbán","municipio":"Montalbán","estado":"Carabobo","lat":10.2167,"lng":-68.3300}'),
  ('zonas', '01M3SJE2BYYPRSTXK9VKSYFYK0', '{"nombre":"San Joaquín","municipio":"San Joaquín","estado":"Carabobo","lat":10.2667,"lng":-67.9830}'),
  ('zonas', '01M3SJE2BYJC5AZZ9F4PHXS8D4', '{"nombre":"Morón","municipio":"Juan José Mora","estado":"Carabobo","lat":10.4933,"lng":-68.2080}'),
  -- Aragua (localidades urbanas adicionales)
  ('zonas', '01M3SJE2BY1GFKWJHFAH4QY16Q', '{"nombre":"Cagua","municipio":"Sucre","estado":"Aragua","lat":10.1833,"lng":-67.4590}'),
  ('zonas', '01M3SJE2BYA08QR9R78H73E91S', '{"nombre":"La Victoria","municipio":"José Félix Ribas","estado":"Aragua","lat":10.2267,"lng":-67.3340}'),
  ('zonas', '01M3SJE2BY4BRJFGZH57H8AN44', '{"nombre":"Santa Cruz de Aragua","municipio":"Francisco Linares Alcántara","estado":"Aragua","lat":10.1830,"lng":-67.5000}'),
  ('zonas', '01M3SJE2BY1SC5ZZKKY6M54XFQ', '{"nombre":"Palo Negro","municipio":"Libertador","estado":"Aragua","lat":10.1667,"lng":-67.5500}'),
  ('zonas', '01M3SJE2BZ3QNXB9Z805P16G03', '{"nombre":"San Mateo","municipio":"Bolívar","estado":"Aragua","lat":10.2167,"lng":-67.4200}'),
  ('zonas', '01M3SJE2BZVWK1WR8KRAKF6XFZ', '{"nombre":"Ocumare de la Costa","municipio":"Ocumare de la Costa de Oro","estado":"Aragua","lat":10.4667,"lng":-67.7660}')
) as seed(entity, id, body)
on conflict (entity, id) do nothing;