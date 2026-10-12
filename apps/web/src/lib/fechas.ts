/**
 * `YYYY-MM-DD` del día **local** (no UTC): los filtros por fecha y los atajos
 * «hoy / 7 / 30 días» usan el día del dispositivo del vendedor.
 */
export function diaLocal(fecha: Date | string = new Date()): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` (local) de hace `n` días. */
export function diaLocalHace(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return diaLocal(d);
}
