import { describe, expect, it } from 'vitest';
import type { Cliente, Zona } from '@brian/shared';
import { DEFAULT_CREDITO_DIAS, DEFAULT_CREDITO_LIMITE } from '@brian/shared';
import {
  aplicarOverride,
  aplicarScore,
  crearCliente,
  editarCliente,
  haversineKm,
  matchZona,
  ZONA_RADIO_KM,
  type ClienteClock,
  type NuevoClienteInput,
} from '../src';

const T0 = '2024-06-01T00:00:00.000Z';

const clock: ClienteClock = {
  now: () => T0,
  newId: () => '01J0ZEV05QJ33W41PGGZG7XD6A',
};

/** Valencia (zona "Centro"), a ~3 km. */
const ZONA: Zona = {
  id: '01J0ZEV05QJ33W41PGGZG7XD6A',
  created_at: T0,
  updated_at: T0,
  deleted_at: null,
  nombre: 'Centro',
  municipio: 'Valencia',
  estado: 'Carabobo',
  lat: 10.1817,
  lng: -68.0031,
  plus_code: '77MMQ7XQ+XQ',
};

function baseInput(overrides: Partial<NuevoClienteInput> = {}): NuevoClienteInput {
  return {
    nombre: 'María Pérez',
    documento: 'V-12.345.678',
    telefono: '0412-0000000',
    creator: 'admin@briannoel.com',
    consentimiento: { fecha: T0, foto_casa: false, foto_documento: false, aviso_documento: false },
    ...overrides,
  };
}

describe('haversineKm', () => {
  it('distancia entre el mismo punto es 0', () => {
    const p = { lat: 10.1817, lng: -68.0031 };
    expect(haversineKm(p, p)).toBe(0);
  });

  it('distancia Valencia↔Caracas ~120-190 km', () => {
    const d = haversineKm({ lat: 10.1817, lng: -68.0031 }, { lat: 10.4806, lng: -66.9036 });
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(250);
  });

  it('es conmutativa', () => {
    const a = { lat: 10.1817, lng: -68.0031 };
    const b = { lat: 10.4806, lng: -66.9036 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 8);
  });
});

describe('matchZona', () => {
  it('sin geo → null', () => {
    expect(matchZona(undefined, [ZONA])).toBeNull();
  });

  it('coincide por prefijo de Plus Code', () => {
    expect(matchZona({ plus_code: '77MMQ7XQ+XQ2' }, [ZONA])?.id).toBe(ZONA.id);
  });

  it('prefiere el prefijo más largo entre varias zonas', () => {
    const zonaAmplia: Zona = { ...ZONA, id: 'AAAA', plus_code: '77MMQ7XQ' };
    expect(matchZona({ plus_code: '77MMQ7XQ+XQ3' }, [zonaAmplia, ZONA])?.id).toBe(ZONA.id);
  });

  it('asigna la zona más cercana por haversine dentro del radio', () => {
    const cercana: Zona = { ...ZONA, id: 'NEAR', lat: 10.182, lng: -68.0035 };
    const lejana: Zona = { ...ZONA, id: 'FAR', lat: 10.4, lng: -68.2 };
    expect(matchZona({ lat: 10.1818, lng: -68.0032 }, [lejana, cercana])?.id).toBe('NEAR');
  });

  it('fuera del radio → null', () => {
    expect(matchZona({ lat: 10.5, lng: -66.9 }, [ZONA])).toBeNull();
  });

  it('zonas sin lat/lng no cuentan para cercanía', () => {
    const sinGeo: Zona = { ...ZONA, id: 'NOGEO', lat: null, lng: null };
    expect(matchZona({ lat: 10.1818, lng: -68.0032 }, [sinGeo])).toBeNull();
  });

  it('radio configurable respetado', () => {
    // Punto a ~2x del radio por defecto → null
    const lejos = { lat: 10.1817 + ZONA_RADIO_KM * 0.05, lng: -68.0031 };
    expect(matchZona(lejos, [ZONA])).toBeNull();
  });

  it('sugiere la zona con la lat/lng del dispositivo (sin crear la zona)', () => {
    // Verificación §2.8: tomar "usar mi ubicación" en el campo es suficiente
    // para sugerir la zona inmediatamente por haversine (situación real con
    // varias zonas sembradas: 10.1817,-68.0031 es el centroide "Centro").
    const dispositivos = [
      { lat: 10.1872, lng: -67.9905 }, // ~1.4 km al este de Centro
      { lat: 10.176, lng: -68.0117 }, // ~1.1 km al oeste-suroeste de Centro
    ];
    const naguanagua: Zona = { ...ZONA, id: 'NAG', nombre: 'Naguanagua', lat: 10.2765, lng: -68.0106 };
    const sanBlas: Zona = { ...ZONA, id: 'SBL', nombre: 'San Blas', lat: 10.153, lng: -68.02 };
    for (const punto of dispositivos) {
      expect(matchZona(punto, [naguanagua, sanBlas, ZONA])?.id).toBe(ZONA.id);
      // El despeje del select (zonaId == '') NO debe anular la sugerencia.
      expect(matchZona(punto, [naguanagua, sanBlas, ZONA])?.nombre).toBe('Centro');
    }
  });
});

