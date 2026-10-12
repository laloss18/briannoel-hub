// Tests del web: IndexedDB en memoria (fake-indexeddb) para poder ejercitar el
// espejo Dexie (`sync/db.ts`) sin navegador. Debe cargarse ANTES que cualquier
// módulo que importe `hub` (Vitest ejecuta `setupFiles` antes del test).
import 'fake-indexeddb/auto';
