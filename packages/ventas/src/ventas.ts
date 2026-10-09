import { ulid } from 'ulidx';
import type {
  Cliente,
  Condicion,
  Despacho,
  DespachoEstado,
  DespachoItem,
  Item,
  Role,
} from '@brian/shared';

/**
 * Módulo profundo de ventas / despachos (PRD §2.2, §2.6, §3.2, §3.3).
 *
 * Detrás de una interfaz pequeña (crearDespacho / editarDespachoPendiente /
 * entregarDespacho / eliminarDespachoPendiente / creditoBloqueado / precioItem)
 * concentra toda la lógica de una venta toma-pedido→entrega:
 *   - Precio por condición (crédito/contado); el canal mayor/detal se retiró.
 *   - Cálculo de subtotal/total; la tasa BCV solo se snapshot cuando existe
 *     (para registrar pagos), no cierra la venta.
 *   - Descuento con aprobación (admin 1 paso / supervisor 2 pasos, §3.3).
 *   - Ciclo de vida: pedido → entregado (inmutable, §2.6); solo el pedido no
 *     entregado se edita o elimina (delete_dispatch_pending).
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

/** Selecciona el precio de catálogo según la condición (crédito/contado, §2.2). */
export function precioItem(item: Item, condicion: Condicion): number {
  return condicion === 'credito' ? item.precio_credito : item.precio_contado;
}

export interface DespachoLineaInput {
  item: Item;
  cantidad: number;
}

/** Descuento con aprobación (§3.3): solo UNO de `pct` o `monto_usd` se entrega. */
export interface DescuentoAprobado {
  /** Modo porcentaje: 0 < pct ≤ 100. */
  pct?: number;
  /** Modo monto fijo en USD: 0 < monto_usd ≤ subtotal. */
  monto_usd?: number;
  aprobado_por: string;
  pasos: number;
}

/** Recargo por mora de una venta a crédito: solo UNO de `pct` o `monto_usd`. */
export interface RecargoMora {
  /** Modo porcentaje sobre el subtotal: 0 < pct ≤ 100. */
  pct?: number;
  /** Modo monto fijo en USD: 0 < monto_usd ≤ subtotal. */
  monto_usd?: number;
}

