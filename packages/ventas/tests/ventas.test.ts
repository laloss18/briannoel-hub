import { describe, expect, it } from 'vitest';
import type { Cliente, Despacho, Item } from '@brian/shared';
import {
  corregirDespacho,
  creditoBloqueado,
  creditoUsado,
  crearDespacho,
  editarDespachoPendiente,
  eliminarDespachoPendiente,
  entregarDespacho,
  precioItem,
  puedeGestionarDespacho,
  type CrearDespachoInput,
  type EditarDespachoInput,
} from '../src';

const T0 = '2024-06-01T00:00:00.000Z';

const ITEM: Item = {
  id: '01J0ZEV05QJ33W41PGGZG7XD6A',
  created_at: T0,
  updated_at: T0,
  deleted_at: null,
  nombre: 'Galleta trigo de oro 90g',
  precio_contado: 2.2,
  precio_credito: 2.5,
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
    lineas: [{ item_id: ITEM.id, nombre: ITEM.nombre, cantidad: 1, precio_unitario: 2.5 }],
    subtotal: 2.5,
    tasa_bcv: 36.5,
    total: 2.5,
    estado: 'pedido',
    descuento_pct: 0,
    descuento_monto_usd: null,
    descuento_aprobado_por: null,
    descuento_pasos: null,
    promotor: null,
    supervisor: null,
    created_by: 'promotor@briannoel.com',
    updated_by: 'promotor@briannoel.com',
    editor_role: 'promotor',
    entregado_at: null,
    entregado_por: null,
    ...overrides,
  };
}

describe('precioItem (por condición, PRD §2.2)', () => {
  it('selecciona el precio de catálogo según la condición', () => {
    expect(precioItem(ITEM, 'credito')).toBe(2.5);
    expect(precioItem(ITEM, 'contado')).toBe(2.2);
  });
});

