import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve('C:/Users/Luis/Desktop/nprojects/briannoel hub/apps/web/dist');
const OUT = join(HERE, 'shots');
const BASE = 'http://127.0.0.1:8091';
const PORT = 8091;
const PIN = '1234';

mkdirSync(OUT, { recursive: true });

/* ── servidor estático sobre dist ─────────────────────────────────── */
const server = spawn('python', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {
  cwd: DIST,
  stdio: 'ignore',
});
for (let i = 0; i < 50; i++) {
  try {
    const r = await fetch(`${BASE}/index.html`);
    if (r.ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 200));
  }
}

/* ── seed: sesión PIN + espejo Dexie (app_config, clientes, despachos) ── */
const seed = async () => {
  const now = new Date().toISOString();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode('1234'),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key,
    256,
  );
  const b64 = (buf) => {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (const x of b) s += String.fromCharCode(x);
    return btoa(s);
  };
  const ulid = (tag) => ('01JSMK' + '0'.repeat(17) + tag).slice(0, 26);
  const mail = 'ed.alv1098@gmail.com';
  const state = {
    hash: b64(bits),
    salt: b64(salt),
    iterations: 100000,
    attempts: 0,
    lockout_until: null,
    session: {
      email: mail,
      username: 'edalv',
      roles: ['admin'],
      refresh_token: 'smoke',
      last_active_at: now,
    },
  };

  const clienteId = ulid('CLI');
  const records = [
    {
      id: 'global',
      entity: 'app_config',
      created_at: now,
      updated_at: now,
      deleted_at: null,
      base_currency: 'USD',
      bcv_rate: 873.87,
      bcv_rate_updated_at: now,
      bcv_rate_source: 'BCV_API',
    },
    {
      id: clienteId,
      entity: 'clientes',
      created_at: now,
      updated_at: now,
      deleted_at: null,
      nombre: 'Mercado La Esquina',
      documento: 'V-12345678',
      telefono: '0414-1234567',
      telefono2: '0424-7654321',
      direccion: 'Av. Principal, casa 12, Urb. El Rosal',
      lat: 10.4806,
      lng: -66.9036,
      zona_id: ulid('ZON'),
      consentimiento: {
        fecha: now,
        foto_casa: false,
        foto_documento: false,
        aviso_documento: false,
      },
      credito_limite: 300,
      credito_dias: 30,
      score: 82,
      score_grado: 'A',
      notas_referencia: 'Paga los martes. Entrar por la calle lateral.',
      created_by: mail,
      updated_by: mail,
    },
    {
      id: ulid('ZON'),
      entity: 'zonas',
      created_at: now,
      updated_at: now,
      deleted_at: null,
      nombre: 'Zona Norte',
      municipio: 'Chacao',
      estado: 'Miranda',
      lat: 10.49,
      lng: -66.85,
      created_by: mail,
      updated_by: mail,
    },
    {
      id: ulid('DES'),
      entity: 'despachos',
      created_at: now,
      updated_at: now,
      deleted_at: null,
      nro_control: 'VTA-0001',
      cliente_id: clienteId,
      cliente_nombre: 'Mercado La Esquina',
      condicion: 'credito',
      lineas: [
        { item_id: 'ITEM01', nombre: 'Aceite vegetal 1 L', cantidad: 6, precio_unitario: 4.5 },
        { item_id: 'ITEM02', nombre: 'Arroz 5 kg', cantidad: 4, precio_unitario: 7.25 },
      ],
      subtotal: 56,
      total: 56,
      tasa_bcv: 873.87,
      estado: 'pedido',
      descuento_pct: 0,
      descuento_monto_usd: null,
      descuento_aprobado_por: null,
      descuento_pasos: null,
      promotor: 'Luis Pérez',
      supervisor: null,
      created_by: mail,
      updated_by: mail,
      editor_role: 'admin',
      entregado_at: null,
      entregado_por: null,
    },
    {
      id: ulid('DE2'),
      entity: 'despachos',
      created_at: new Date(Date.now() - 864e5 * 3).toISOString(),
      updated_at: new Date(Date.now() - 864e5 * 2).toISOString(),
      deleted_at: null,
      nro_control: 'VTA-0002',
      cliente_id: clienteId,
      cliente_nombre: 'Mercado La Esquina',
      condicion: 'contado',
      lineas: [{ item_id: 'ITEM03', nombre: 'Azúcar 1 kg', cantidad: 10, precio_unitario: 1.2 }],
      subtotal: 12,
      total: 12,
      tasa_bcv: 870,
      estado: 'entregado',
      descuento_pct: 0,
      descuento_monto_usd: null,
      descuento_aprobado_por: null,
      descuento_pasos: null,
      promotor: 'Luis Pérez',
      supervisor: null,
      created_by: mail,
      updated_by: mail,
      editor_role: 'promotor',
      entregado_at: new Date(Date.now() - 864e5 * 2).toISOString(),
      entregado_por: 'Luis Pérez',
    },
  ];

  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('briannoel-hub');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const stores = Array.from(db.objectStoreNames);
  await new Promise((res, rej) => {
    const tx = db.transaction(stores, 'readwrite');
    tx.objectStore('pin').put({ key: 'state', state });
    for (const rec of records) tx.objectStore('records').put(rec);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  db.close();
  return 'seeded';
};

/* ── helper: desbloqueo por PIN ───────────────────────────────────── */
const unlock = async (page) => {
  const input = page.locator('#pin-unlock');
  if ((await input.count()) === 0) return;
  await input.fill(PIN);
  await page.locator('form button[type="submit"]').click();
  await input.waitFor({ state: 'detached', timeout: 10000 });
};

const errors = [];
const results = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

const grab = async (ruta, archivo) => {
  await page.goto(`${BASE}/#/${ruta}`, { waitUntil: 'load' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, archivo), fullPage: true });
  results.push(archivo);
};

