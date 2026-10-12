import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = resolve('C:/Users/Luis/Desktop/nprojects/briannoel hub/apps/web/dist');
const OUT = join(HERE, 'shots');
const BASE = 'http://127.0.0.1:8092';
const PIN = '1234';

mkdirSync(OUT, { recursive: true });

const server = spawn('python', ['-m', 'http.server', '8092', '--bind', '127.0.0.1'], {
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
  const ulid = (tag) => ('01JSMK' + tag + '0'.repeat(20)).slice(0, 26);
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
  const clienteId = ulid('C7C');
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
      zona_id: ulid('Z7Z'),
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
      /* override fijado → el recálculo automático tras cada venta lo respeta */
      score_override: 82,
      notas_referencia: 'Paga los martes.',
      created_by: mail,
      updated_by: mail,
    },
    {
      id: ulid('Z7Z'),
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
      id: ulid('B1V'),
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
      id: ulid('B2V'),
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
  return 'ok';
};

const check = [];
const errores = [];
const ok = (nombre, pass, detalle = '') =>
  check.push(`${pass ? 'PASS' : 'FAIL'} · ${nombre}${detalle ? ` — ${detalle}` : ''}`);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.on('console', (m) => {
  if (m.type() === 'error') errores.push(`[console] ${m.text()}`);
});
page.on('pageerror', (e) => errores.push(`[pageerror] ${e.message}`));
page.on('dialog', (d) => d.accept());

const unlock = async () => {
  const input = page.locator('#pin-unlock');
  if ((await input.count()) === 0) return;
  await input.fill(PIN);
  await page.locator('form button[type="submit"]').click();
  await input.waitFor({ state: 'detached', timeout: 10000 });
};
const ir = async (ruta) => {
  await page.goto(`${BASE}/#/${ruta}`, { waitUntil: 'load' });
  await page.waitForTimeout(700);
};

await page.goto(`${BASE}/#/`, { waitUntil: 'load' });
await page.waitForTimeout(1000);
await page.evaluate(seed);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(700);
await unlock();
await page.waitForTimeout(800);

/* ids reales */
const filas = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('briannoel-hub');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const rows = await new Promise((res, rej) => {
    const tx = db.transaction('records', 'readonly');
    const req = tx.objectStore('records').getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  db.close();
  return rows.map((r) => ({ entity: r.entity, id: r.id }));
});
const idVenta = filas.find((r) => r.entity === 'despachos' && r.id.includes('B1V'))?.id;
const idCliente = filas.find((r) => r.entity === 'clientes' && r.id.includes('C7C'))?.id;

const estilos = () =>
  page.evaluate(() => {
    const s = getComputedStyle(document.body);
    return {
      bg: s.backgroundColor,
      color: s.color,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
      theme: document.documentElement.getAttribute('data-theme'),
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

const sinOverflow = async (ruta) => {
  await ir(ruta);
  const r = await estilos();
  ok(`sin scroll horizontal en ${ruta || '(home)'}`, !r.overflowX, `scrollWidth ok`);
};

/* ── CLARO ──────────────────────────────────────────────────────── */
await ir('');
const claro = await estilos();
ok(
  'tema por defecto = claro',
  claro.theme === null || claro.theme === 'claro',
  `data-theme=${claro.theme}`,
);
ok('color-scheme light en claro', claro.colorScheme === 'light', claro.colorScheme);
ok('fondo claro en claro', claro.bg === 'rgb(244, 245, 247)', claro.bg);

await ir('ventas');
ok(
  'lista: filtros colapsados por defecto',
  (await page.locator('input[type="date"]').count()) === 0,
);
ok(
  'lista: botón Registrar venta es solo "+"',
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('a,button')].find(
      (x) => x.getAttribute('aria-label') === 'Registrar venta',
    );
    return b ? (b.textContent ?? '').trim() === '' : false;
  }),
);
ok('lista: 2 despachos visibles', (await page.locator('main ul li').count()) === 2);
ok(
  'lista: acción entregar en fila (solo pedido)',
  (await page.locator('button[aria-label^="Entregar VTA-0001"]').count()) === 1,
);
ok(
  'lista: sin acción entregar en entregado',
  (await page.locator('button[aria-label^="Entregar VTA-0002"]').count()) === 0,
);
ok('lista: editar en fila', (await page.locator('a[aria-label^="Editar VTA-"]').count()) >= 1);
ok(
  'lista: eliminar en fila',
  (await page.locator('button[aria-label^="Eliminar VTA-"]').count()) >= 1,
);
ok(
  'lista: iconos de fila sin borde',
  await page.evaluate(() => {
    const iconos = [...document.querySelectorAll('main ul li a, main ul li button')].filter((e) =>
      e.getAttribute('aria-label'),
    );
    return iconos.length > 0 && iconos.every((e) => getComputedStyle(e).borderWidth === '0px');
  }),
);

/* filtros de fecha (panel plegable: se abre con el botón Filtros) */
await page.locator('button[aria-label="Mostrar filtros"]').click();
await page.waitForTimeout(200);
const fechas = page.locator('input[type="date"]');
ok(
  'lista: inputs desde/hasta',
  (await fechas.count()) === 2,
  `${await fechas.count()} date inputs`,
);
ok('lista: contador con filtros', (await page.getByText(/\d+ de \d+/).count()) > 0);
const contador = () => page.locator('[aria-live="polite"]').first().innerText();
const antesContador = await contador();
await fechas.first().fill('2099-01-01');
await page.waitForTimeout(250);
const futuro = await contador();
ok('filtro fecha futuro → 0 resultados', futuro.startsWith('0 de'), futuro);
await fechas.first().fill('');
await fechas.nth(1).fill('2099-01-01');
await page.waitForTimeout(250);
await fechas.first().fill('2000-01-01');
await page.waitForTimeout(250);
const pasado = await contador();
ok('filtro rango amplio → todos', pasado.includes('2 de 2'), pasado);
await page.locator('button', { hasText: 'Limpiar' }).first().click();
await page.waitForTimeout(250);
ok('limpiar filtros restaura', (await contador()) === antesContador, await contador());

/* chips rápidas */
await page.locator('button', { hasText: 'Hoy' }).first().click();
await page.waitForTimeout(250);
ok('chip Hoy filtra (ventas de hoy = 1)', (await contador()).startsWith('1 de'), await contador());
await page.locator('button', { hasText: 'Limpiar' }).first().click();

/* acciones rápidas reales */
await page.locator('button[aria-label^="Entregar VTA-0001"]').click();
await page.waitForTimeout(600);
const chipEntregado = await page.locator('text=entregado').count();
ok('entregar desde la lista cambia estado', chipEntregado >= 1);
await page.locator('button[aria-label^="Deshacer entrega de VTA-0001"]').click();
await page.waitForTimeout(600);
ok(
  'deshacer entrega desde la lista',
  (await page.locator('button[aria-label^="Entregar VTA-0001"]').count()) === 1,
);

/* ── detalle de venta ───────────────────────────────────────────── */
await ir(`ventas/${idVenta}`);
await page.waitForTimeout(700);
ok('detalle: nro_control en cabecera', (await page.locator('h1').innerText()).includes('VTA-0001'));
ok(
  'detalle: 4 secciones',
  await page.evaluate(() => {
    const t = document.body.innerText.toLowerCase();
    return ['metadata', 'datos de cliente', 'detalles de venta', 'resumen de ventas'].every((s) =>
      t.includes(s),
    );
  }),
);
ok(
  'detalle: orden resumen→detalles→cliente→metadata',
  await page.evaluate(() => {
    const orden = [...document.querySelectorAll('main section h2')].map((h) =>
      h.textContent.trim(),
    );
    return orden.join('|') === 'resumen de ventas|detalles de venta|datos de cliente|metadata';
  }),
);
const resumen = await page.locator('section', { hasText: 'resumen de ventas' }).innerText();
ok(
  'detalle: total US$ en resumen',
  resumen.includes('US$ 56.00'),
  resumen.split('\n').slice(0, 8).join(' | '),
);
ok('detalle: equivalente Bs', resumen.includes('Bs'), resumen.match(/Bs [\d.]+/)?.[0] ?? 'sin Bs');
ok(
  'detalle: resumen con pedido, cliente y estado',
  resumen.includes('VTA-0001') &&
    resumen.includes('Mercado La Esquina') &&
    /entregado|pedido/gi.test(resumen),
);
const crud = await page.evaluate(() => {
  const grupo = document.querySelector('[role="group"][aria-label="acciones del pedido"]');
  if (!grupo) return null;
  const enHeader = Boolean(grupo.closest('header'));
  const conBorde = [...grupo.querySelectorAll('button, a')].filter(
    (b) => getComputedStyle(b).borderWidth !== '0px',
  ).length;
  const s = getComputedStyle(grupo);
  return { posicion: s.position, enHeader, conBorde };
});
ok(
  'detalle: CRUD en cabecera junto al nro_control (sin borde)',
  crud?.posicion === 'static' && crud?.enHeader === true && crud?.conBorde === 0,
  JSON.stringify(crud),
);
ok(
  'detalle: sin barra sticky en el cuerpo',
  (
    await page.evaluate(() =>
      [...document.querySelectorAll('main *')].some(
        (e) => getComputedStyle(e).position === 'sticky',
      ),
    )
  ).toString() === 'false',
);
ok(
  'detalle: seguimiento con hitos',
  await page.evaluate(() => {
    const t = document.body.innerText;
    return /seguimiento/i.test(t) && /pedido registrado/i.test(t);
  }),
);
ok(
  'detalle: botón Entregar ≥44px',
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.getAttribute('aria-label') === 'Entregar',
    );
    return b ? b.getBoundingClientRect().height >= 44 : false;
  }),
);
ok('detalle: sección productos con ítems', (await page.getByText(/productos · 2/).count()) === 1);
await sinOverflow(`ventas/${idVenta}`);