describe('crearCliente', () => {
  it('exige consentimiento informado', () => {
    expect(() =>
      crearCliente(
        {
          ...baseInput(),
          consentimiento: undefined as unknown as NuevoClienteInput['consentimiento'],
        },
        [ZONA],
        clock,
      ),
    ).toThrow(/consentimiento/i);
  });

  it('aplica crédito por defecto (1 bolsa/pack, 15 días)', () => {
    const c = crearCliente(baseInput({ geo: { lat: 10.1818, lng: -68.0032 } }), [ZONA], clock);
    expect(c.credito_limite).toBe(DEFAULT_CREDITO_LIMITE);
    expect(c.credito_dias).toBe(DEFAULT_CREDITO_DIAS);
  });

  it('asigna zona por geolocalización', () => {
    const c = crearCliente(baseInput({ geo: { lat: 10.1818, lng: -68.0032 } }), [ZONA], clock);
    expect(c.zona_id).toBe(ZONA.id);
  });

  it('guarda id, timestamps y auditoría', () => {
    const c = crearCliente(baseInput(), [ZONA], clock);
    expect(c.id).toBe('01J0ZEV05QJ33W41PGGZG7XD6A');
    expect(c.created_at).toBe(T0);
    expect(c.updated_at).toBe(T0);
    expect(c.deleted_at).toBeNull();
    expect(c.created_by).toBe('admin@briannoel.com');
    expect(c.updated_by).toBe('admin@briannoel.com');
  });

  it('sin geo → zona null pero cliente creado', () => {
    const c = crearCliente(baseInput(), [ZONA], clock);
    expect(c.zona_id).toBeNull();
  });
});

describe('editarCliente', () => {
  const base = crearCliente(baseInput({ geo: { lat: 10.1818, lng: -68.0032 } }), [ZONA], clock);

  it('reasignación automática de zona al cambiar dirección/geo', () => {
    const otra: Zona = { ...ZONA, id: 'OTRA', lat: 10.182, lng: -68.004 };
    const c = editarCliente(
      base,
      { nombre: 'María', editor: 'sup@briannoel.com', geo: { lat: 10.183, lng: -68.005 } },
      [ZONA, otra],
      clock,
    );
    expect(c.zona_id).toBe('OTRA');
  });

  it('sin cambio de dirección conserva la zona', () => {
    const otra: Zona = { ...ZONA, id: 'OTRA', lat: 10.182, lng: -68.004 };
    const c = editarCliente(
      base,
      { editor: 'admin@briannoel.com', nombre: 'María P.' },
      [ZONA, otra],
      clock,
    );
    expect(c.zona_id).toBe(ZONA.id);
    expect(c.nombre).toBe('María P.');
  });

  it('audita updated_by/updated_at', () => {
    const c = editarCliente(base, { editor: 'sup@briannoel.com' }, [ZONA], clock);
    expect(c.updated_by).toBe('sup@briannoel.com');
    expect(c.updated_at).toBe(T0);
  });

  it('establecer lat/lng explícito null desasigna zona', () => {
    const c = editarCliente(
      base,
      { editor: 'x@x.com', geo: { lat: null, lng: null } },
      [ZONA],
      clock,
    );
    expect(c.lat).toBeNull();
    expect(c.zona_id).toBeNull();
  });
});

describe('aplicarScore', () => {
  it('calcula score referencial sobre historial vacío (uso referencial §2.5)', () => {
    const c = aplicarScore(crearCliente(baseInput(), [ZONA], clock), { tenureDays: 0 }, clock);
    expect(c.score).toBeTypeOf('number');
    expect(c.score).toBeGreaterThanOrEqual(0);
    expect(c.score).toBeLessThanOrEqual(100);
    expect(['A', 'B', 'C', 'D', 'E']).toContain(c.score_grado);
  });

  it('historial sano → grado alto sin override', () => {
    const c = aplicarScore(
      crearCliente(baseInput(), [ZONA], clock),
      {
        tenureDays: 900,
        asOf: T0,
        payments: [
          { due: '2024-01-10T00:00:00.000Z', paid: '2024-01-09T00:00:00.000Z' },
          { due: '2024-02-10T00:00:00.000Z', paid: '2024-02-10T00:00:00.000Z' },
          { due: '2024-03-10T00:00:00.000Z', paid: '2024-03-08T00:00:00.000Z' },
        ],
        purchases: Array.from({ length: 10 }, (_, i) => ({
          amount: 250,
          at: new Date(Date.parse(T0) - i * 8 * 86_400_000).toISOString(),
        })),
      },
      clock,
    );
    expect(c.score_override).toBeNull();
    expect(c.score_grado).toBe('A');
  });
});

describe('aplicarOverride', () => {
  const base = crearCliente(baseInput(), [ZONA], clock);

  it('audita el override (by + at) y fija grado', () => {
    const c = aplicarOverride(base, { value: 95, autorizado_por: 'sup@briannoel.com' }, clock);
    expect(c.score_override).toBe(95);
    expect(c.score).toBe(95);
    expect(c.score_grado).toBe('A');
    expect(c.updated_by).toBe('sup@briannoel.com');
    expect(c.updated_at).toBe(T0);
  });

  it('rechaza override con valor inválido', () => {
    expect(() =>
      aplicarOverride(base, { value: 150, autorizado_por: 'admin@briannoel.com' }, clock),
    ).toThrow(/0 y 100/);
    expect(() =>
      aplicarOverride(base, { value: 1.5, autorizado_por: 'admin@briannoel.com' }, clock),
    ).toThrow();
  });

  it('grado se deriva del valor del override', () => {
    const c = aplicarOverride(base, { value: 30, autorizado_por: 'admin@briannoel.com' }, clock);
    expect(c.score_grado).toBe('E');
  });
});

describe('tipos: Cliente resultante es válido', () => {
  it('cliente creado con zonas cumple mínimos del schema (hoja)', () => {
    const c = crearCliente(baseInput({ geo: { lat: 10.1818, lng: -68.0032 } }), [ZONA], clock);
    const c2: Cliente = c;
    expect(c2.nombre.length).toBeGreaterThan(0);
    expect(c2.consentimiento.fecha).toBe(T0);
    expect(c2.consentimiento.foto_documento).toBe(false);
  });
});
