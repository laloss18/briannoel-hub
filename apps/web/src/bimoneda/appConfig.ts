import { createOutboxEntry } from '@brian/sync-engine';
import { appConfigSchema, type AppConfig, SYNC_ENTITIES } from '@brian/shared';
import { DexieLocalStore, DexieOutbox, hub } from '../sync/db';

const CONFIG_ID = 'global';

/**
 * Repo local de `app_config` (bimoneda/BCV, PRD §7.4): lee/escribe el mirror
 * Dexie como un registro de sync normal (entity 'app_config', id 'global') y lo
 * encola en el outbox para que la próxima sync lo suba (LWW por updated_at).
 */
export async function getAppConfig(): Promise<AppConfig | null> {
  const row = await hub.records
    .where('id')
    .equals(CONFIG_ID)
    .and((r) => r.entity === 'app_config')
    .first();
  if (!row) return null;
  const parsed = appConfigSchema.safeParse(row);
  return parsed.success ? parsed.data : null;
}

async function writeLocal(
  data: Omit<AppConfig, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getAppConfig();
  const entry = createOutboxEntry({
    entity: 'app_config',
    operation: existing ? 'update' : 'create',
    id: CONFIG_ID,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted_at: null,
    data,
  });
  await new DexieLocalStore().upsert('app_config', {
    id: CONFIG_ID,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    deleted_at: null,
    ...data,
  });
  await new DexieOutbox().add(entry);
}

/** Actualiza la tasa BCV (fuente automática o manual). */
export async function saveBcvRate(
  rate: number,
  bcv_rate_source: AppConfig['bcv_rate_source'],
): Promise<void> {
  const current = (await getAppConfig()) ?? { base_currency: 'USD' as const };
  await writeLocal({
    base_currency: current.base_currency ?? 'USD',
    bcv_rate: rate,
    bcv_rate_updated_at: new Date().toISOString(),
    bcv_rate_source,
  });
}

/** Crea el registro config inicial si no existe (trata de obtener la tasa BCV). */
export async function ensureAppConfig(rate: number | null): Promise<void> {
  const existing = await getAppConfig();
  if (existing) return;
  await writeLocal({
    base_currency: 'USD',
    bcv_rate: rate ?? undefined,
    bcv_rate_updated_at: rate !== null ? new Date().toISOString() : undefined,
    bcv_rate_source: rate !== null ? 'BCV_API' : undefined,
  });
}

export const APP_CONFIG_ENTITY = SYNC_ENTITIES[2]!;
