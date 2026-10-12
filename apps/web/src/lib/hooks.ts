import { useEffect, useRef } from 'react';

/**
 * Ejecuta `aplicar` una sola vez, cuando `valor` pasa de vacío a presente
 * (Dexie entrega los datos de forma asíncrona). No se repite en cada re-sync
 * para no pisar lo que el usuario va escribiendo en el formulario.
 */
export function usePrecargaUnaVez<T>(valor: T | null | undefined, aplicar: (v: T) => void) {
  const hecho = useRef(false);
  useEffect(() => {
    if (!valor || hecho.current) return;
    hecho.current = true;
    aplicar(valor);
  }, [valor, aplicar]);
}

/**
 * Resuelve un registro por id desde una lista (`useLiveQuery`) y expone los
 * estados derivados típicos de una página de detalle/edición: `cargando` (la
 * lista aún no llegó), `noEncontrado` (llegó y no está) y `editando`.
 */
export function useRegistroPorId<T extends { id: string }>(
  id: string | undefined,
  lista: T[] | undefined,
): { registro: T | null; cargando: boolean; noEncontrado: boolean; editando: boolean } {
  const registro = id ? ((lista ?? []).find((x) => x.id === id) ?? null) : null;
  return {
    registro,
    cargando: Boolean(id) && lista === undefined,
    noEncontrado: Boolean(id) && lista !== undefined && registro === null,
    editando: Boolean(id && registro),
  };
}
