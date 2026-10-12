# @brian/web

PWA del hub: React 19 + Vite + TypeScript + Tailwind v4, con un espejo local en
IndexedDB (Dexie) y sincronización vía `@brian/sync-engine`.

## Desarrollo

```bash
# desde la raíz del monorepo
pnpm install
cp apps/web/.env.example apps/web/.env.local   # VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
pnpm dev                                       # http://localhost:5173
```

En `import.meta.env.DEV` la app **auto-siembra datos de demostración** cuando el
espejo está vacío: `main.tsx` llama a `seedDemoSiVacio()` (`src/dev/demoData.ts`)
para poder recorrer todas las secciones sin conectarse a Supabase. El seed no
pasa por el outbox (solo llena el mirror local) y se limpia con
`limpiarDemoData()` (también desde la sección Config).

## Entorno

- `VITE_SUPABASE_URL` — URL del proyecto (1 solo proyecto, MVP).
- `VITE_SUPABASE_PUBLISHABLE_KEY` — clave pública (equivale a la antigua _anon key_).
- La _secret key_ nunca llega al cliente.

Gate de clave: la app **no entra al hub sin la tasa BCV** configurada
(`RequireBcvRate` → `getAppConfig()`); si falta, muestra la pantalla de tasa.

## Estructura

- `src/app/` — shell, `router.tsx` (`HashRouter`), `PageShell`, sidebar y sesión.
- `src/<sección>/` — una carpeta por sección: `clientes` (incluye zonas),
  `ventas`, `catalogo`, `personal`, `config`, `auth`, `sync`, `bimoneda`, `dev`.
- `src/ui/` — componentes y tokens de presentación (iconos, filtros, fotos…).
- `src/lib/` — utilidades puras (texto, fechas, geo, fotos).

### Convenciones de UI

- **Todo formulario y detalle es una página** dentro de `PageShell` (título +
  volver). El único diálogo es `NuevaZonaDialog` (alta rápida anidada).
- El routing usa **`HashRouter`**: los deep-links (`#/clientes/:id`) y el botón
  atrás de Android funcionan sin rewrites del servidor.
- Los formularios de edición **precargan una sola vez** (`useRef` + `useEffect`)
  para no pisar lo que el usuario escribe durante una re-sincronización.

## Scripts

| Script                               | Qué hace                         |
| ------------------------------------ | -------------------------------- |
| `pnpm --filter @brian/web dev`       | Dev server (HTTPS autofirmado)   |
| `pnpm --filter @brian/web build`     | `tsc -b` + `vite build`          |
| `pnpm --filter @brian/web typecheck` | `tsc -b --pretty false` (strict) |
| `pnpm --filter @brian/web lint`      | ESLint (`--max-warnings=0`)      |
| `pnpm --filter @brian/web test`      | Vitest                           |

Los umbrales de cobertura de los paquetes viven en `vitest.shared.ts` (raíz); el
web es **warn-only** (sin umbral bloqueante) por ahora.

## Smoke / E2E

```bash
pnpm dev                                  # en una terminal
node tools/smoke/smoke.mjs                # desde la raíz
node tools/smoke/demo-check.mjs           # verifica el seed de demostración
```

Los scripts usan `playwright-core` con Chrome instalado (`channel: 'chrome'`),
simulan un viewport móvil (390×844) y `demo-check.mjs` además ignora el
certificado autofirmado del dev server (`ignoreHTTPSErrors`).