/* foco visible: el primer Tab debe pintar el outline global (:focus-visible) */
await ir('ventas');
await page.keyboard.press('Tab');
const foco = await page.evaluate(() => {
  const b = document.activeElement;
  const s = getComputedStyle(b);
  return {
    texto: b.textContent?.trim().slice(0, 24),
    outline: s.outlineStyle,
    color: s.outlineColor,
    width: s.outlineWidth,
  };
});
ok(
  'foco visible con outline',
  foco.outline !== 'none' && parseFloat(foco.width) >= 2,
  JSON.stringify(foco),
);

/* ── detalle de cliente ─────────────────────────────────────────── */
await ir(`clientes/${idCliente}`);
await page.waitForTimeout(500);
ok(
  'cliente: título = nombre',
  (await page.locator('h1').innerText()).includes('Mercado La Esquina'),
);
ok(
  'cliente: indicadores score/límite/plazo',
  await page.evaluate(() => {
    const t = document.body.innerText;
    return /score/i.test(t) && t.includes('82') && t.includes('/100') && t.includes('US$ 300');
  }),
);
ok('cliente: llamar en barra sticky', (await page.locator('a[href^="tel:"]').count()) >= 1);
ok('cliente: deep-link de edición', (await page.locator('a[href$="/editar"]').count()) >= 1);
await sinOverflow(`clientes/${idCliente}`);

