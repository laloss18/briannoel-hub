# AGENTS.md

## Repo status (important)
- **Greenfield.** No scaffold exists yet: the repo contains only `PRD.md` + `.git`. Do not assume code, configs, or scripts are present. Nothing has been implemented — Phase 0 has not started.
- `PRD.md` is the **single source of truth** (version "v1.0 · revisado y mejorado"). Read it before proposing features, schemas, or scope changes. It defines: MVP modules, roles/permissions, sync rules, immutability, stock quality gates and coverage targets.

## Agreed architecture decisions (from plan; verify against PRD.md)
- **Monorepo, pnpm workspaces**: `apps/web` (PWA React+Vite+TS) + `packages/sync-engine` (`stellar-drive` sync engine) + `packages/shared` (types/zod/constants). `packages/pin-auth` is Fase 1.
- **Stack**: TailwindCSS + shadcn/ui, TanStack Query + Dexie (IndexedDB), Supabase Cloud (PostgreSQL/Auth/Storage/Realtime). Vercel deployment (fallback Cloudflare Pages).
- **No Docker** in MVP. Integration tests run against the **in-memory transport** (since 2026-09-18 the MVP has a single Supabase project and CI neither mutates nor requires a live DB) alongside MSW for network mocks. Docker is only a contingency for unstable payment sync (Fase 4).
- **Environments**: **1 Supabase project** for the MVP (región `sa-east-1`). No test/staging projects: the sync engine is integration-tested against an **in-memory transport + MSW** (no live-DB mutations in CI), so nothing needs isolating. Add a dedicated test project only if a real-DB integration suite is later introduced. Store secrets as repo GitHub secrets (`SUPABASE_URL`, anon key, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`).
- **Region**: prefer `sa-east-1` (São Paulo), fallback `us-east-1`.
- **Primary keys**: **ULID generated on the client** (sortable → used as sync cursor). Timestamps come **from the client** (no `DEFAULT now()` server-side) for LWW.
- **Sync engine core rules** (`stellar-drive`, the Phase 0 deliverable):
  - Hybrid conflicts: critical entities (pagos, notas de crédito, despachos) = role-priority + specific rules; non-critical = **LWW by `updated_at` with deterministic tie-break by `id`**.
  - **Clock normalization**: compute device-server offset on every sync (`clockSync`) and correct timestamps before writing — BYOD clocks drift and would silently break LWW.
  - Idempotency: server dedupes by `id` (`ON CONFLICT DO NOTHING`); duplicates must not apply twice (e.g. duplicate payment not re-credited).
  - Sync: initial under-demand (§5.5), delta via `sync_cursor` (§5.6), auto on reconnect + manual button, failed ops flagged + audited.
  - Purge: outbox after **7 days**; audit/`sync_events` after **3 months**.
- **Storage policy** (fits free tier): photos only, compressed client-side (~max 800px, JPEG q70, ~100–150 KB), uploaded only when online. PDFs (recibos, estados de cuenta) generated client-side, **never stored**. ID-photo capture optional + consent.

## Testing / quality gates (chapters 6–8 of PRD.md)
- Coverage floors are merge-blocking: sync engine 90%, idempotencia/FIFO 95%, inmutabilidad 90%, scoring 85%, CxC/aging 85%, auth 85%, clientes 80%, ventas 80%, rutas 75%. Lower-priority UI/forms 50–60% → warn only.
- Quality gate per fase (all blocking): coverage met, 0 failing tests, sync + conflict tests pass (incl. clock-skew case: ±5 min device offset), manual Android test, docs updated, demo accepted.
- CI: lint + typecheck + unit + integración + E2E del módulo must pass to merge to `main`; `main` must always be green. Nightly = full suite + all-module E2E.

## Conventions going forward
- Branching/commits: `main` protected, feature branches, Conventional Commits. There are no test/lint scripts yet — they must be created as part of the scaffold in Phase 0, not assumed.