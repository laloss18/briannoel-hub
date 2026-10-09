/** "hace 2 h" / "hace 3 días" para metadatos de tasa y sincronización. */
export function haceRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return 'en un momento';
  const min = Math.round(ms / 60_000);
  if (Math.abs(min) < 1) return 'hace un momento';
  if (Math.abs(min) < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (Math.abs(h) < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (Math.abs(d) < 30) return `hace ${d} día${d === 1 ? '' : 's'}`;
  return new Date(iso).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
}

/** Fecha corta en es-VE: "7 oct 2026, 08:12". */
export function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString('es-VE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