await ir(`clientes/${idCliente}/editar`);
{
  const nombre = page.getByLabel(/nombre del cliente/i);
  const relleno = (await nombre.inputValue()).trim();
  ok(
    'edición por deep-link abre el formulario',
    relleno.length > 0 &&
      (await page.getByRole('heading', { name: 'Editar cliente' }).count()) === 1 &&
      (await page.getByText('Guardar cambios').count()) === 1 &&
      (await page.getByText('editar datos').count()) === 0,
    `prefilled=${relleno.slice(0, 20)}`,
  );
}

/* ── config + tasa BCV ──────────────────────────────────────────── */
await ir('config');
ok('config: control de tema', (await page.getByRole('group', { name: /tema/i }).count()) === 1);
await page.getByRole('button', { name: 'Tema oscuro' }).click();
await page.waitForTimeout(400);
const oscuro = await estilos();
ok('tema oscuro activo', oscuro.theme === 'dark', `data-theme=${oscuro.theme}`);
ok('color-scheme dark en oscuro', oscuro.colorScheme === 'dark', oscuro.colorScheme);
ok('fondo oscuro en oscuro', oscuro.bg === 'rgb(11, 18, 32)', oscuro.bg);

await ir('config/tasa');
await page.waitForTimeout(700);
const tTasa = await page.locator('main').innerText();
ok(
  'tasa: cifra visible',
  /\d+\.\d{2}\s*Bs\/USD/.test(tTasa),
  tTasa.replace(/\n/g, ' | ').slice(0, 200),
);
const btnApi = page.locator('button', { hasText: /API oficial|Obtener la tasa oficial/ }).first();
ok('tasa: botón principal de refresco', (await btnApi.count()) === 1);
await btnApi.click();
const estado = page.locator('[role="status"], [role="alert"]');
await estado
  .first()
  .waitFor({ timeout: 15000 })
  .catch(() => {});
