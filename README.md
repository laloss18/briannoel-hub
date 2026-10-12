# Brian Noel Hub

ERP modular **offline-first** para la operación de campo de Brian Noel: la PWA
funciona sin conexión sobre un espejo local (IndexedDB) y sincroniza con un
motor propio (`stellar-drive`) cuando hay red.

## Qué es

- **Un solo frontend**: `apps/web`, PWA en React + Vite + TypeScript.
- **Dominio en paquetes**: la lógica de negocio vive fuera de la UI
  (`packages/*`), consumida por el frontend vía workspace.
- **Offline-first**: cada escritura pasa por un _outbox_ y un espejo local; el
  servidor es un almacén idempotente "tonto" (dedupe por `id` con guarda LWW).
- **Identidad**: el **email** es la clave de auditoría; el **username** es la
  identidad visible. No hay signup público: el admin da de alta usuarios por RPC.

## Estructura

| Ruta                   | Qué es                                                           |
| ---------------------- | ---------------------------------------------------------------- |
| `apps/web`             | PWA (React 19 + Vite + Tailwind v4 + Dexie para el espejo local) |
| `packages/shared`      | Tipos, esquemas zod, constantes y permisos                       |
| `packages/sync-engine` | Motor de sync (`stellar-drive`): outbox, delta, LWW, clock-sync  |
| `packages/scoring`     | Score de clientes (grados A–D)                                   |
| `packages/clientes`    | Dominio de clientes y zonas                                      |
| `packages/ventas`      | Dominio de ventas/despachos (stock, totales, inmutabilidad)      |
| `packages/pin-auth`    | Desbloqueo por PIN del dispositivo                               |
| `tools/smoke`          | Harness de smoke/E2E con Playwright contra el dev server         |
| `supabase/`            | Migraciones SQL + RPCs (`pull_delta` / `push_bulk`)              |

`PRD.md` es la fuente de verdad del producto; `DESIGN.md`, la de lo visual;
`AGENTS.md`, el estado del repo y las convenciones.

## Requisitos

- Node **>= 20** (CI usa 22).
- `pnpm` **11.22** (viene fijado en `packageManager`).

## Puesta en marcha

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # rellena URL + publishable key
pnpm dev                                        # arranca apps/web (Vite)
```

La app no entra al hub sin la tasa BCV configurada: la primera vez la pide por
API oficial o manualmente.

## Scripts (raíz)

| Script                         | Qué hace                                       |
| ------------------------------ | ---------------------------------------------- |
| `pnpm dev`                     | Dev server de `apps/web`                       |
| `pnpm build`                   | Build de todos los paquetes + PWA              |
| `pnpm typecheck`               | `tsc` en todos los paquetes                    |
| `pnpm lint`                    | ESLint en todos los paquetes                   |
| `pnpm format` / `format:check` | Prettier                                       |
| `pnpm test`                    | Vitest (unit + integración)                    |
| `pnpm test:coverage`           | Igual, con cobertura                           |
| `pnpm verify`                  | typecheck + lint + format:check + test + build |

## Tests y calidad

- Unit + integración con **Vitest**. El motor de sync se prueba contra un
  transporte **in-memory** (no toca ninguna DB en CI).
- Suites: `shared`, `scoring`, `pin-auth`, `clientes`, `ventas`, `sync-engine`.
- Los umbrales de cobertura (merge-blocking) viven en **`vitest.shared.ts`** y
  los aplica el CI (`.github/workflows/ci.yml`).
- Smoke/E2E local: `node tools/smoke/smoke.mjs` (necesita `pnpm dev` corriendo).

## Despliegue

PWA estática (Vercel; fallback Cloudflare Pages). El routing usa `HashRouter`,
así que los deep-links (`#/…`) y el botón atrás de Android funcionan sin
rewrites en el servidor.
