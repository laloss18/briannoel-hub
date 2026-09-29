import { describe, expect, it } from 'vitest';
import type { Cliente, Despacho, Item } from '@brian/shared';
import {
  creditoBloqueado,
  creditoUsado,
  crearDespacho,
  eliminarDespachoPendiente,
  entregarDespacho,
  precioItem,
  type CrearDespachoInput,
} from '../src';

const T0 = '2024-06-01T00:00:00.000Z';

const ITEM: Item = {
  id: '01J0ZEV05QJ33W41PGGZG7XD6A',
  created_at: T0,
  updated_at: T0,
  deleted_at: null,
  nombre: 'Bolsa Harina PAN 1kg',
  precio_credito_mayor: 2.5,
  precio_credito_detal: 3.0,
  precio_contado_mayor: 2.2,
  precio_contado_detal: 2.7,
};

const CLIENTE: Cliente = {
  id: '01J0ZEV05QJ33W41PGGZG7XD6B',
  created_at: T0,
  updated_at: T0,
  deleted_at: null,
  nombre: 'Bodega El Centro',
  consentimiento: { fecha: T0, foto_casa: false, foto_documento: false, aviso_documento: false },
  credito_limite: 1,
  credito_dias: 15,
  score: null,
  score_override: null,
  score_grado: null,
  created_by: 'admin@briannoel.com',
  updated_by: 'admin@briannoel.com',
};

function baseInput(overrides: Partial<CrearDespachoInput> = {}): CrearDespachoInput {
  return {
    cliente: CLIENTE,
    condicion: 'credito',
    canal: 'mayor',
    lineas: [{ item: ITEM, cantidad: 2 }],
    tasa_bcv: 36.5,
    vendedor: 'promotor@briannoel.com',
    editor_role: 'promotor',
    ...overrides,
  };
}

function despachoBase(overrides: Partial<Despacho> = {}): Despacho {
  return {
    id: '01J0ZEV05QJ33W41PGGZG7XD6C',
    created_at: T0,
    updated_at: T0,
    deleted_at: null,
    nro_control: 'D-01J0ZEV0',
    cliente_id: CLIENTE.id,
    cliente_nombre: CLIENTE.nombre,
    condicion: 'credito',
    canal: 'mayor',
    lineas: [{ item_id: ITEM.id, nombre: ITEM.nombre, cantidad: 1, precio_unitario: 2.5 }],
    subtotal: 2.5,
    tasa_bcv: 36.5,
    total: 2.5,
    estado: 'pedido',
    descuento_pct: 0,
    descuento_aprobado_por: null,
    descuento_pasos: null,
    created_by: 'promotor@briannoel.com',
    updated_by: 'promotor@briannoel.com',
    editor_role: 'promotor',
    entregado_at: null,
    ...overrides,
  };
}

describe('precioItem (condición × canal, PRD §2.2)', () => {
  it('selecciona el precio de catálogo por condición y canal', () => {
    expect(precioItem(ITEM, 'credito', 'mayor')).toBe(2.5);
    expect(precioItem(ITEM, 'credito', 'detal')).toBe(3.0);
    expect(precioItem(ITEM, 'contado', 'mayor')).toBe(2.2);
    expect(precioItem(ITEM, 'contado', 'detal')).toBe(2.7);
  });
});