export interface CrearDespachoInput {
  cliente: Cliente;
  condicion: Condicion;
  lineas: DespachoLineaInput[];
  /** Tasa BCV (Bs/USD) vigente al registrar; 0/omitida si aún no hay (§2.6). */
  tasa_bcv?: number;
  /** Descuento con aprobación (§3.3): porcentaje o monto fijo en USD. */
  descuento?: DescuentoAprobado;
  /** Recargo por mora (solo crédito, §recargo): % sobre subtotal o monto fijo. */
  mora?: RecargoMora;
  /** IVA (%) sobre la base con recargo; 0 = sin IVA. */
  iva_pct?: number;
  /** Quien toma el pedido (creador). */
  vendedor: string;
  /** Promotor que captó al cliente (nombre del roster `personal`); se elige al
   *  registrar la venta (auto si quien registra es promotor). */
  promotor?: string | null;
  /** Supervisor a cargo (nombre del roster `personal` o identidad de quien
   *  registra si es supervisor). Solo él (o admin) gestiona el pedido. */
  supervisor?: string | null;
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
  input: Pick<CrearDespachoInput, 'lineas' | 'condicion'>,
): { lineas: DespachoItem[]; subtotal: number } {
  const lineas: DespachoItem[] = [];
  let subtotal = 0;
  for (const linea of input.lineas) {
    if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) {
      throw new Error('Cantidad por línea debe ser un entero positivo.');
    }
    const precio = precioItem(linea.item, input.condicion);
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

/** Descuento resuelto: monto en USD y metadatos de aprobación (§3.3). */
interface DescuentoResuelto {
  monto: number;
  pct: number;
  aprobadoPor: string | null;
  pasos: number | null;
}

/** Recargo por mora resuelto (solo crédito) + IVA en %. */
interface RecargoResuelto {
  monto: number;
  pct: number;
  iva: number;
}

/** Valida líneas, descuento (% o monto USD) y tasa opcional; devuelve {lineas, subtotal, tasa, d}. */
function validarEntrada(
  input: Pick<CrearDespachoInput, 'lineas' | 'condicion' | 'descuento' | 'tasa_bcv' | 'mora' | 'iva_pct'>,
): { lineas: DespachoItem[]; subtotal: number; tasa: number; d: DescuentoResuelto; rec: RecargoResuelto } {
  if (!input.lineas || input.lineas.length === 0) {
    throw new Error('Un despacho requiere al menos una línea de ítem.');
  }
  const tasa = input.tasa_bcv ?? 0;
  if (!Number.isFinite(tasa) || tasa < 0) {
    throw new Error('La tasa BCV del despacho no puede ser negativa.');
  }
  const { lineas, subtotal } = buildLineas(input);

  const desc = input.descuento;
  const pct = desc?.pct ?? 0;
  const monto = desc?.monto_usd ?? 0;
  if (pct > 0 && monto > 0) {
    throw new Error('Elige un solo tipo de descuento: porcentaje o monto fijo en USD (§3.3).');
  }
  const activo = pct > 0 || monto > 0;
  if (activo) {
    if (!desc?.aprobado_por) {
      throw new Error('Descuento requiere aprobación del descuento (§3.3).');
    }
    if (!desc?.pasos || desc.pasos < 1 || desc.pasos > 2) {
      throw new Error('La aprobación de descuento debe tener 1 ó 2 pasos.');
    }
  }
  if (pct < 0 || pct > 100) {
    throw new Error('El porcentaje de descuento debe estar entre 0 y 100.');
  }
  if (monto < 0) {
    throw new Error('El monto de descuento no puede ser negativo.');
  }
  if (monto > subtotal) {
    throw new Error('El monto de descuento no puede superar el subtotal del despacho.');
  }

  const descuentoMonto = pct > 0 ? round2(subtotal * (pct / 100)) : monto > 0 ? round2(monto) : 0;

  /* Recargo por mora (solo crédito) e IVA. */
  const mora = input.mora;
  const moraPct = mora?.pct ?? 0;
  const moraMonto = mora?.monto_usd ?? 0;
  if (input.condicion !== 'credito' && (moraPct > 0 || moraMonto > 0)) {
    throw new Error('El recargo por mora solo aplica a ventas a crédito.');
  }
  if (moraPct > 0 && moraMonto > 0) {
    throw new Error('Elige un solo tipo de recargo por mora: porcentaje o monto fijo en USD.');
  }
  if (moraPct < 0 || moraPct > 100) {
    throw new Error('El porcentaje de recargo por mora debe estar entre 0 y 100.');
  }
  if (moraMonto < 0) {
    throw new Error('El monto de recargo por mora no puede ser negativo.');
  }
  if (moraMonto > subtotal) {
    throw new Error('El monto de recargo por mora no puede superar el subtotal del despacho.');
  }
  const moraMontoCalculado =
    moraPct > 0 ? round2(subtotal * (moraPct / 100)) : moraMonto > 0 ? round2(moraMonto) : 0;

  const iva = input.iva_pct ?? 0;
  if (iva < 0 || iva > 100) {
    throw new Error('El porcentaje de IVA debe estar entre 0 y 100.');
  }

  return {
    lineas,
    subtotal,
    tasa,
    d: {
      monto: descuentoMonto,
      pct,
      aprobadoPor: activo ? desc!.aprobado_por : null,
      pasos: activo ? desc!.pasos : null,
    },
    rec: { monto: moraMontoCalculado, pct: moraPct, iva },
  };
}

/**
 * Crea un despacho (pedido tomado por el promotor, PRD §2.2): valida líneas y
 * resuelve el subtotal/cantidades con el precio de catálogo por condición,
 * aplica el descuento aprobado (admin 1 paso / supervisor 2, §3.3) y toma
 * snapshot de la tasa BCV si la hay (para registrar pagos; no cierra la venta).
 * Estado inicial: `pedido`.
 */
export function crearDespacho(input: CrearDespachoInput): Despacho {
  const { lineas, subtotal, tasa, d, rec } = validarEntrada(input);
  const base = round2(subtotal - d.monto);
  const ivaMonto = rec.iva > 0 ? round2((base + rec.monto) * (rec.iva / 100)) : 0;
  const total = round2(base + rec.monto + ivaMonto);

  const clock = input.clock ?? realClock;
  const now = clock.now();
  const id = clock.newId();
  const nro = `${input.nro_prefijo ?? 'D-'}${id.slice(0, 8).toUpperCase()}`.toUpperCase();

  return {
    id,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    nro_control: nro,
    cliente_id: input.cliente.id,
    cliente_nombre: input.cliente.nombre,
    condicion: input.condicion,
    lineas,
    subtotal,
    tasa_bcv: tasa,
    total,
    estado: 'pedido',
    descuento_pct: d.pct,
    descuento_monto_usd: d.pct === 0 && d.monto > 0 ? d.monto : null,
    descuento_aprobado_por: d.aprobadoPor,
    descuento_pasos: d.pasos,
    mora_pct: rec.pct,
    mora_monto_usd: rec.pct === 0 && rec.monto > 0 ? round2(rec.monto) : null,
    mora_total_usd: round2(rec.monto),
    iva_pct: rec.iva,
    iva_total_usd: ivaMonto,
    promotor: input.promotor?.trim() || null,
    supervisor: input.supervisor?.trim() || null,
    created_by: input.vendedor,
    updated_by: input.vendedor,
    editor_role: input.editor_role,
    entregado_at: null,
    entregado_por: null,
  };
}

export interface EditarDespachoInput {
  /** Cliente cambiado (opcional; por defecto conserva el del despacho). */
  cliente?: Cliente;
  condicion: Condicion;
  lineas: DespachoLineaInput[];
  tasa_bcv?: number;
  descuento?: DescuentoAprobado;
  /** Recargo por mora (solo crédito, §recargo): % sobre subtotal o monto fijo. */
  mora?: RecargoMora;
  /** IVA (%) sobre la base con recargo; 0 = sin IVA. */
  iva_pct?: number;
  /** Quien edita (auditoría updated_by). */
  editor: string;
  editor_role: Role;
  clock?: VentaClock;
}

/**
 * Edita un despacho SOLO en estado `pedido` (el entregado es inmutable, §2.6):
 * recalcula líneas, subtotal, descuento aprobado y total con la misma regla de
 * precios por condición. El caller (admin) valida el permiso antes de llamar.
 */
export function editarDespachoPendiente(
  prev: Despacho,
  input: EditarDespachoInput,
): Despacho {
  if (prev.estado !== 'pedido') {
    throw new Error(`Solo un despacho en 'pedido' puede editarse (estado actual: ${prev.estado}).`);
  }
  const { lineas, subtotal, tasa, d, rec } = validarEntrada(input);
  const base = round2(subtotal - d.monto);
  const ivaMonto = rec.iva > 0 ? round2((base + rec.monto) * (rec.iva / 100)) : 0;
  const total = round2(base + rec.monto + ivaMonto);
  const now = (input.clock ?? realClock).now();

  return {
    ...prev,
    updated_at: now,
    updated_by: input.editor,
    editor_role: input.editor_role,
    cliente_id: input.cliente?.id ?? prev.cliente_id,
    cliente_nombre: input.cliente?.nombre ?? prev.cliente_nombre,
    condicion: input.condicion,
    lineas,
    subtotal,
    tasa_bcv: tasa,
    total,
    descuento_pct: d.pct,
    descuento_monto_usd: d.pct === 0 && d.monto > 0 ? d.monto : null,
    descuento_aprobado_por: d.aprobadoPor,
    descuento_pasos: d.pasos,
    mora_pct: rec.pct,
    mora_monto_usd: rec.pct === 0 && rec.monto > 0 ? round2(rec.monto) : null,
    mora_total_usd: round2(rec.monto),
    iva_pct: rec.iva,
    iva_total_usd: ivaMonto,
  };
}

/**
 * Marca el despacho como entregado (supervisor, flujo §2.2): solo desde
 * `pedido`. Tras la entrega el documento es INMUTABLE (§2.6): para revertirlo
 * el admin usa `corregirDespacho` (entregado → pedido). El caller valida
 * `deliver_dispatch` y la propiedad del registro. `entregado_por` es la
 * identidad registrada del supervisor que marca la entrega (§3.1).
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
    entregado_por,
  };
}

/**
 * ¿Puede `editor` (rol + identidad) gestionar un despacho? Regla de propiedad
 * (§3.3): el admin gestiona todo; un supervisor solo sus propios registros
 * (los que está a cargo); un promotor solo el pedido que tomó. `editor` es la
 * identidad operativa (nombre del roster si está, si no el email); `editor_email`
 * es la sesión (para comparar `created_by`).
 */
export function puedeGestionarDespacho(
  despacho: Despacho,
  editor: string,
  editor_email: string,
  editor_role: Role,
): boolean {
  if (editor_role === 'admin') return true;
  if (despacho.supervisor && (despacho.supervisor === editor || despacho.supervisor === editor_email)) {
    return true;
  }
  if (despacho.created_by === editor_email) return true;
  return false;
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

export interface CorregirDespachoInput {
  /** Estado destino. Solo el admin corrige (la UI valida el rol). */
  estado?: DespachoEstado;
  /** Promotor que captó al cliente (nombre del roster `personal`). */
  promotor?: string | null;
  /** Quién entregó el pedido (obligatorio al pasar a `entregado`). */
  entregado_por?: string | null;
  /** Quien corrige (auditoría updated_by). */
  editor: string;
  /** Rol del editor → prioridad por rol en conflictos críticos (§5.1). */
  editor_role: Role;
  clock?: VentaClock;
}

/**
 * Corrección admin de un despacho (marcó uno como entregado por error, §2.6):
 * cambia estado con auditoría y reasigna `promotor`/`entregado_por` desde el
 * roster `personal`. Reglas: entregado exige quién entregó (desde `pedido`);
 * volver a `pedido` limpia los campos de entrega; `anulado` desde pedido o
 * entregado. No toca línea/totales (eso es `editarDespachoPendiente`).
 */
export function corregirDespacho(
  prev: Despacho,
  input: CorregirDespachoInput,
): Despacho {
  const clock = input.clock ?? realClock;
  const now = clock.now();
  const estadoObjetivo = input.estado ?? prev.estado;

  let base: Despacho = {
    ...prev,
    updated_at: now,
    updated_by: input.editor,
    editor_role: input.editor_role,
  };

  if (estadoObjetivo === 'entregado') {
    if (prev.estado !== 'pedido') {
      throw new Error(
        `Para marcar como entregado el despacho debe estar en 'pedido' (estado actual: ${prev.estado}).`,
      );
    }
    const quien = input.entregado_por?.trim();
    if (!quien) {
      throw new Error('Para marcar como entregado indica quién entregó el pedido.');
    }
    base = {
      ...base,
      estado: 'entregado',
      entregado_at: now,
      entregado_por: quien,
    };
  } else if (estadoObjetivo === 'pedido') {
    base = {
      ...base,
      estado: 'pedido',
      entregado_at: null,
      entregado_por: null,
    };
  } else if (estadoObjetivo === 'anulado') {
    if (prev.estado === 'anulado') {
      throw new Error('El despacho ya está anulado.');
    }
    base = { ...base, estado: 'anulado' };
  }

  if (input.entregado_por !== undefined && estadoObjetivo !== 'entregado') {
    base = { ...base, entregado_por: input.entregado_por?.trim() || null };
  }
  if (input.promotor !== undefined) {
    base = { ...base, promotor: input.promotor?.trim() || null };
  }

  return base;
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