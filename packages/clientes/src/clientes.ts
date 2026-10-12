import { ulid } from 'ulidx';
import type { Cliente, Zona } from '@brian/shared';
import { DEFAULT_CREDITO_DIAS, DEFAULT_CREDITO_LIMITE } from '@brian/shared';
import { computeScore, gradeFor, type ScoreHistory } from '@brian/scoring';
import type { Consentimiento } from '@brian/shared';

/** Contexto de reloj/ids inyectable (el módulo nunca genera tiempo por sí mismo). */
export interface ClienteClock {
  now(): string;
  newId(): string;
}

const realClock: ClienteClock = {
  now: () => new Date().toISOString(),
  newId: () => ulid(),
};

/** Geo del cliente: coordenadas y/o Plus Code (PRD §8.5). */
export interface GeoRef {
  lat?: number | null;
  lng?: number | null;
  plus_code?: string;
}

export interface NuevoClienteInput {
  nombre: string;
  documento?: string;
  telefono?: string;
  telefono2?: string;
  notas_referencia?: string;
  direccion?: string;
  geo?: GeoRef;
  /** Fotos comprimidas (data URL JPEG): fachada, cliente y cédula (§8.6). */
  foto_fachada?: string;
  foto_cliente?: string;
  foto_cedula?: string;
  consentimiento: Consentimiento;
  creator: string;
}

export interface EditarClientePatch {
  nombre?: string;
  documento?: string;
  telefono?: string;
  telefono2?: string;
  notas_referencia?: string;
  direccion?: string;
  geo?: GeoRef;
  foto_fachada?: string;
  foto_cliente?: string;
  foto_cedula?: string;
  consentimiento?: Consentimiento;
  editor: string;
}

/** Radio máximo en km para asignar zona por cercanía (haversine). */
export const ZONA_RADIO_KM = 10;

/** Distancia haversine (km) entre dos puntos. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Plus Code normalizado (sin el sufijo de ciudad largo). */
function normalizePlusCode(code: string): string {
  return code.replace(/\s+/g, '').toUpperCase();
}

/**
 * Asigna la zona del cliente: match por prefijo de Plus Code si ambos lo tienen
 * y coincide; si no, la zona más cercana por haversine dentro de `ZONA_RADIO_KM`.
 * Devuelve la zona o null si no hay match (PRD §2.8 módulo 3, geolocalización).
 */
export function matchZona(geo: GeoRef | undefined, zonas: Zona[]): Zona | null {
  if (!geo) return null;
  const active = zonas.filter((z) => z.lat !== null && z.lng !== null);

  if (geo.plus_code) {
    const code = normalizePlusCode(geo.plus_code);
    const byPrefix = active.filter(
      (z) => z.plus_code && code.startsWith(normalizePlusCode(z.plus_code)),
    );
    if (byPrefix.length > 0) {
      return (
        byPrefix.sort(
          (a, b) =>
            normalizePlusCode(b.plus_code ?? '').length -
            normalizePlusCode(a.plus_code ?? '').length,
        )[0] ?? null
      );
    }
  }

  if (geo.lat != null && geo.lng != null) {
    const sorted = active
      .map((z) => ({
        zona: z,
        d: haversineKm({ lat: geo.lat!, lng: geo.lng! }, { lat: z.lat!, lng: z.lng! }),
      }))
      .sort((a, b) => a.d - b.d);
    const nearest = sorted[0];
    if (nearest && nearest.d <= ZONA_RADIO_KM) return nearest.zona;
    return null;
  }

  return null;
}

/**
 * Crea un cliente nuevo (PRD §2.5 + §3.5): requiere consentimiento informado
 * registrado, crédito por defecto (1 bolsa/pack, 15 días) y asigna la zona por
 * geolocalización. Auditoría: `created_by`/`updated_by` con el editor.
 */
