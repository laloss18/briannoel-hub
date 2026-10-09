import { useCallback, useState } from 'react';

/**
 * Tema dual (DESIGN §3): claro por defecto, oscuro opcional. La decisión se
 * guarda en `localStorage` y se aplica sobre `<html data-theme="dark">`; el
 * bootstrap que evita el flash vive en `index.html` (mismo código, antes del
 * primer paint). Los tokens de color viven en `index.css`.
 */
export type Tema = 'claro' | 'oscuro';

const CLAVE = 'bh_tema';

export function temaActual(): Tema {
  try {
    return localStorage.getItem(CLAVE) === 'oscuro' ? 'oscuro' : 'claro';
  } catch {
    return 'claro';
  }
}

export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === 'oscuro') raiz.setAttribute('data-theme', 'dark');
  else raiz.removeAttribute('data-theme');

  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    /* Sin storage el tema dura solo esta sesión; no es un fallo. */
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', tema === 'oscuro' ? '#0b1220' : '#f4f5f7');
}

/** Estado del tema para React: lee el aplicado y lo cambia en vivo. */
export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setTema] = useState<Tema>(temaActual);

  const cambiar = useCallback((t: Tema) => {
    aplicarTema(t);
    setTema(t);
  }, []);

  return [tema, cambiar];
}