describe('crearDespacho', () => {
  it('calcula subtotal y snapshot de tasa, estado pedido', () => {
    const d = crearDespacho(baseInput());
    expect(d.subtotal).toBe(5);
    expect(d.total).toBe(5);
    expect(d.tasa_bcv).toBe(36.5);
    expect(d.estado).toBe('pedido');
    expect(d.entregado_at).toBeNull();
    expect(d.cliente_id).toBe(CLIENTE.id);
    expect(d.nro_control).toMatch(/^D-[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(d.created_by).toBe('promotor@briannoel.com');
    expect(d.editor_role).toBe('promotor');
    expect(d.lineas).toEqual([
      { item_id: ITEM.id, nombre: ITEM.nombre, cantidad: 2, precio_unitario: 2.5 },
    ]);
  });

  it('aplica descuento aprobado (admin 1 paso) sobre el subtotal', () => {
    const d = crearDespacho(
      baseInput({
        descuento: { pct: 10, aprobado_por: 'admin@briannoel.com', pasos: 1 },
      }),
    );
    expect(d.subtotal).toBe(5);
    expect(d.total).toBe(4.5);
    expect(d.descuento_pct).toBe(10);
    expect(d.descuento_aprobado_por).toBe('admin@briannoel.com');
    expect(d.descuento_pasos).toBe(1);
  });

  it('sin descuento → descuento null', () => {
    const d = crearDespacho(baseInput());
    expect(d.descuento_pct).toBe(0);
    expect(d.descuento_aprobado_por).toBeNull();
    expect(d.descuento_pasos).toBeNull();
  });

  it('rechaza sin líneas', () => {
    expect(() => crearDespacho(baseInput({ lineas: [] }))).toThrow(/al menos una línea/);
  });

  it('rechaza tasa no positiva', () => {
    expect(() => crearDespacho(baseInput({ tasa_bcv: 0 }))).toThrow(/tasa BCV/);
    expect(() => crearDespacho(baseInput({ tasa_bcv: NaN }))).toThrow(/tasa BCV/);
  });

  it('rechaza cantidad no entera positiva', () => {
    expect(() =>
      crearDespacho(baseInput({ lineas: [{ item: ITEM, cantidad: 0 }] })),
    ).toThrow(/entero positivo/);
    expect(() =>
      crearDespacho(baseInput({ lineas: [{ item: ITEM, cantidad: 1.5 }] })),
    ).toThrow(/entero positivo/);
  });

  it('rechaza descuento sin aprobación', () => {
    expect(() =>
      crearDespacho(baseInput({ descuento: { pct: 5, aprobado_por: '', pasos: 1 } })),
    ).toThrow(/aprobación/);
  });

  it('rechaza descuento con pasos fuera de 1-2', () => {
    expect(() =>
      crearDespacho(
        baseInput({ descuento: { pct: 5, aprobado_por: 'admin@briannoel.com', pasos: 3 } }),
      ),
    ).toThrow(/1 ó 2 pasos/);
  });

  it('rechaza descuento fuera de rango 0-100', () => {
    expect(() =>
      crearDespacho(baseInput({ descuento: { pct: 120, aprobado_por: 'x', pasos: 1 } })),
    ).toThrow(/entre 0 y 100/);
  });

  it('redondea totales a 2 decimales', () => {
    const d = crearDespacho(
      baseInput({
        lineas: [{ item: { ...ITEM, precio_credito_detal: 2.333 }, cantidad: 2 }],
        canal: 'detal',
      }),
    );
    expect(d.subtotal).toBe(4.67);
    expect(Number.isInteger(d.subtotal * 100)).toBe(true);
  });
});

const CLOCK = {
  now: () => T0,
  newId: () => '01J0ZEV05QJ33W41PGGZG7XD6C',
};

describe('entregarDespacho (inmutabilidad §2.6)', () => {
  it('pedido → entregado con entregado_at', () => {
    const d = entregarDespacho(despachoBase(), 'supervisor@briannoel.com', 'supervisor', CLOCK);
    expect(d.estado).toBe('entregado');
    expect(d.entregado_at).toBe(T0);
    expect(d.updated_by).toBe('supervisor@briannoel.com');
    expect(d.editor_role).toBe('supervisor');
  });

  it('rechaza entregar un despacho ya entregado (inmutable)', () => {
    const entregado = entregarDespacho(despachoBase(), 'supervisor@briannoel.com', 'supervisor');
    expect(() => entregarDespacho(entregado, 'admin@briannoel.com', 'admin')).toThrow(
      /solo.*pedido/i,
    );
  });

  it('rechaza entregar un despacho anulado', () => {
    const anulado = despachoBase({ estado: 'anulado' });
    expect(() => entregarDespacho(anulado, 'admin@briannoel.com', 'admin')).toThrow(
      /solo.*pedido/i,
    );
  });
});

describe('eliminarDespachoPendiente (§3.3)', () => {
  it('elimina (soft delete) un despacho en pedido', () => {
    const d = eliminarDespachoPendiente(despachoBase(), 'promotor@briannoel.com', CLOCK);
    expect(d.deleted_at).toBe(T0);
    expect(d.updated_by).toBe('promotor@briannoel.com');
  });

  it('rechaza eliminar un despacho entregado (inmutable)', () => {
    const entregado = despachoBase({ estado: 'entregado', entregado_at: T0 });
    expect(() => eliminarDespachoPendiente(entregado, 'admin@briannoel.com')).toThrow(
      /solo.*pedido/i,
    );
  });
});

describe('crédito (§2.2/§2.5/§3.2)', () => {
  it('sin despachos a crédito → no bloqueado', () => {
    expect(creditoBloqueado(CLIENTE, [])).toBe(false);
    expect(creditoUsado(CLIENTE, [])).toEqual({ unidades: 0, limite: 1 });
  });

  const LINEA = {
    item_id: ITEM.id,
    nombre: ITEM.nombre,
    cantidad: 1,
    precio_unitario: 2.5,
  } as const;

  it('crédito en uso con score malo (D/E) → bloqueado', () => {
    const abiertos = [despachoBase({ lineas: [LINEA] })];
    expect(creditoBloqueado({ ...CLIENTE, score_grado: 'E' }, abiertos)).toBe(true);
    expect(creditoBloqueado({ ...CLIENTE, score_grado: 'D' }, abiertos)).toBe(true);
  });

  it('crédito en uso con score bueno → no bloqueado', () => {
    const abiertos = [despachoBase({ lineas: [LINEA] })];
    expect(creditoBloqueado({ ...CLIENTE, score_grado: 'A' }, abiertos)).toBe(false);
  });

  it('anulado y eliminados no cuentan contra el límite', () => {
    const anulado = despachoBase({ estado: 'anulado' });
    const eliminado = despachoBase({ deleted_at: T0 });
    expect(creditoUsado(CLIENTE, [anulado, eliminado])).toEqual({ unidades: 0, limite: 1 });
  });

  it('despachos de contado no consumen crédito', () => {
    const contado = despachoBase({ condicion: 'contado' });
    expect(creditoUsado(CLIENTE, [contado])).toEqual({ unidades: 0, limite: 1 });
  });

  it('suma unidades de líneas a crédito (bolsas/packs)', () => {
    const abiertos = [
      despachoBase({ lineas: [{ ...LINEA, cantidad: 2 }] }),
      despachoBase({ lineas: [{ ...LINEA, cantidad: 3 }] }),
    ];
    expect(creditoUsado(CLIENTE, abiertos)).toEqual({ unidades: 5, limite: 1 });
  });
});