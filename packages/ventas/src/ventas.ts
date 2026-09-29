import { ulid } from 'ulidx';
import type {
  Canal,
  Cliente,
  Condicion,
  Despacho,
  DespachoItem,
  Item,
  Role,
} from '@brian/shared';

/**
 * Módulo profundo de ventas / despachos (PRD §2.2, §2.6, §3.2, §3.3).
 *
 * Detrás de una interfaz pequeña (crearDespacho / entregarDespacho /
 * eliminarDespachoPendiente / creditoBloqueado / precioItem) concentra toda la
 * lógica de una venta toma-pedido→entrega:
 *   - Precios por condición (crédito/contado) × canal (mayor/detal).
 *   - Cálculo de subtotal/total con tasa BCV snapshot (modelado facturación).
 *   - Descuento con aprobación (admin 1 paso / supervisor 2 pasos, §3.3).
 *   - Ciclo de vida: pedido → entregado (inmutable, §2.6); solo el pedido no
 *     entregado se elimina (delete_dispatch_pending).
 *   - Indicador "crédito bloqueado" SIN montos para promotor (§2.2/§3.2).
 * La autorización de permisos la decide el caller (UI) vía hasPermission; este
 * módulo materializa las decisiones de negocio y audita (created_by/updated_by,
 * editor_role para conflicto crítico §5.1).
 */

/** Contexto de reloj/ids inyectable (el módulo nunca genera tiempo por sí mismo). */
export interface VentaClock {
  now(): string;
  newId(): string;
}

const realClock: VentaClock = {
  now: () => new Date().toISOString(),
  newId: () => ulid(),
};

/** Selecciona el precio de catálogo según condición y canal (PRD §2.2). */
export function precioItem(item: Item, condicion: Condicion, canal: Canal): number {
  if (condicion === 'credito') {
    return canal === 'mayor' ? item.precio_credito_mayor : item.precio_credito_detal;
  }
  return canal === 'mayor' ? item.precio_contado_mayor : item.precio_contado_detal;
}

export interface DespachoLineaInput {
  item: Item;
  cantidad: number;
}

export interface CrearDespachoInput {
  cliente: Cliente;
  condicion: Condicion;
  canal: Canal;
  lineas: DespachoLineaInput[];
  tasa_bcv: number;
  /** Descuento con aprobación (§3.3): si pct > 0, exige aprobador + pasos. */
  descuento?: { pct: number; aprobado_por: string; pasos: number };
  /** Quien toma el pedido (creador). */
  vendedor: string;
  /** Rol del editor → prioridad por rol en conflictos críticos (§5.1). */
  editor_role: Role;
  /** Prefijo del nº de control del comprobante (modelado facturación §2.6). */
  nro_prefijo?: string;
  clock?: VentaClock;
}

/** Redondeo monetario a 2 decimales (sensible a moneda, no a floats binarios). */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildLineas(
  input: CrearDespachoInput,
): { lineas: DespachoItem[]; subtotal: number } {
  const lineas: DespachoItem[] = [];
  let subtotal = 0;
  for (const linea of input.lineas) {
    if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) {
      throw new Error('Cantidad por línea debe ser un entero positivo.');
    }
    const precio = precioItem(linea.item, input.condicion, input.canal);
    const total = round2(linea.cantidad * precio);
    lineas.push({
      item_id: linea.item.id,
      nombre: linea.item.nombre,
      cantidad: linea.cantidad,
      precio_unitario: precio,
    });
    subtotal = round2(subtotal + total);
  }
  return { lineas, subtotal };
}

/**
 * Crea un despacho (pedido tomado por el promotor, PRD §2.2): valida líneas y
 * tasa, calcula subtotal con el precio de catálogo por condición/canal, aplica
 * el descuento aprobado (admin 1 paso / supervisor 2, §3.3) y toma snapshot de
 * la tasa BCV. Estado inicial: `pedido`.
 */
