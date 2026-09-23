import type { PinStore, StoredState } from '@brian/pin-auth';
import { hub } from '../sync/db';

/**
 * PinStore → Dexie (PRD §3.4 + §5.5): el estado del PIN y la sesión cacheada
 * offline viven en IndexedDB, el módulo pin-auth solo ve ports.
 */
export class DexiePinStore implements PinStore {
  async read(): Promise<StoredState | null> {
    const row = await hub.pin.get('state');
    return row?.state ?? null;
  }

  async write(state: StoredState): Promise<void> {
    await hub.pin.put({ key: 'state', state });
  }

  async clear(): Promise<void> {
    await hub.pin.delete('state');
  }
}
