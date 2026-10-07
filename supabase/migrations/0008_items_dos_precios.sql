-- 0008_items_dos_precios.sql
-- Fase 3: el canal (mayor/detal) se retira del catálogo. Cada ítem pasa a tener
-- SOLO 2 precios en USD: precio_contado y precio_credito, elegidos según la
-- condición de la venta. Referencia sobre el catálogo real (el único ítem
-- activo, «Galleta trigo de oro 90g»): se conservan los valores «mayor» de antes
-- (contado 0.55 / crédito 0.60). Ajustables luego desde el módulo Catálogo.
-- LWW: se refresca client_updated_at para que la corrección llegue sobre la copia
-- local del dispositivo (un ítem sin inventario, prioridad baja §5.1).

update public.server_records
set body = jsonb_build_object(
  'nombre', body->>'nombre',
  'precio_contado', 0.55,
  'precio_credito', 0.60
),
  client_updated_at = now()
where entity = 'items'
  and deleted_at is null
  and id = '01M3QAKKH3CC69QHMM8SRQK7VX';