describe('crearDespacho', () => {
  it('calcula subtotal con tasa snapshot opcional, estado pedido', () => {
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

  it('se cierra sin tasa BCV (0) — la tasa solo sirve para registrar pagos', () => {
    const d = crearDespacho(baseInput({ tasa_bcv: undefined }));
    expect(d.tasa_bcv).toBe(0);
    expect(d.total).toBe(5);
  });

  it('guarda el promotor que captó al cliente si se entrega', () => {
    const d = crearDespacho(baseInput({ promotor: 'Ana Rojas' }));
    expect(d.promotor).toBe('Ana Rojas');
    expect(d.entregado_por).toBeNull();
    const sinPromotor = crearDespacho(baseInput());
    expect(sinPromotor.promotor).toBeNull();
  });

  it('guarda el supervisor a cargo del pedido', () => {
    const d = crearDespacho(baseInput({ supervisor: 'Luis Pérez' }));
    expect(d.supervisor).toBe('Luis Pérez');
    const sinSupervisor = crearDespacho(baseInput());
    expect(sinSupervisor.supervisor).toBeNull();
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
    expect(d.descuento_monto_usd).toBeNull();
  });

  it('aplica descuento por monto fijo en USD', () => {
    const d = crearDespacho(
      baseInput({
        descuento: { monto_usd: 1.25, aprobado_por: 'admin@briannoel.com', pasos: 1 },
      }),
    );
    expect(d.subtotal).toBe(5);
    expect(d.total).toBe(3.75);
    expect(d.descuento_monto_usd).toBe(1.25);
    expect(d.descuento_pct).toBe(0);
    expect(d.descuento_aprobado_por).toBe('admin@briannoel.com');
  });

  it('rechaza descuento doble (porcentaje y monto a la vez)', () => {
    expect(() =>
      crearDespacho(
        baseInput({
          descuento: { pct: 10, monto_usd: 1, aprobado_por: 'admin@briannoel.com', pasos: 1 },
        }),
      ),
    ).toThrow(/un solo tipo de descuento/);
  });

  it('rechaza monto de descuento mayor al subtotal', () => {
    expect(() =>
      crearDespacho(
        baseInput({
          descuento: { monto_usd: 6, aprobado_por: 'admin@briannoel.com', pasos: 1 },
        }),
      ),
    ).toThrow(/no puede superar el subtotal/);
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

  it('rechaza tasa negativa o no numérica', () => {
    expect(() => crearDespacho(baseInput({ tasa_bcv: -1 }))).toThrow(/tasa BCV/);
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
        condicion: 'contado',
        lineas: [{ item: { ...ITEM, precio_contado: 2.333 }, cantidad: 2 }],
      }),
    );
    expect(d.subtotal).toBe(4.67);
    expect(Number.isInteger(d.subtotal * 100)).toBe(true);
  });
});

describe('editarDespachoPendiente (edición de pedido, §2.6)', () => {
  function editInput(overrides: Partial<EditarDespachoInput> = {}): EditarDespachoInput {
    return {
      condicion: 'contado',
      lineas: [{ item: ITEM, cantidad: 3 }],
      editor: 'admin@briannoel.com',
      editor_role: 'admin',
      ...overrides,
    };
  }

  it('recalcula líneas, subtotal y total del pedido sin tocar id/created_at', () => {
    const d = editarDespachoPendiente(
      despachoBase({ lineas: [{ item_id: ITEM.id, nombre: ITEM.nombre, cantidad: 1, precio_unitario: 2.5 }] }),
      { ...editInput(), clock: { now: () => T0, newId: () => 'X' } },
    );
    expect(d.id).toBe('01J0ZEV05QJ33W41PGGZG7XD6C');
    expect(d.created_at).toBe(T0);
    expect(d.estado).toBe('pedido');
    expect(d.condicion).toBe('contado');
    expect(d.lineas).toEqual([
      { item_id: ITEM.id, nombre: ITEM.nombre, cantidad: 3, precio_unitario: 2.2 },
    ]);
    expect(d.subtotal).toBe(6.6);
    expect(d.total).toBe(6.6);
    expect(d.updated_by).toBe('admin@briannoel.com');
    expect(d.editor_role).toBe('admin');
  });

  it('rechaza editar un despacho entregado (inmutable)', () => {
    const entregado = despachoBase({ estado: 'entregado', entregado_at: T0 });
    expect(() => editarDespachoPendiente(entregado, editInput())).toThrow(/solo.*pedido/i);
  });

  it('conserva el cliente salvo que se cambie', () => {
    const d = editarDespachoPendiente(despachoBase(), editInput());
    expect(d.cliente_id).toBe(CLIENTE.id);
  });

  it('edición con descuento por monto fijo recalcula el total', () => {
    const d = editarDespachoPendiente(
      despachoBase(),
      {
        ...editInput({ lineas: [{ item: ITEM, cantidad: 2 }] }),
        descuento: { monto_usd: 1, aprobado_por: 'admin@briannoel.com', pasos: 1 },
      },
    );
    expect(d.subtotal).toBe(4.4);
    expect(d.total).toBe(3.4);
    expect(d.descuento_monto_usd).toBe(1);
    expect(d.descuento_pct).toBe(0);
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

  it('guarda quién entregó (roster/email)', () => {
    const d = entregarDespacho(despachoBase(), 'Luis Pérez', 'admin', CLOCK);
    expect(d.entregado_por).toBe('Luis Pérez');
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

describe('corregirDespacho (corrección admin §2.6)', () => {
  it('marca entregado indicando quién entregó (desde pedido)', () => {
    const d = corregirDespacho(
      despachoBase(),
      { estado: 'entregado', entregado_por: 'Luis Pérez', editor: 'admin@briannoel.com', editor_role: 'admin', clock: CLOCK },
    );
    expect(d.estado).toBe('entregado');
    expect(d.entregado_at).toBe(T0);
    expect(d.entregado_por).toBe('Luis Pérez');
    expect(d.updated_by).toBe('admin@briannoel.com');
  });

  it('revierte entregado → pedido (me equivoqué) y limpia la entrega', () => {
    const entregado = despachoBase({ estado: 'entregado', entregado_at: T0, entregado_por: 'Luis Pérez' });
    const d = corregirDespacho(
      entregado,
      { estado: 'pedido', editor: 'admin@briannoel.com', editor_role: 'admin', clock: CLOCK },
    );
    expect(d.estado).toBe('pedido');
    expect(d.entregado_at).toBeNull();
    expect(d.entregado_por).toBeNull();
  });

  it('anula un pedido entregado (corrección)', () => {
    const entregado = despachoBase({ estado: 'entregado', entregado_at: T0, entregado_por: 'Luis Pérez' });
    const d = corregirDespacho(
      entregado,
      { estado: 'anulado', editor: 'admin@briannoel.com', editor_role: 'admin', clock: CLOCK },
    );
    expect(d.estado).toBe('anulado');
    expect(d.entregado_por).toBe('Luis Pérez');
  });

  it('asigna promotor y entregado_por del roster sin cambiar estado', () => {
    const d = corregirDespacho(
      despachoBase(),
      { promotor: 'Ana Rojas', entregado_por: 'Luis Pérez', editor: 'admin@briannoel.com', editor_role: 'admin', clock: CLOCK },
    );
    expect(d.promotor).toBe('Ana Rojas');
    expect(d.entregado_por).toBe('Luis Pérez');
    expect(d.estado).toBe('pedido');
  });

  it('limpiar promotor/entregado_por con null', () => {
    const conRoster = despachoBase({ promotor: 'Ana Rojas', entregado_por: 'Luis Pérez' });
    const d = corregirDespacho(
      conRoster,
      { promotor: null, entregado_por: null, editor: 'admin@briannoel.com', editor_role: 'admin', clock: CLOCK },
    );
    expect(d.promotor).toBeNull();
    expect(d.entregado_por).toBeNull();
  });

  it('rechaza marcar entregado sin indicar quién entregó', () => {
    expect(() =>
      corregirDespacho(
        despachoBase(),
        { estado: 'entregado', editor: 'admin@briannoel.com', editor_role: 'admin' },
      ),
    ).toThrow(/quién entregó/i);
  });

  it('rechaza marcar entregado desde un estado distinto a pedido', () => {
    const anulado = despachoBase({ estado: 'anulado' });
    expect(() =>
      corregirDespacho(
        anulado,
        { estado: 'entregado', entregado_por: 'Luis', editor: 'admin@briannoel.com', editor_role: 'admin' },
      ),
    ).toThrow(/pedido/i);
  });

  it('rechaza anular algo ya anulado', () => {
    const anulado = despachoBase({ estado: 'anulado' });
    expect(() =>
      corregirDespacho(
        anulado,
        { estado: 'anulado', editor: 'admin@briannoel.com', editor_role: 'admin' },
      ),
    ).toThrow(/ya está anulado/i);
  });
});

describe('puedeGestionarDespacho (propiedad §3.3)', () => {
  it('el admin gestiona cualquier registro', () => {
    const d = despachoBase({ supervisor: 'Luis Pérez', created_by: 'promotor@x.com' });
    expect(puedeGestionarDespacho(d, 'otro@x.com', 'otro@x.com', 'admin')).toBe(true);
  });

  it('el supervisor gestiona solo sus propios registros (a cargo)', () => {
    const propios = despachoBase({ supervisor: 'Luis Pérez', created_by: 'promotor@x.com' });
    expect(puedeGestionarDespacho(propios, 'Luis Pérez', 'supervisor@x.com', 'supervisor')).toBe(true);
    const ajenos = despachoBase({ supervisor: 'Ana Rojas', created_by: 'promotor@x.com' });
    expect(puedeGestionarDespacho(ajenos, 'Luis Pérez', 'supervisor@x.com', 'supervisor')).toBe(false);
  });

  it('el promotor gestiona el pedido que tomó él', () => {
    const propio = despachoBase({ created_by: 'promotor@x.com' });
    expect(puedeGestionarDespacho(propio, 'promotor@x.com', 'promotor@x.com', 'promotor')).toBe(true);
    const ajeno = despachoBase({ created_by: 'otro@x.com' });
    expect(puedeGestionarDespacho(ajeno, 'promotor@x.com', 'promotor@x.com', 'promotor')).toBe(false);
  });

  it('supervisor coincide por email de la sesión si el roster no tiene nombre', () => {
    const d = despachoBase({ supervisor: 'supervisor@briannoel.com', created_by: 'promotor@x.com' });
    expect(puedeGestionarDespacho(d, 'supervisor@briannoel.com', 'supervisor@briannoel.com', 'supervisor')).toBe(true);
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