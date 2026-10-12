/**
 * Normaliza un texto para búsquedas tolerantes: minúsculas y sin acentos
 * (NFD + eliminación de diacríticos). El término buscado y el campo de cada
 * registro deben pasar por aquí para que coincidan.
 */
export function normaliza(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
