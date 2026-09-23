/**
 * Tasa BCV: se intenta la API pública que publica la tasa oficial del Banco
 * Central de Venezuela (misma fuente del dólar oficial; PRD §7.4 "API BCV
 * oficial"). Si falla (offline/red no disponible) retorna null — la app usa
 * entonces el ingreso manual como fallback.
 */
export async function fetchBcvRate(): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial/bcv', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { moneda?: string; promedio?: number };
    const rate = typeof data.promedio === 'number' && data.promedio > 0 ? data.promedio : null;
    return rate;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
