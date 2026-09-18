-- Seeds demo del SyncPanel para el ÚNICO proyecto Supabase (MVP).
-- Regla: los seeds solo entran a la base de datos ejecutando `supabase db reset`
-- en local/CI — nunca vía backup automático ni en el workflow semanal (ese
-- jamás escribe en la BD). Los datos reales del negocio se cargan en Fase 2
-- con SQL directo, no con seeds.

insert into public.demo_clients (name) values
  ('Cliente Demo A'),
  ('Cliente Demo B')
on conflict (id) do nothing;
