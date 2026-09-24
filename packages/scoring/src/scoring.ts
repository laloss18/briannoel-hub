/**
 * Módulo profundo de scoring de clientes (PRD §2.5, glosario §8.5).
 *
 * Detrás de una interfaz de dos funciones (computeScore / applyOverride)
 * concentra toda la lógica del scoring automático: puntualidad + frecuencia +
 * monto + antigüedad, neutralidad ante historial ausente, blend con decaimiento
 * por recencia, y override manual por supervisor/admin con auditoría.
 *
 * El caller solo aprende: darle el historial `ScoreHistory`, obtener un
 * `Score` (valor 0-100 + grado + desglose por factor), y aplicar un override.
 * Nada de pesos, curvas de normalización ni bandas de grado en la app.
 */

export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';

export interface PaymentRecord {
  /** Fecha límite de pago (vencimiento). */
  due: string;
  /** Fecha real de pago; null = pendiente/incumplido hasta `asOf`. */
  paid: string | null;
}

export interface PurchaseRecord {
  /** Monto de la compra/despacho. */
  amount: number;
  /** Fecha de la compra. */
  at: string;
}

/** Historial que alimenta el scoring automático. El cliente de estos datos son
 *  los módulos de ventas y cobranza (Fases 3-5); en Fase 2 el historial está
 *  vacío y el módulo devuelve valores neutrales (uso referencial, §2.5). */
export interface ScoreHistory {
  /** Antigüedad del cliente en días (tenure). */
  tenureDays: number;
  /** Pagos del cliente (puntualidad). */
  payments?: PaymentRecord[];
  /** Compras/despachos del cliente (frecuencia + monto). */
  purchases?: PurchaseRecord[];
  /** Fecha de referencia para incumplimientos actuales (default: hoy). */
  asOf?: string;
}

/** Desglose por factor: cada componente en [0,1] (1 = saludable). */
export interface ScoreFactors {
  puntualidad: number;
  frecuencia: number;
  monto: number;
  antiguedad: number;
}

export interface Score {
  value: number;
  grade: Grade;
  factors: ScoreFactors;
  source: 'auto' | 'override';
  override?: ScoreOverride;
}

/** Override manual por supervisor/admin (PRD §2.5: override manual). La
 *  autorización de rol la decide el caller vía permisos (§3.3); este módulo
 *  solo materializa el override auditado. El `grade` se deriva de `value`
 *  automáticamente al aplicar el override. */
export interface ScoreOverride {
  value: number;
  by: string;
  at: string;
  reason: string;
  grade?: Grade;
}

export interface ScoreWeights {
  puntualidad: number;
  frecuencia: number;
  monto: number;
  antiguedad: number;
}

/** Pesos por defecto del scoring (balance PRD §2.5; calibrables por tests). */
export const DEFAULT_WEIGHTS: ScoreWeights = {
  puntualidad: 0.4,
  frecuencia: 0.2,
  monto: 0.2,
  antiguedad: 0.2,
};

/** Ventana de recencia para monto/frecuencia (días). */
export const RECENCY_DAYS = 90;

/** Objetivo de compras en `RECENCY_DAYS` para puntaje completo de frecuencia. */
export const FREQUENCY_TARGET = 8;

/** Umbral de antigüedad en días para puntaje completo. */
export const MATURITY_DAYS = 365;

/** Bandas de grado (uso referencial): A ≥85, B ≥70, C ≥55, D ≥40, E <40. */
export function gradeFor(value: number): Grade {
  if (value >= 85) return 'A';
  if (value >= 70) return 'B';
  if (value >= 55) return 'C';
  if (value >= 40) return 'D';
  return 'E';
}

/** Indexador neutral por defecto: sin historial no se castiga al cliente,
 *  pero tampoco se premia (uso referencial sobre datos futuros de ventas/cobro). */
const NEUTRAL = 0.5;

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Puntualidad (0-1): proporción de pagos a tiempo sobre pagos con vencimiento
 *  evaluado; los incumplidos hasta `asOf` cuentan como negativos. Sin pagos
 *  con vencimiento → neutral. */
