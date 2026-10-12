import type { SyncRecordWithData } from '@brian/sync-engine';
import { hub } from '../sync/db';

type DemoRow = SyncRecordWithData<Record<string, unknown>> & { entity: string };

/**
 * Datos de demostración para el desarrollo (SOLO dev, `import.meta.env.DEV`):
 * alimentan el espejo Dexie para que las pruebas de las secciones del hub sean
 * inmediatas — lista de usuarios que aparece (`app_users` con username con
 * espacios y un perfil legacy sin username), personal seleccionable en la
 * venta, clientes, zonas, catálogo, tasa BCV y despachos en varios estados.
 *
 * NO pasan por la outbox (nada se sube al Supabase real): solo el mirror. Si la
 * próxima sync trae datos del servidor conviven con estos por LWW; los ids
 * `demo-*` se limpian con `limpiarDemoData`.
 */
const ADMIN_EMAIL = 'ed.alv1098@gmail.com';

function iso(offsetMs: number): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

const H = 3600_000;
const D = 24 * H;

export const DEMO_IDS: readonly string[] = [
  'global',
  'demo-zon-norte',
  'demo-zon-centro',
  'demo-zon-hatillo',
  'demo-ite-1',
  'demo-ite-2',
  'demo-ite-3',
  'demo-ite-4',
  'demo-ite-5',
  'demo-cli-1',
  'demo-cli-2',
  'demo-cli-3',
  'demo-cli-4',
  'demo-cli-5',
  'demo-cli-6',
  'demo-per-1',
  'demo-per-2',
  'demo-per-3',
  'demo-per-4',
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006',
  'demo-desp-1',
  'demo-desp-2',
  'demo-desp-3',
  'demo-desp-4',
];

