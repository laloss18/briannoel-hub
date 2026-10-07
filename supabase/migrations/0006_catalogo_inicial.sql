-- 0006_catalogo_inicial.sql
-- Fase 3 (PRD §2.2, §2.6): el negocio maneja por ahora un único ítem real
-- («Galleta trigo de oro 90g»). Se retiran (borrado lógico, LWW) los 8 ítems
-- genéricos sembrados en 0005 y se inserta el catálogo real con precios
-- referenciales en USD (moneda base §7.4) ajustables desde el módulo Catálogo.
-- La supresión se propaga a los dispositivos por LWW (deleted_at > updated_at local).

update public.server_records
set deleted_at = now()
where entity = 'items'
  and deleted_at is null
  and body->>'nombre' in (
    'Bolsa Harina PAN 1kg',
    'Caja Harina Harina P.A.N. 3x1kg',
    'Arroz blanco 1kg',
    'Azúcar refinada 1kg',
    'Pasta corta 500g',
    'Aceite vegetal 1L',
    'Lata Sardinas 170g',
    'Sal refinada 1kg'
  );

insert into public.server_records (entity, id, body, client_created_at, client_updated_at, deleted_at)
select entity, id, body::jsonb, now(), now(), null from (values
  -- Catálogo real (1 ítem). Precios USD referenciales: editar en el módulo Catálogo.
  ('items', '01M3QAKKH3CC69QHMM8SRQK7VX', '{"nombre":"Galleta trigo de oro 90g","precio_credito_mayor":0.60,"precio_credito_detal":0.70,"precio_contado_mayor":0.55,"precio_contado_detal":0.65}')
) as seed(entity, id, body)
on conflict (entity, id) do nothing;