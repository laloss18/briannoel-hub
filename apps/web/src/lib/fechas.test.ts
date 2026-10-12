import { describe, expect, it } from 'vitest';
import { diaLocal, diaLocalHace } from './fechas';

/** Diferencia en días calendario entre dos `YYYY-MM-DD`, robusta a zonas/DST. */
function diasEntre(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number) as [number, number, number];
  const [by, bm, bd] = b.split('-').map(Number) as [number, number, number];
  return (Date.UTC(ay, am - 1, ad) - Date.UTC(by, bm - 1, bd)) / 86_400_000;
}

describe('diaLocal', () => {
  it('formatea un Date local como YYYY-MM-DD', () => {
    expect(diaLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('rellena mes y día con cero a la izquierda', () => {
    expect(diaLocal(new Date(2026, 8, 9))).toBe('2026-09-09');
  });

  it('usa por defecto la fecha actual', () => {
    expect(diaLocal()).toBe(diaLocal(new Date()));
  });

  it('acepta un string ISO y conserva el día local', () => {
    const d = new Date(2026, 11, 31, 10, 30);
    expect(diaLocal(d.toISOString())).toBe('2026-12-31');
  });
});

describe('diaLocalHace', () => {
  it('retrocede n días respecto de hoy', () => {
    expect(diasEntre(diaLocal(), diaLocalHace(6))).toBe(6);
    expect(diasEntre(diaLocal(), diaLocalHace(29))).toBe(29);
  });

  it('diaLocalHace(0) es hoy', () => {
    expect(diaLocalHace(0)).toBe(diaLocal());
  });
});
