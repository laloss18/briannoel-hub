# Supabase (1 proyecto, MVP — ver AGENTS.md)

Sin proyectos test/dev: la CI corre contra el transporte in-memory del motor de sync, nunca una
DB viva. Toda la infra de sync vive en un solo proyecto Cloud (`us-east-1`).

## Pasos manuales en el proyecto

1. Aplicar las migraciones en orden:
   - `supabase/migrations/0001_init.sql` — `server_records` (idempotente por
     `ON CONFLICT (entity,id) DO NOTHING`, cursor = `server_updated_at`),
     `server_now()`, RLS habilitado, `demo_clients` (solo demo panel).
   - `supabase/migrations/0002_delta_rpcs.sql` — RPCs `pull_delta`/`push_bulk`
     como `SECURITY DEFINER` (la publishable key las ejecuta sin grants de tabla;
     la secret key nunca llega al cliente).
2. Seeds opcionales: `supabase/seeds/0001_seed.sql`.
3. Secrets de GitHub (para `ci.yml`/`nightly.yml`/`weekly-backup.yml`):
   `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`(o ANON_KEY), `SUPABASE_ACCESS_TOKEN`,
   `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.
4. Local (`apps/web/.env`): `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`
   (ver `apps/web/.env.example`). La secret key va solo en settings/CLI, no repos.

## Contrato de transporte

`apps/web/src/sync/transport.ts` implementa `SyncTransport` contra:
- `pull_delta(entity, cursor?)` → `{ records, next_cursor }` (jsonb; filtro
  `server_updated_at > cursor`, ordenado por `(server_updated_at, id)` para
  aplicar determinista; `next_cursor = null` ⇒ fin de página).
- `push_bulk(entries)` → `{ applied, duplicates }` (re-pushes idempotentes
  descartados a nivel servidor, PRD §5.4).
- `server_now()` → reloj del servidor para clock-sync (PRD §5.1).

El engine aplica LWW + normalización de reloj en el cliente; el servidor es un
almacén idempotente "tonto".