function buildRows(): DemoRow[] {
  const rows: DemoRow[] = [];

  rows.push({
    id: 'global',
    entity: 'app_config',
    created_at: iso(D),
    updated_at: iso(45 * 60_000),
    deleted_at: null,
    base_currency: 'USD',
    bcv_rate: 90.75,
    bcv_rate_updated_at: iso(45 * 60_000),
    bcv_rate_source: 'BCV_API',
  });

  rows.push(
    {
      id: 'demo-zon-norte',
      entity: 'zonas',
      created_at: iso(30 * D),
      updated_at: iso(27 * D),
      deleted_at: null,
      nombre: 'Zona Norte',
      municipio: 'Chacao',
      estado: 'Miranda',
      lat: 10.495,
      lng: -66.852,
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
    {
      id: 'demo-zon-centro',
      entity: 'zonas',
      created_at: iso(29 * D),
      updated_at: iso(25 * D),
      deleted_at: null,
      nombre: 'Zona Centro',
      municipio: 'Libertador',
      estado: 'Distrito Capital',
      lat: 10.506,
      lng: -66.906,
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
    {
      id: 'demo-zon-hatillo',
      entity: 'zonas',
      created_at: iso(28 * D),
      updated_at: iso(24 * D),
      deleted_at: null,
      nombre: 'El Hatillo',
      municipio: 'El Hatillo',
      estado: 'Miranda',
      lat: 10.43,
      lng: -66.81,
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
  );

  rows.push(
    {
      id: 'demo-ite-1',
      entity: 'items',
      created_at: iso(20 * D),
      updated_at: iso(20 * D),
      deleted_at: null,
      nombre: 'Aceite vegetal 1 L',
      precio_contado: 4.5,
      precio_credito: 4.85,
    },
    {
      id: 'demo-ite-2',
      entity: 'items',
      created_at: iso(19 * D),
      updated_at: iso(19 * D),
      deleted_at: null,
      nombre: 'Arroz 5 kg',
      precio_contado: 7.25,
      precio_credito: 7.9,
    },
    {
      id: 'demo-ite-3',
      entity: 'items',
      created_at: iso(18 * D),
      updated_at: iso(18 * D),
      deleted_at: null,
      nombre: 'Azúcar 1 kg',
      precio_contado: 1.3,
      precio_credito: 1.45,
    },
    {
      id: 'demo-ite-4',
      entity: 'items',
      created_at: iso(17 * D),
      updated_at: iso(17 * D),
      deleted_at: null,
      nombre: 'Harina de maíz 1 kg',
      precio_contado: 1.2,
      precio_credito: 1.35,
    },
    {
      id: 'demo-ite-5',
      entity: 'items',
      created_at: iso(16 * D),
      updated_at: iso(16 * D),
      deleted_at: null,
      nombre: 'Café molido 500 g',
      precio_contado: 4,
      precio_credito: 4.4,
    },
  );

  rows.push(
    {
      id: 'demo-cli-1',
      entity: 'clientes',
      created_at: iso(25 * D),
      updated_at: iso(12 * D),
      deleted_at: null,
      nombre: 'Mercado La Esquina',
      documento: 'V-12345678',
      telefono: '0414-1234567',
      telefono2: '0424-7654321',
      direccion: 'Av. Principal, casa 12, Urb. El Rosal',
      lat: 10.4806,
      lng: -66.9036,
      zona_id: 'demo-zon-centro',
      consentimiento: { fecha: iso(25 * D), foto_casa: false, foto_documento: false, aviso_documento: false },
      credito_limite: 300,
      credito_dias: 30,
      score: 82,
      score_grado: 'A',
      notas_referencia: 'Paga los martes. Entrar por la calle lateral.',
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
    {
      id: 'demo-cli-2',
      entity: 'clientes',
      created_at: iso(22 * D),
      updated_at: iso(10 * D),
      deleted_at: null,
      nombre: 'Abasto Los Álamos',
      documento: 'J-30678999-5',
      telefono: '0412-9876543',
      telefono2: '0416-3322110',
      direccion: 'Calle 2 de Mayo, entre Sucre y Bolívar',
      lat: 10.498,
      lng: -66.868,
      zona_id: 'demo-zon-norte',
      consentimiento: { fecha: iso(22 * D), foto_casa: true, foto_documento: false, aviso_documento: false },
      credito_limite: 500,
      credito_dias: 30,
      score: 95,
      score_grado: 'A',
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
    {
      id: 'demo-cli-3',
      entity: 'clientes',
      created_at: iso(14 * D),
      updated_at: iso(8 * D),
      deleted_at: null,
      nombre: 'Licorería San Rafael',
      documento: 'V-90457812',
      telefono: '0424-5566778',
      direccion: 'Av. San Rafael, local 5, Centro Comercial Montalbán',
      zona_id: 'demo-zon-norte',
      consentimiento: { fecha: iso(14 * D), foto_casa: false, foto_documento: true, aviso_documento: true },
      credito_limite: 200,
      credito_dias: 15,
      score: 64,
      score_grado: 'C',
      notas_referencia: 'Paga quincenal. Motivo del pedido: fondos o refrescos.',
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
    {
      id: 'demo-cli-4',
      entity: 'clientes',
      created_at: iso(6 * D),
      updated_at: iso(2 * D),
      deleted_at: null,
      nombre: 'Sra. Carmen Josefina Rojas',
      documento: 'V-11567890',
      telefono: '0416-7788990',
      direccion: 'Res. Los Trinitarios, edif. 3, apto 12-B',
      lat: 10.432,
      lng: -66.813,
      zona_id: 'demo-zon-hatillo',
      consentimiento: { fecha: iso(6 * D), foto_casa: false, foto_documento: false, aviso_documento: false },
      credito_limite: 1,
      credito_dias: 15,
      score: 22,
      score_grado: 'E',
      notas_referencia: 'Cliente nuevo, primera venta. Sin historial.',
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
    {
      id: 'demo-cli-5',
      entity: 'clientes',
      created_at: iso(11 * D),
      updated_at: iso(5 * D),
      deleted_at: null,
      nombre: 'Bodegón El Progreso',
      documento: 'J-30555001-8',
      telefono: '0412-4455667',
      direccion: 'Av. Boyacá, frente a la Plaza Bolívar',
      zona_id: 'demo-zon-centro',
      consentimiento: { fecha: iso(11 * D), foto_casa: false, foto_documento: false, aviso_documento: false },
      credito_limite: 150,
      credito_dias: 30,
      score: 72,
      score_grado: 'B',
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
    {
      id: 'demo-cli-6',
      entity: 'clientes',
      created_at: iso(9 * D),
      updated_at: iso(3 * D),
      deleted_at: null,
      nombre: 'Panadería Doña Rosalía',
      documento: 'V-81234567',
      telefono: '0212-3344556',
      zona_id: 'demo-zon-hatillo',
      consentimiento: { fecha: iso(9 * D), foto_casa: false, foto_documento: false, aviso_documento: false },
      credito_limite: 250,
      credito_dias: 30,
      score: 88,
      score_grado: 'A',
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
  );

  rows.push(
    {
      id: 'demo-per-1',
      entity: 'personal',
      created_at: iso(10 * D),
      updated_at: iso(10 * D),
      deleted_at: null,
      nombre: 'Brián Noel Prieto',
      telefono: '0412-1112233',
      email: ADMIN_EMAIL,
      rol: 'admin',
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
    {
      id: 'demo-per-2',
      entity: 'personal',
      created_at: iso(9 * D),
      updated_at: iso(9 * D),
      deleted_at: null,
      nombre: 'María Esperanza Pérez',
      telefono: '0414-2233445',
      rol: 'supervisor',
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
    {
      id: 'demo-per-3',
      entity: 'personal',
      created_at: iso(8 * D),
      updated_at: iso(8 * D),
      deleted_at: null,
      nombre: 'Luis Antonio Sánchez',
      telefono: '0424-3344556',
      rol: 'promotor',
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
    {
      id: 'demo-per-4',
      entity: 'personal',
      created_at: iso(7 * D),
      updated_at: iso(7 * D),
      deleted_at: null,
      nombre: 'Carmen Josefina Rojas',
      telefono: '0426-4455667',
      rol: 'cobrador',
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
    },
  );

  // app_users: id = user_id (uuid en texto, clave compartida cuenta/perfil).
  // Incluye un username con espacios y acentos y un perfil legacy sin username
  // (pre-0009): lista de usuarios y candidatos de la venta deben mostrarlos.
  rows.push(
    {
      id: '10000000-0000-4000-8000-000000000001',
      user_id: '10000000-0000-4000-8000-000000000001',
      entity: 'app_users',
      created_at: iso(12 * D),
      updated_at: iso(2 * D),
      deleted_at: null,
      email: ADMIN_EMAIL,
      username: 'Brián Noel Prieto',
      name: 'Brián Noel Prieto',
      roles: ['admin'],
      active: true,
    },
    {
      id: '10000000-0000-4000-8000-000000000002',
      user_id: '10000000-0000-4000-8000-000000000002',
      entity: 'app_users',
      created_at: iso(11 * D),
      updated_at: iso(2 * D),
      deleted_at: null,
      email: 'maria.esperanza@example.com',
      username: 'María Esperanza Pérez',
      roles: ['supervisor'],
      active: true,
    },
    {
      id: '10000000-0000-4000-8000-000000000003',
      user_id: '10000000-0000-4000-8000-000000000003',
      entity: 'app_users',
      created_at: iso(9 * D),
      updated_at: iso(9 * D),
      deleted_at: null,
      email: 'luis.sanchez@example.com',
      username: 'Luis Antonio Sánchez',
      roles: ['promotor'],
      active: true,
    },
    {
      id: '10000000-0000-4000-8000-000000000004',
      user_id: '10000000-0000-4000-8000-000000000004',
      entity: 'app_users',
      created_at: iso(8 * D),
      updated_at: iso(8 * D),
      deleted_at: null,
      email: 'carmen.rojas@example.com',
      username: 'Carmen Josefina Rojas',
      roles: ['cobrador'],
      active: true,
    },
    {
      id: '10000000-0000-4000-8000-000000000005',
      user_id: '10000000-0000-4000-8000-000000000005',
      entity: 'app_users',
      created_at: iso(7 * D),
      updated_at: iso(1 * D),
      deleted_at: null,
      email: 'ana.garcia@example.com',
      username: 'Ana Victoria García',
      roles: ['promotor'],
      active: false,
    },
    {
      id: '10000000-0000-4000-8000-000000000006',
      user_id: '10000000-0000-4000-8000-000000000006',
      entity: 'app_users',
      created_at: iso(6 * D),
      updated_at: iso(6 * D),
      deleted_at: null,
      email: 'pedro.soto@example.com',
      name: 'pedro.soto@example.com',
      roles: ['promotor'],
      active: true,
    },
  );

  const d1 = iso(2.5 * H);
  const d2 = iso(5 * H);
  rows.push(
    {
      id: 'demo-desp-1',
      entity: 'despachos',
      created_at: d1,
      updated_at: d1,
      deleted_at: null,
      nro_control: 'VTA-0001',
      cliente_id: 'demo-cli-1',
      cliente_nombre: 'Mercado La Esquina',
      condicion: 'credito',
      lineas: [
        { item_id: 'demo-ite-1', nombre: 'Aceite vegetal 1 L', cantidad: 6, precio_unitario: 4.5 },
        { item_id: 'demo-ite-2', nombre: 'Arroz 5 kg', cantidad: 4, precio_unitario: 7.25 },
      ],
      subtotal: 56,
      total: 56,
      tasa_bcv: 90.75,
      estado: 'pedido',
      descuento_pct: 0,
      descuento_monto_usd: null,
      descuento_aprobado_por: null,
      descuento_pasos: null,
      mora_pct: 0,
      mora_monto_usd: null,
      iva_pct: 0,
      mora_total_usd: 0,
      iva_total_usd: 0,
      promotor: 'Brián Noel Prieto',
      supervisor: null,
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
      editor_role: 'admin',
      entregado_at: null,
      entregado_por: null,
    },
    {
      id: 'demo-desp-2',
      entity: 'despachos',
      created_at: d2,
      updated_at: d2,
      deleted_at: null,
      nro_control: 'VTA-0002',
      cliente_id: 'demo-cli-3',
      cliente_nombre: 'Licorería San Rafael',
      condicion: 'contado',
      lineas: [
        { item_id: 'demo-ite-3', nombre: 'Azúcar 1 kg', cantidad: 10, precio_unitario: 1.3 },
        { item_id: 'demo-ite-4', nombre: 'Harina de maíz 1 kg', cantidad: 5, precio_unitario: 1.2 },
      ],
      subtotal: 19,
      total: 19,
      tasa_bcv: 90.75,
      estado: 'pedido',
      descuento_pct: 0,
      descuento_monto_usd: null,
      descuento_aprobado_por: null,
      descuento_pasos: null,
      mora_pct: 0,
      mora_monto_usd: null,
      iva_pct: 0,
      mora_total_usd: 0,
      iva_total_usd: 0,
      promotor: 'Carmen Josefina Rojas',
      supervisor: null,
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
      editor_role: 'promotor',
      entregado_at: null,
      entregado_por: null,
    },
    {
      id: 'demo-desp-3',
      entity: 'despachos',
      created_at: iso(3 * D),
      updated_at: iso(3 * D),
      deleted_at: null,
      nro_control: 'VTA-0003',
      cliente_id: 'demo-cli-2',
      cliente_nombre: 'Abasto Los Álamos',
      condicion: 'credito',
      lineas: [{ item_id: 'demo-ite-5', nombre: 'Café molido 500 g', cantidad: 12, precio_unitario: 4 }],
      subtotal: 48,
      total: 48,
      tasa_bcv: 88,
      estado: 'entregado',
      descuento_pct: 0,
      descuento_monto_usd: null,
      descuento_aprobado_por: null,
      descuento_pasos: null,
      mora_pct: 0,
      mora_monto_usd: null,
      iva_pct: 0,
      mora_total_usd: 0,
      iva_total_usd: 0,
      promotor: 'María Esperanza Pérez',
      supervisor: 'Brián Noel Prieto',
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
      editor_role: 'supervisor',
      entregado_at: iso(2 * D),
      entregado_por: 'Brián Noel Prieto',
    },
    {
      id: 'demo-desp-4',
      entity: 'despachos',
      created_at: iso(6 * D),
      updated_at: iso(6 * D),
      deleted_at: null,
      nro_control: 'VTA-0004',
      cliente_id: 'demo-cli-5',
      cliente_nombre: 'Bodegón El Progreso',
      condicion: 'credito',
      lineas: [
        { item_id: 'demo-ite-5', nombre: 'Café molido 500 g', cantidad: 10, precio_unitario: 4 },
        { item_id: 'demo-ite-4', nombre: 'Harina de maíz 1 kg', cantidad: 10, precio_unitario: 1.2 },
      ],
      subtotal: 52,
      total: 49.4,
      tasa_bcv: 87,
      estado: 'entregado',
      descuento_pct: 5,
      descuento_monto_usd: null,
      descuento_aprobado_por: 'María Esperanza Pérez',
      descuento_pasos: 1,
      mora_pct: 0,
      mora_monto_usd: null,
      iva_pct: 0,
      mora_total_usd: 0,
      iva_total_usd: 0,
      promotor: 'Luis Antonio Sánchez',
      supervisor: 'Brián Noel Prieto',
      created_by: ADMIN_EMAIL,
      updated_by: ADMIN_EMAIL,
      editor_role: 'supervisor',
      entregado_at: iso(5 * D),
      entregado_por: 'Brián Noel Prieto',
    },
  );

  return rows;
}

/** Escribe los datos demo en el espejo Dexie (mirror local; sin outbox). */
export async function seedDemoData(): Promise<number> {
  await hub.transaction('rw', hub.records, async () => {
    await hub.records.bulkPut(buildRows());
  });
  return DEMO_IDS.length;
}

/** Borra solo los registros demo del mirror (no toca datos reales). */
export async function limpiarDemoData(): Promise<number> {
  const ids = [...DEMO_IDS];
  const borrados = await hub.records.where('id').anyOf(ids).delete();
  return borrados;
}

/** Demo ya presente (para el auto-seed y el estado del botón). */
export async function tieneDatosDemo(): Promise<boolean> {
  const n = await hub.records.where('id').anyOf([...DEMO_IDS]).count();
  return n > 0;
}

/**
 * Auto-seed para arrancar el dev sin pasos manuales: solo en `import.meta.env.DEV`
 * y solo cuando el mirror está completamente vacío (así no pisa una sync real).
 * El gate de tasa usa `useLiveQuery` sobre `app_config`: al escribirlo, la
 * pantalla de tasa se desbloquea sola.
 */
export async function seedDemoSiVacio(): Promise<boolean> {
  const total = await hub.records.count();
  if (total > 0) return false;
  await seedDemoData();
  return true;
}