import { describe, expect, it } from 'vitest';
import { applyOverride, computeScore, gradeFor } from '../src';
import type { Score, ScoreHistory } from '../src';

const AS_OF = '2024-06-01T00:00:00.000Z';

function history(overrides: Partial<ScoreHistory> = {}): ScoreHistory {
  return { tenureDays: 400, asOf: AS_OF, ...overrides };
}

describe('gradeFor', () => {
  const cases: Array<[number, 'A' | 'B' | 'C' | 'D' | 'E']> = [
    [100, 'A'],
    [85, 'A'],
    [84, 'B'],
    [70, 'B'],
    [69, 'C'],
    [55, 'C'],
    [54, 'D'],
    [40, 'D'],
    [39, 'E'],
    [0, 'E'],
  ];
  for (const [v, g] of cases) {
    it(`puntúa ${v} → ${g}`, () => {
      expect(gradeFor(v)).toBe(g);
    });
  }
});

describe('computeScore — historia vacía (Fase 2, uso referencial)', () => {
  it('historial sin pagos ni compras: factores neutrales y score bajo', () => {
    const score = computeScore(history({ tenureDays: 0 }));

    expect(score.factors.puntualidad).toBe(0.5);
    expect(score.factors.frecuencia).toBe(0);
    expect(score.factors.monto).toBe(0.5);
    expect(score.factors.antiguedad).toBe(0.5);
    expect(score.source).toBe('auto');
    expect(score.value).toBeLessThanOrEqual(100);
    expect(score.value).toBeGreaterThanOrEqual(0);
  });
});

describe('computeScore — puntualidad', () => {
  it('todos los pagos a tiempo: puntualidad = 1', () => {
    const s = computeScore(
      history({
        payments: [
          { due: '2024-01-10T00:00:00.000Z', paid: '2024-01-09T00:00:00.000Z' },
          { due: '2024-02-10T00:00:00.000Z', paid: '2024-02-10T00:00:00.000Z' },
        ],
      }),
    );
    expect(s.factors.puntualidad).toBe(1);
  });

  it('un pago tarde reduce el factor proporcionalmente', () => {
    const s = computeScore(
      history({
        payments: [
          { due: '2024-01-10T00:00:00.000Z', paid: '2024-01-09T00:00:00.000Z' },
          { due: '2024-02-10T00:00:00.000Z', paid: '2024-02-15T00:00:00.000Z' },
        ],
      }),
    );
    expect(s.factors.puntualidad).toBeLessThan(1);
  });

  it('vencimiento pasado sin pago cuenta como violación', () => {
    const s = computeScore(
      history({
        payments: [
          { due: '2024-01-10T00:00:00.000Z', paid: '2024-01-05T00:00:00.000Z' },
          { due: '2024-05-10T00:00:00.000Z', paid: null }, // vence antes de asOf y no pagó
        ],
      }),
    );
    expect(s.factors.puntualidad).toBe(0.5);
  });

  it('vencimiento futuro sin pago aún no evalúa negativo', () => {
    const s = computeScore(
      history({
        payments: [{ due: '2024-07-01T00:00:00.000Z', paid: null }],
      }),
    );
    expect(s.factors.puntualidad).toBe(0.5);
  });

  it('pagos sin vencimiento no se evalúan (neutral)', () => {
    const s = computeScore(history({ payments: [{ due: '', paid: '2024-01-01T00:00:00.000Z' }] }));
    expect(s.factors.puntualidad).toBe(0.5);
  });
});

describe('computeScore — frecuencia (ventana 90 días)', () => {
  it('sin compras → frecuencia 0', () => {
    const s = computeScore(history());
    expect(s.factors.frecuencia).toBe(0);
  });

  it('compra reciente dentro de la ventana aporta', () => {
    const s = computeScore(
      history({
        purchases: [{ amount: 200, at: '2024-05-01T00:00:00.000Z' }],
      }),
    );
    expect(s.factors.frecuencia).toBeGreaterThan(0);
  });

  it('compra fuera de la ventana cuenta como total pero no como reciente', () => {
    const s = computeScore(
      history({
        purchases: [{ amount: 200, at: '2024-01-01T00:00:00.000Z' }], // >90 días antes de asOf
      }),
    );
    expect(s.factors.frecuencia).toBe(0);
  });

  it('satura en el objetivo de frecuencia', () => {
    const purchases = Array.from({ length: 12 }, (_, i) => ({
      amount: 150,
      at: new Date(Date.parse(AS_OF) - i * 7 * 86_400_000).toISOString(),
    }));
    const s = computeScore(history({ purchases }));
    expect(s.factors.frecuencia).toBe(1);
  });
});