export function crearCliente(
  input: NuevoClienteInput,
  zonas: Zona[],
  clock: ClienteClock = realClock,
): Cliente {
  if (!input.consentimiento?.fecha) {
    throw new Error('Consentimiento informado obligatorio al crear cliente (§3.5).');
  }
  const now = clock.now();
  const zona = matchZona(input.geo, zonas);
  return {
    id: clock.newId(),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    nombre: input.nombre.trim(),
    documento: input.documento?.trim() || undefined,
    telefono: input.telefono?.trim() || undefined,
    telefono2: input.telefono2?.trim() || undefined,
    notas_referencia: input.notas_referencia?.trim() || undefined,
    direccion: input.direccion?.trim() || undefined,
    lat: input.geo?.lat ?? null,
    lng: input.geo?.lng ?? null,
    plus_code: input.geo?.plus_code || undefined,
    zona_id: zona?.id ?? null,
    consentimiento: input.consentimiento,
    foto_fachada: input.foto_fachada,
    foto_cliente: input.foto_cliente,
    foto_cedula: input.foto_cedula,
    credito_limite: DEFAULT_CREDITO_LIMITE,
    credito_dias: DEFAULT_CREDITO_DIAS,
    /* Score inicial referencial: D (sin historial de pagos ni compras aún). El
     * recálculo automático ocurre con cada venta (§2.5) y el override respeta. */
    score: 40,
    score_override: null,
    score_grado: 'D',
    created_by: input.creator,
    updated_by: input.creator,
  };
}

/**
 * Edita un cliente: si cambia la dirección/geo, la zona se reasigna de forma
 * automática (PRD §3.3: "Reasignación de zona: automática al editar dirección
 * del cliente"). Conserva el score; el override/score lo manejan otros pasos.
 */
export function editarCliente(
  prev: Cliente,
  patch: EditarClientePatch,
  zonas: Zona[],
  clock: ClienteClock = realClock,
): Cliente {
  // Si cambia la dirección/geo, PRD §3.3 reasigna la zona automáticamente.
  // Sin geo nuevo no hay punto que matchear: se conserva la zona actual.
  const zona = patch.geo !== undefined ? matchZona(patch.geo, zonas) : undefined;
  const zonaId = patch.geo !== undefined ? (zona?.id ?? null) : (prev.zona_id ?? null);

  return {
    ...prev,
    updated_at: clock.now(),
    updated_by: patch.editor,
    nombre: patch.nombre?.trim() || prev.nombre,
    documento: patch.documento !== undefined ? patch.documento.trim() || undefined : prev.documento,
    telefono: patch.telefono !== undefined ? patch.telefono.trim() || undefined : prev.telefono,
    telefono2: patch.telefono2 !== undefined ? patch.telefono2.trim() || undefined : prev.telefono2,
    notas_referencia:
      patch.notas_referencia !== undefined
        ? patch.notas_referencia.trim() || undefined
        : prev.notas_referencia,
    direccion: patch.direccion !== undefined ? patch.direccion.trim() || undefined : prev.direccion,
    lat: patch.geo?.lat !== undefined ? patch.geo.lat : prev.lat,
    lng: patch.geo?.lng !== undefined ? patch.geo.lng : prev.lng,
    plus_code:
      patch.geo?.plus_code !== undefined ? patch.geo.plus_code || undefined : prev.plus_code,
    zona_id: zonaId,
    consentimiento: patch.consentimiento ?? prev.consentimiento,
    foto_fachada: patch.foto_fachada !== undefined ? patch.foto_fachada : prev.foto_fachada,
    foto_cliente: patch.foto_cliente !== undefined ? patch.foto_cliente : prev.foto_cliente,
    foto_cedula: patch.foto_cedula !== undefined ? patch.foto_cedula : prev.foto_cedula,
  };
}

/** Calcula el score automático del cliente (PRD §2.5: 4 factores) y lo encaja
 *  en el registro (valor + grado). El historial llega de ventas/CxC (Fases 3-5);
 *  en Fase 2 suele estar vacío → score referencial bajo. */
export function aplicarScore(
  cliente: Cliente,
  historial: ScoreHistory,
  clock: ClienteClock = realClock,
): Cliente {
  const s = computeScore(historial);
  return {
    ...cliente,
    updated_at: clock.now(),
    score: s.value,
    score_grado: s.grade,
  };
}

export interface ScoreOverrideInput {
  value: number;
  autorizado_por: string;
}

/**
 * Aplica un override manual de score (§2.5: solo supervisor/admin). La
 * autorización de rol la valida el caller con hasPermission('edit_client');
 * aquí se materializa y audita el override (updated_by + updated_at).
 */
export function aplicarOverride(
  cliente: Cliente,
  override: ScoreOverrideInput,
  clock: ClienteClock = realClock,
): Cliente {
  if (!Number.isInteger(override.value) || override.value < 0 || override.value > 100) {
    throw new Error('Valor del score debe ser entero entre 0 y 100.');
  }
  const grade = gradeFor(override.value);
  return {
    ...cliente,
    updated_at: clock.now(),
    updated_by: override.autorizado_por,
    score: override.value,
    score_grado: grade,
    score_override: override.value,
  };
}

export { gradeFor };
