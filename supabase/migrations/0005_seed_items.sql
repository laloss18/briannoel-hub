-- 0005_seed_items.sql
-- Fase 3 (PRD §2.2, §2.6): catálogo simple configurable SIN inventario (§2.3) y
-- precios por condición (crédito/contado) × canal (mayor/detal). El catálogo lo
-- gestiona el admin (`manage_items`); este seed baja la primera versión para
-- que los dispositivos puedan vender tras la primera sync. `creador` de semilla:
-- sistema (ULIDes bustos). LWW por client_updated_at como cualquier entidad.
--
-- Los precios son referenciales (USD, moneda base §7.4) y configurables por el
-- admin: venta a crédito suele tener un precio levemente superior al contado y
-- el mayor es menor al detal (PRD §2.2). El admin ajusta con la app.

insert into public.server_records (entity, id, body, client_created_at, client_updated_at, deleted_at)
select * from (values
  -- Harina de maíz precocida (unidad del crédito: 1 bolsa/pack, §2.5)
  ('items', '01M3AJ7X9W6V4D4N5H6J7K8L9Q', '{"nombre":"Bolsa Harina PAN 1kg","precio_credito_mayor":1.35,"precio_credito_detal":1.55,"precio_contado_mayor":1.20,"precio_contado_detal":1.45}'),
  ('items', '01M3AJ7XA29R9E5O9P7Q8R9S0T', '{"nombre":"Caja Harina Harina P.A.N. 3x1kg","precio_credito_mayor":3.60,"precio_credito_detal":4.10,"precio_contado_mayor":3.30,"precio_contado_detal":3.85}'),
  -- Arroz y granos
  ('items', '01M3AJ7XB35S2F6P1Q8T9U1V2W', '{"nombre":"Arroz blanco 1kg","precio_credito_mayor":1.25,"precio_credito_detal":1.45,"precio_contado_mayor":1.10,"precio_contado_detal":1.35}'),
  ('items', '01M3AJ7XC41T3G7Q2R9U2V3X4Y', '{"nombre":"Azúcar refinada 1kg","precio_credito_mayor":1.10,"precio_credito_detal":1.30,"precio_contado_mayor":0.95,"precio_contado_detal":1.20}'),
  ('items', '01M3AJ7XD52U4H8R3T0V4Y5Z6A', '{"nombre":"Pasta corta 500g","precio_credito_mayor":0.85,"precio_credito_detal":1.00,"precio_contado_mayor":0.75,"precio_contado_detal":0.95}'),
  ('items', '01M3AJ7XE63V5I9S4U1W5Z6A7B', '{"nombre":"Aceite vegetal 1L","precio_credito_mayor":3.10,"precio_credito_detal":3.60,"precio_contado_mayor":2.85,"precio_contado_detal":3.35}'),
  ('items', '01M3AJ7XF74W6J0T5V2X7B8C9A', '{"nombre":"Lata Sardinas 170g","precio_credito_mayor":1.45,"precio_credito_detal":1.70,"precio_contado_mayor":1.30,"precio_contado_detal":1.60}'),
  ('items', '01M3AJ7XG85X7K1U6Y3Y8C9D0B', '{"nombre":"Sal refinada 1kg","precio_credito_mayor":0.50,"precio_credito_detal":0.65,"precio_contado_mayor":0.45,"precio_contado_detal":0.60}')
) as seed(entity, id, body)
on conflict (entity, id) do nothing;