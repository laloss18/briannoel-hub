// Utilidades compartidas por los harness de smoke (checks, smoke, demo-check).
// Todo lo que se repite entre ellos vive aquí: hash del PIN, desbloqueo,
// contexto móvil, navegación SPA y escritura del espejo Dexie.
import { webcrypto } from 'node:crypto';

export const PIN = '1234';

const b64 = (buf) =>
  Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString('base64');

/** Sesión de `StoredState` para el seed (roles y token son de prueba). */
export function sessionFor({ email, username, roles = ['admin'], token = 'smoke' }) {
  return {
    email,
    username,
    roles,
    refresh_token: token,
    last_active_at: new Date().toISOString(),
  };
}

/** Deriva el `StoredState` del PIN (PBKDF2-SHA256) fuera del navegador. */
export async function buildPinState(session, pin = PIN, iterations = 100000) {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await webcrypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return {
    hash: b64(bits),
    salt: b64(salt),
    iterations,
    attempts: 0,
    lockout_until: null,
    session,
  };
}

/** Escribe el estado del PIN y (si se pasan) registros del espejo en Dexie. */
export async function seedMirror(page, { state, records = [] }) {
  await page.evaluate(
    async ({ state, records }) => {
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
    },
    { state, records },
  );
}

/** Desbloquea el PIN si la pantalla de bloqueo está presente. */
export async function unlock(page, pin = PIN) {
  const input = page.locator('#pin-unlock');
  if ((await input.count()) === 0) return;
  await input.fill(pin);
  await page.locator('form button[type="submit"]').click();
  await input.waitFor({ state: 'detached', timeout: 10000 });
}

/** Navega en SPA por hash (sin recargar, para no re-bloquear el PIN). */
export async function nav(page, ruta) {
  await page.evaluate((h) => {
    location.hash = h;
  }, `#/${ruta}`);
}

/** Contexto Chromium móvil (390×844) con certificado autofirmado tolerado. */
export function mobileContext(browser) {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    ignoreHTTPSErrors: true,
  });
}