function factorPuntualidad(payments: PaymentRecord[], asOf: string): number {
  const withDue = payments.filter((p) => p.due);
  if (withDue.length === 0) return NEUTRAL;

  let onTime = 0;
  let violations = 0;
  for (const p of withDue) {
    if (p.paid !== null && p.paid !== '' && p.paid <= p.due) {
      onTime += 1;
    } else if (p.due <= asOf) {
      violations += 1;
    } else {
      // Aún no vence: no se evalúa.
      onTime += 0;
      violations += 0;
    }
  }
  const evaluated = onTime + violations;
  if (evaluated === 0) return NEUTRAL;
  return clamp01(onTime / evaluated);
}

/** Frecuencia (0-1): compras en la ventana `RECENCY_DAYS` hacia el objetivo. */
function factorFrecuencia(purchases: PurchaseRecord[], asOf: string): number {
  if (!purchases || purchases.length === 0) return 0;
  const since = new Date(Date.parse(asOf) - RECENCY_DAYS * 86_400_000).toISOString();
  let count = 0;
  let total = 0;
  for (const p of purchases) {
    total += 1;
    if (Date.parse(p.at) >= Date.parse(since)) count += 1;
  }
  if (total === 0) return NEUTRAL;
  return clamp01(count / FREQUENCY_TARGET);
}

/** Monto (0-1): promedio de compra normalizado contra un target razonable de
 *  ticket del negocio (por defecto valor de 1 bolsa/pack en ~USD, PRD §2.5);
 *  satura en un techo para no sesgar por outliers. */
function factorMonto(purchases: PurchaseRecord[], targetTicketUsd = 100): number {
  if (!purchases || purchases.length === 0) return NEUTRAL;
  let sum = 0;
  let n = 0;
  for (const p of purchases) {
    if (Number.isFinite(p.amount)) {
      sum += p.amount;
      n += 1;
    }
  }
  if (n === 0) return NEUTRAL;
  const avg = sum / n;
  // Curva de saturación: ticket medio == target → 0.5; el doble no puntúa el
  // doble (0.67), y se acerca a 1 sin nunca sesgar por outliers muy altos.
  return clamp01(avg / (avg + targetTicketUsd));
}

/** Antigüedad (0-1): el tenure madura linealmente hasta `MATURITY_DAYS`. */
function factorAntiguedad(tenureDays: number): number {
  if (tenureDays <= 0) return NEUTRAL;
  return clamp01(tenureDays / MATURITY_DAYS);
}

/** Computa el scoring automático de un cliente a partir de su historial. */
export function computeScore(
  history: ScoreHistory,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): Score {
  const asOf = history.asOf ?? new Date().toISOString();
  const factors: ScoreFactors = {
    puntualidad: factorPuntualidad(history.payments ?? [], asOf),
    frecuencia: factorFrecuencia(history.purchases ?? [], asOf),
    monto: factorMonto(history.purchases ?? []),
    antiguedad: factorAntiguedad(history.tenureDays),
  };
  const value = Math.round(
    100 *
      (weights.puntualidad * factors.puntualidad +
        weights.frecuencia * factors.frecuencia +
        weights.monto * factors.monto +
        weights.antiguedad * factors.antiguedad),
  );
  return { value, grade: gradeFor(value), factors, source: 'auto' };
}

/** Aplica un override manual (supervisor/admin, §2.5/§3.3) con auditoría:
 *  conserva el score automático en `factors`, pero el `value`/`grade` pasan a
 *  ser los manuales y `source` queda en 'override'. El grado del override se
 *  deriva de su valor, nunca se confía en él como input. */
export function applyOverride(score: Score, override: ScoreOverride): Score {
  const grade = gradeFor(override.value);
  return {
    value: override.value,
    grade,
    factors: score.factors,
    source: 'override',
    override: { ...override, grade },
  };
}