await page.goto(`${BASE}/#/`, { waitUntil: 'load' });
await page.waitForTimeout(1200);
console.log('seed:', await page.evaluate(seed));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(800);
await unlock(page);
await page.waitForTimeout(900);

const ventas = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('briannoel-hub');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const rows = await new Promise((res, rej) => {
    const tx = db.transaction('records', 'readonly');
    const req = tx.objectStore('records').getAll();
    req.onsuccess = () => res(req.result.map((r) => `${r.entity}:${r.id}`));
    req.onerror = () => rej(req.error);
  });
  db.close();
  return rows;
});
console.log('records:', ventas.join(', '));

const idVenta = ventas.find((r) => r.startsWith('despachos:'))?.split(':')[1];
const idCliente = ventas.find((r) => r.startsWith('clientes:'))?.split(':')[1];

/* claro */
await grab('', 'claro-01-home.png');
await grab('ventas', 'claro-02-ventas.png');
if (idVenta) await grab(`ventas/${idVenta}`, 'claro-03-venta-detalle.png');
await grab('clientes', 'claro-04-clientes.png');
if (idCliente) await grab(`clientes/${idCliente}`, 'claro-05-cliente-detalle.png');
await grab('config', 'claro-06-config.png');
await grab('config/tasa', 'claro-07-tasa.png');

/* oscuro */
await page.evaluate(() => localStorage.setItem('bh_tema', 'oscuro'));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(800);
await unlock(page);
await page.waitForTimeout(900);
await grab('', 'oscuro-01-home.png');
await grab('ventas', 'oscuro-02-ventas.png');
if (idVenta) await grab(`ventas/${idVenta}`, 'oscuro-03-venta-detalle.png');
await grab('config', 'oscuro-06-config.png');
await grab('config/tasa', 'oscuro-07-tasa.png');

const tema = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
const colorScheme = await page.evaluate(() => getComputedStyle(document.body).colorScheme);

await browser.close();
server.kill();

writeFileSync(
  join(OUT, 'report.txt'),
  [
    `data-theme: ${tema}`,
    `color-scheme: ${colorScheme}`,
    `screenshots: ${results.length}`,
    '',
    'CONSOLE ERRORS:',
    errors.length ? errors.join('\n') : '(ninguno)',
  ].join('\n'),
);

console.log('data-theme:', tema, '| color-scheme:', colorScheme);
console.log('screenshots:', results.length);
console.log(
  errors.length ? `ERRORES (${errors.length}):\n` + errors.join('\n') : 'sin errores de consola',
);
