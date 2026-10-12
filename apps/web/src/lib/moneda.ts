/**
 * Formato de moneda/montos (2 decimales). Centraliza el `toFixed(2)` que estaba
 * repetido por toda la app y fija las dos convenciones de prefijo existentes:
 * `US$56.00` (listas, detalle y wizard) y `US$ 56.00` (tarjetas de resumen).
 */

/** `US$1234.56` — sin espacio (formato por defecto). */
export const usd = (n: number): string => `US$${n.toFixed(2)}`;

/** `US$ 1234.56` — con espacio (tarjetas de resumen). */
export const usdConEspacio = (n: number): string => `US$ ${n.toFixed(2)}`;

/** `Bs 1234.56`. */
export const bs = (n: number): string => `Bs ${n.toFixed(2)}`;

/** `1234.56` — cifra sin unidad (tasa BCV, saldos ya rotulados con su moneda). */
export const dosDecimales = (n: number): string => n.toFixed(2);