export function crearDespacho(input: CrearDespachoInput): Despacho {
  if (!input.lineas || input.lineas.length === 0) {
    throw new Error('Un despacho requiere al menos una línea de ítem.');
  }
  if (!Number.isFinite(input.tasa_bcv) || input.tasa_bcv <= 0) {
    throw new Error('La tasa BCV del despacho debe ser positiva (snapshot §2.6).');
  }
  const pct = input.descuento?.pct ?? 0;
  if (pct > 0) {
    if (!input.descuento?.aprobado_por) {
      throw new Error('Descuento requiere aprobación del descuento (§3.3).');
    }
    if (!input.descuento?.pasos || input.descuento.pasos < 1 || input.descuento.pasos > 2) {
      throw new Error('La aprobación de descuento debe tener 1 ó 2 pasos.');
    }
  }
  if (pct < 0 || pct > 100) {
    throw new Error('El porcentaje de descuento debe estar entre 0 y 100.');
  }

  const clock = input.clock ?? realClock;
  const now = clock.now();
  const id = clock.newId();
  const nro = `${input.nro_prefijo ?? 'D-'}${id.slice(0, 8).toUpperCase()}`.toUpperCase();

  const { lineas, subtotal } = buildLineas(input);
  const descuentoMonto = pct > 0 ? round2(subtotal * (pct / 100)) : 0;
  const total = round2(subtotal - descuentoMonto);

  return {
    id,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    nro_control: nro,
    cliente_id: input.cliente.id,
    cliente_nombre: input.cliente.nombre,
    condicion: input.condicion,
    canal: input.canal,
    lineas,
    subtotal,
    tasa_bcv: input.tasa_bcv,
    total,
    estado: 'pedido',
    descuento_pct: pct,
    descuento_aprobado_por: pct > 0 ? input.descuento!.aprobado_por : null,
    descuento_pasos: pct > 0 ? input.descuento!.pasos : null,
    created_by: input.vendedor,
    updated_by: input.vendedor,
    editor_role: input.editor_role,
    entregado_at: null,
  };
}

/**
 * Marca el despacho como entregado (supervisor, flujo §2.2): solo desde
 * `pedido`. Tras la entrega el documento es INMUTABLE (§2.6): para revertir
 * hace falta una nota de crédito (Fase 4). El caller valida `deliver_dispatch`.
 */
export function entregarDespacho(
  prev: Despacho,
  entregado_por: string,
  editor_role: Role,
  clock: VentaClock = realClock,
): Despacho {
  if (prev.estado !== 'pedido') {
    throw new Error(`Solo un despacho en 'pedido' puede entregarse (estado actual: ${prev.estado}).`);
  }
  const now = clock.now();
  return {
    ...prev,
    updated_at: now,
    updated_by: entregado_por,
    editor_role,
    estado: 'entregado',
    entregado_at: now,
  };
}

/**
 * Elimina (soft delete) un despacho NO entregado (PRD §3.3: Admin, Supervisor,
 * Promotor). El caller valida `delete_dispatch_pending`. Un despacho entregado
 * es inmutable y no se elimina; se revierte con nota de crédito (Fase 4).
 */
export function eliminarDespachoPendiente(
  prev: Despacho,
  editor: string,
  clock: VentaClock = realClock,
): Despacho {
  if (prev.estado !== 'pedido') {
    throw new Error(`Solo un despacho en 'pedido' puede eliminarse (estado actual: ${prev.estado}).`);
  }
  const now = clock.now();
  return {
    ...prev,
    updated_at: now,
    updated_by: editor,
    deleted_at: now,
  };
}

/**
 * Indicador de "crédito bloqueado" para el promotor al tomar pedidos a crédito
 * (§2.2/§3.2). Devuelve SOLO un booleano (el promotor no ve montos ni saldos).
 * Regla (Fase 3, sin CxC aún): un cliente queda bloqueado si sus despachos a
 * crédito abiertos consumen su `credito_limite` (1 bolsa/pack por defecto, §2.5)
 * o si su scoring referencial está en banda mala (D/E) con crédito en uso.
 */
export function creditoBloqueado(
  cliente: Cliente,
  despachosAbiertos: Despacho[],
): boolean {
  const { unidades } = creditoUsado(cliente, despachosAbiertos);
  if (unidades > 0) {
    // Fase 3: existe crédito en uso; el scoring referencial decide la bandera.
    if (cliente.score_grado === 'D' || cliente.score_grado === 'E') return true;
  }
  return false;
}

export interface CreditoUsado {
  unidades: number;
  limite: number;
}

/**
 * Consumo de crédito en unidades de bolsa/pack (sin montos) para los roles que
 * sí ven saldos. No lo usa el promotor: la UX solo consume `creditoBloqueado`.
 */
export function creditoUsado(
  cliente: Cliente,
  despachosAbiertos: Despacho[],
): CreditoUsado {
  const abiertos = despachosAbiertos.filter(
    (d) =>
      d.condicion === 'credito' &&
      d.estado !== 'anulado' &&
      (d.deleted_at === null || d.deleted_at === undefined),
  );
  const unidades = abiertos.reduce((acc, d) => acc + d.lineas.reduce((a, l) => a + l.cantidad, 0), 0);
  return { unidades, limite: cliente.credito_limite };
}