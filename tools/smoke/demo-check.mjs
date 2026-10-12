import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(process.cwd(), 'tools', 'smoke', 'shots');
const BASE = 'https://localhost:5173';
const ROOT = 'C:/Users/Luis/Desktop/nprojects/briannoel hub';
const PIN = '1234';

const log = (...a) => console.error('[demo-check]', ...a);

mkdirSync(OUT, { recursive: true });

const startServer = () =>
  new Promise((res) => {
    const server = spawn(
      process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
      ['--filter', '@brian/web', 'dev'],
      {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      },
    );
    server.stdout.on('data', (d) => log('dev:', String(d).trim().split('\n').at(-1)));
    server.stderr.on('data', (d) => log('dev-err:', String(d).trim().split('\n').at(-1)));
    server.on('exit', (code) => log('dev salió con', code));
    res(server);
  });

const stop = (server) => {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], { stdio: 'ignore' });
    } else {
      server.kill();
    }
  } catch {
    /* noop */
  }
};

const server = await startServer();
try {
  const errors = [];

  let browser;
  for (let i = 0; i < 60; i++) {
    try {
      browser = await chromium.launch({ channel: 'chrome', headless: true });
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!browser) throw new Error('no se pudo lanzar chromium');
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`[console] ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));

  let cargado = false;
  for (let i = 0; i < 60 && !cargado; i++) {
    try {
      await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 10000 });
      cargado = true;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  if (!cargado) throw new Error('dev server no respondió al browser');
  await page.waitForTimeout(1600);

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
    const state = {
      hash: b64(bits),
      salt: b64(salt),
      iterations: 100000,
      attempts: 0,
      lockout_until: null,
      session: {
        email: 'ed.alv1098@gmail.com',
        username: 'Brián Noel Prieto',
        roles: ['admin'],
        refresh_token: 'demo-check',
        last_active_at: now,
      },
    };
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('briannoel-hub');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction('pin', 'readwrite');
      tx.objectStore('pin').put({ key: 'state', state });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
    return 'pin ok';
  };

  const unlock = async (p) => {
    const input = p.locator('#pin-unlock');
    if ((await input.count()) === 0) return;
    await input.fill(PIN);
    await p.locator('form button[type="submit"]').click();
    await input.waitFor({ state: 'detached', timeout: 10000 });
  };

  const grab = async (ruta, archivo) => {
    // Navegación SPA por hash (NO `page.goto`, que recargaría la app y su boot
    // de auth volvería a mostrar el bloqueo de PIN).
    await page.evaluate((h) => {
      location.hash = h;
    }, `#/${ruta}`);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: join(OUT, archivo), fullPage: true });
  };

  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1600);
  const recs = await page.evaluate(async () => {
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
    const porEntidad = {};
    for (const r of rows) {
      const e = r.split(':')[0];
      porEntidad[e] = (porEntidad[e] ?? 0) + 1;
    }
    db.close();
    return { total: rows.length, porEntidad, rows };
  });
  log('mirror tras auto-seed:', JSON.stringify({ total: recs.total, porEntidad: recs.porEntidad }));

  await page.evaluate(seed);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1000);
  const estadoPreUnlock = await page.evaluate(async () => ({
    hash: location.hash,
    txt: document.body.innerText.slice(0, 140).replace(/\n/g, ' | '),
  }));
  log('antes de unlock:', JSON.stringify(estadoPreUnlock));
  await unlock(page);
  await page.waitForTimeout(1200);
  const estadoPostUnlock = await page.evaluate(async () => ({
    hash: location.hash,
    txt: document.body.innerText.slice(0, 260).replace(/\n/g, ' | '),
  }));
  log('después de unlock:', JSON.stringify(estadoPostUnlock));

  const idsAppUsers = recs.rows
    .filter((r) => r.startsWith('app_users:'))
    .map((r) => r.split(':')[1]);
  const idDesp = recs.rows.find((r) => r.startsWith('despachos:'))?.split(':')[1];
  const idCli = recs.rows.find((r) => r.startsWith('clientes:'))?.split(':')[1];

  await grab('', '01-home.png');
  await grab('config', '02-config.png');
  await grab('config/usuarios', '03-usuarios.png');
  await grab('clientes', '04-clientes.png');
  if (idCli) await grab(`clientes/${idCli}`, '05-cliente-detalle.png');
  await grab('ventas', '06-ventas.png');
  if (idDesp) await grab(`ventas/${idDesp}`, '07-venta-detalle.png');
  await grab('personal', '08-personal.png');
  await grab('zonas', '09-zonas.png');
  await grab('catalogo', '10-catalogo.png');

  await page.evaluate(() => {
    location.hash = '#/config/usuarios';
  });
  await page.waitForTimeout(1300);
  const txtUsuarios = await page.locator('body').innerText();
  log('hash:', await page.evaluate(() => location.hash));
  log('texto usuarios (primeros 900):\n' + txtUsuarios.slice(0, 900));

  await browser.close();

  writeFileSync(
    join(OUT, 'report.txt'),
    [
      `mirror: ${JSON.stringify({ total: recs.total, porEntidad: recs.porEntidad })}`,
      '',
      'CONSOLE ERRORS:',
      errors.length ? errors.join('\n') : '(ninguno)',
    ].join('\n'),
  );

  const ok =
    idsAppUsers.length >= 5 &&
    txtUsuarios.includes('María Esperanza Pérez') &&
    txtUsuarios.includes('Luis Antonio Sánchez') &&
    txtUsuarios.includes('pedro.soto@example.com');
  log('app_users en mirror:', idsAppUsers.length);
  log('UsuariosPage muestra usuarios demo (incl. username con espacios y legacy):', ok);
  log(
    errors.length ? `ERRORES (${errors.length}):\n${errors.join('\n')}` : 'sin errores de consola',
  );
  process.exitCode = ok ? 0 : 1;
} finally {
  stop(server);
}