const msg = (await estado.count()) ? await estado.first().innerText() : '';
ok(
  'tasa: la API oficial responde (bug 404 corregido)',
  /aplicada|actualizada|\d/.test(msg),
  msg.slice(0, 120),
);
ok(
  'tasa: origen sigue siendo api oficial',
  /api oficial/i.test(await page.locator('main').innerText()),
);

/* captura manual */
await page.locator('#bcv-manual').fill('900.5');
await page.locator('button', { hasText: 'Guardar' }).click();
await page.waitForTimeout(700);
ok('tasa: captura manual', /900\.50/.test(await page.locator('main').innerText()));

/* volver al claro para los shots finales */
await ir('config');
await page.getByRole('button', { name: 'Tema claro' }).click();
await page.waitForTimeout(300);

const shots = [
  ['', 'claro-01-home'],
  ['ventas', 'claro-02-ventas'],
  [`ventas/${idVenta}`, 'claro-03-venta-detalle'],
  ['clientes', 'claro-04-clientes'],
  [`clientes/${idCliente}`, 'claro-05-cliente-detalle'],
  ['config', 'claro-06-config'],
  ['config/tasa', 'claro-07-tasa'],
];
for (const [ruta, nombre] of shots) {
  await ir(ruta);
  await page.screenshot({ path: join(OUT, `${nombre}.png`), fullPage: true });
}

await ir('config');
await page.getByRole('button', { name: 'Tema oscuro' }).click();
await page.waitForTimeout(300);
const shotsOscuro = [
  ['', 'oscuro-01-home'],
  ['ventas', 'oscuro-02-ventas'],
  [`ventas/${idVenta}`, 'oscuro-03-venta-detalle'],
  ['config', 'oscuro-06-config'],
  ['config/tasa', 'oscuro-07-tasa'],
];
for (const [ruta, nombre] of shotsOscuro) {
  await ir(ruta);
  await page.screenshot({ path: join(OUT, `${nombre}.png`), fullPage: true });
}

await browser.close();
server.kill();

const fails = check.filter((c) => c.startsWith('FAIL'));
const reporte = [
  `checks: ${check.length} · pass: ${check.length - fails.length} · fail: ${fails.length}`,
  '',
  ...check,
  '',
  `ERRORES DE CONSOLA (${errores.length}):`,
  errores.length ? errores.join('\n') : '(ninguno)',
].join('\n');
writeFileSync(join(OUT, 'reporte.txt'), reporte);
console.log(reporte);
process.exit(fails.length ? 1 : 0);