describe('computeScore — monto', () => {
  it('sin compras → monto neutral', () => {
    const s = computeScore(history());
    expect(s.factors.monto).toBe(0.5);
  });

  it('ticket equivalente al target → ~0.5 (curva logarítmica)', () => {
    const s = computeScore(
      history({ purchases: [{ amount: 100, at: '2024-05-01T00:00:00.000Z' }] }),
    );
    expect(s.factors.monto).toBeCloseTo(0.5, 4);
  });

  it('tickets mayores aumentan el factor pero saturan antes de 1', () => {
    const low = computeScore(
      history({ purchases: [{ amount: 50, at: '2024-05-01T00:00:00.000Z' }] }),
    );
    const high = computeScore(
      history({ purchases: [{ amount: 10_000, at: '2024-05-01T00:00:00.000Z' }] }),
    );
    expect(high.factors.monto).toBeGreaterThan(low.factors.monto);
    expect(high.factors.monto).toBeLessThanOrEqual(1);
  });

  it('ignora montos no finitos', () => {
    const s = computeScore(
      history({ purchases: [{ amount: Number.NaN, at: '2024-05-01T00:00:00.000Z' }] }),
    );
    expect(s.factors.monto).toBe(0.5);
  });
});

describe('computeScore — antigüedad', () => {
  it('cliente maduro (>1 año) → 1', () => {
    const s = computeScore(history({ tenureDays: 730 }));
    expect(s.factors.antiguedad).toBe(1);
  });

  it('cliente nuevo → proporcional', () => {
    const s = computeScore(history({ tenureDays: 100 }));
    expect(s.factors.antiguedad).toBeCloseTo(100 / 365, 4);
  });

  it('tenure 0 → neutral', () => {
    const s = computeScore(history({ tenureDays: 0 }));
    expect(s.factors.antiguedad).toBe(0.5);
  });
});

describe('computeScore — pesos', () => {
  it('permite calibrar pesos', () => {
    const weights = { puntualidad: 1, frecuencia: 0, monto: 0, antiguedad: 0 };
    const s = computeScore(
      history({
        payments: [
          { due: '2024-01-10T00:00:00.000Z', paid: '2024-01-09T00:00:00.000Z' },
          { due: '2024-02-10T00:00:00.000Z', paid: '2024-02-10T00:00:00.000Z' },
        ],
      }),
      weights,
    );
    expect(s.factors.puntualidad).toBe(1);
    expect(s.value).toBe(100); // solo puntualidad → 100*1
  });

  it('cliente sólido → grado alto', () => {
    const s = computeScore(
      history({
        tenureDays: 900,
        payments: [
          { due: '2024-01-10T00:00:00.000Z', paid: '2024-01-09T00:00:00.000Z' },
          { due: '2024-02-10T00:00:00.000Z', paid: '2024-02-10T00:00:00.000Z' },
          { due: '2024-03-10T00:00:00.000Z', paid: '2024-03-08T00:00:00.000Z' },
        ],
        purchases: Array.from({ length: 10 }, (_, i) => ({
          amount: 250,
          at: new Date(Date.parse(AS_OF) - i * 8 * 86_400_000).toISOString(),
        })),
      }),
    );
    expect(s.grade).toBe('A');
    expect(s.value).toBeGreaterThanOrEqual(85);
  });
});

describe('applyOverride', () => {
  it('aplica override manual conservando el desglose automático', () => {
    const auto = computeScore(history());
    const o = {
      value: 95,
      by: 'supervisor@briannoel.com',
      at: AS_OF,
      reason: 'cliente estratégico',
    };
    const s = applyOverride(auto, o);

    expect(s.source).toBe('override');
    expect(s.value).toBe(95);
    expect(s.grade).toBe('A');
    expect(s.override).toEqual({ ...o, grade: 'A' });
    expect(s.factors).toEqual(auto.factors);
  });

  it('recalcula el grado del override', () => {
    const auto = computeScore(history());
    const s = applyOverride(auto, {
      value: 30,
      by: 'admin@briannoel.com',
      at: AS_OF,
      reason: 'morosidad documentada',
    });
    expect(s.value).toBe(30);
    expect(s.grade).toBe('E');
  });

  it('no muta el score original (inmutable)', () => {
    const auto = computeScore(history());
    const snapshot = { ...auto, factors: { ...auto.factors } };
    const s = applyOverride(auto, {
      value: 80,
      by: 'admin@briannoel.com',
      at: AS_OF,
      reason: 'ajuste',
    });
    expect(auto.value).toBe(snapshot.value);
    expect(auto.source).toBe('auto');
    expect(s.value).toBe(80);
  });
});

describe('computeScore — invariantes', () => {
  it('valor siempre en [0,100] y entero', () => {
    for (let t = 0; t <= 1000; t += 37) {
      const s = computeScore(history({ tenureDays: t }));
      expect(s.value).toBeGreaterThanOrEqual(0);
      expect(s.value).toBeLessThanOrEqual(100);
      expect(Number.isInteger(s.value)).toBe(true);
      expect(s.grade).toBe(gradeFor(s.value));
    }
  });

  it('score propagado por tipos: el caller tipa Score completo', () => {
    const s: Score = computeScore(history());
    expect(typeof s.value).toBe('number');
    expect(s.source).toBe('auto');
  });
});
