/**
 * Tasa BCV (PRD §7.4 "API BCV oficial + fallback manual").
 *
 * Historial del bug (2026-10-07): la app tenía DOS caminos rotos.
 *  1. `api.ts` apuntaba a `ve.dolarapi.com/v1/dolares/oficial/bcv` → 404.
 *  2. El gate (`RequireBcvRateGate`) tenía su propio fetch a `pydolarve.org`
 *     que no resuelve DNS.
 * Ahora hay UN solo camino: `fetchBcvRate()` con cadena de fuentes y parser
 * tolerante a los distintos formatos (`promedio`, `price`, `rates.bcv`, …).
 * Si todas fallan retorna `null` y la app cae en la captura manual.
 */

const FUENTES: readonly string[] = [
  // Venezoalana, CORS `*`, hoy devuelve { moneda, fuente, promedio, fechaActualizacion }
  'https://ve.dolarapi.com/v1/dolares/oficial',
  // Mismo proveedor por URL distinta (si reordenan rutas, la lista sigue viva)
  'https://ve.dolarapi.com/v1/dolares',
  // Respaldo: sólo si el entorno lo resuelve (a veces cae; por eso es último)
  'https://pydolarve.org/api/v1/dollar?type=bcv',
];

export interface TasaBcv {
  /** Bs por dólar. */
  tasa: number;
  /** Última publicación que reportó la fuente (ISO), si la trajo. */
  fecha?: string;
  /** Identificador corto de la fuente que respondió (para la UI). */
  fuente: string;
}

/** Extrae una tasa plausible de cualquier shape conocido. */
function parseTasa(json: unknown): { tasa: number; fecha?: string } | null {
  if (typeof json === 'number') return json > 0 ? { tasa: json } : null;
  if (!json || typeof json !== 'object') return null;
  const o = json as Record<string, unknown>;

  const candidatos: unknown[] = [
    o.promedio,
    o.price,
    o.bcv,
    o.value,
    o.venta,
    (o.dollar as Record<string, unknown> | undefined)?.bcv,
    (o.rates as Record<string, unknown> | undefined)?.bcv,
    (o.data as Record<string, unknown> | undefined)?.promedio,
    Array.isArray(json) ? (json[0] as Record<string, unknown> | undefined)?.price : undefined,
    // Lista de casas: buscar la oficial (ve.dolarapi.com/v1/dolares)
    Array.isArray(o.data)
      ? (o.data as Record<string, unknown>[]).find((c) => c?.fuente === 'oficial')?.promedio
      : undefined,
  ];

  for (const c of candidatos) {
    const n = typeof c === 'number' ? c : typeof c === 'string' ? Number.parseFloat(c) : NaN;
    if (Number.isFinite(n) && n > 0) {
      const fecha = typeof o.fechaActualizacion === 'string' ? o.fechaActualizacion : undefined;
      return { tasa: n, fecha };
    }
  }
  return null;
}

async function intentar(url: string, signal?: AbortSignal): Promise<TasaBcv | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const parsed = parseTasa(await res.json());
    if (!parsed) return null;
    return { ...parsed, fuente: new URL(url).hostname };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Obtiene la tasa oficial probando cada fuente en orden. Retorna `null` si
 * ninguna respondió (offline, CORS o shape desconocido) — el llamador decide
 * el fallback manual. `VITE_BCV_API_URL`, si existe, se prueba primero.
 */
export async function fetchBcvRate(signal?: AbortSignal): Promise<TasaBcv | null> {
  const urls = [
    ...(import.meta.env.VITE_BCV_API_URL ? [String(import.meta.env.VITE_BCV_API_URL)] : []),
    ...FUENTES,
  ];
  for (const url of urls) {
    const r = await intentar(url, signal);
    if (r) return r;
  }
  return null;
}
