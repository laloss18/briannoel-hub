import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ensureAppConfig, getAppConfig } from '../bimoneda/appConfig';
import { fetchBcvRate } from '../bimoneda/api';
import { hasPermission, type Role } from '@brian/shared';
import BcvRateDialog from '../bimoneda/BcvRateDialog';

interface ConfigCardProps {
  roles: readonly Role[];
}

/**
 * Bimoneda (PRD §7.4): tarjeta-resumen de la moneda base y la tasa BCV de
 * `app_config`. La edición (API oficial o manual) vive en BcvRateDialog,
 * abierta desde aquí o desde las acciones rápidas del hub: una sola vía.
 */
export default function BimonedaCard({ roles }: ConfigCardProps) {
  const config = useLiveQuery(() => getAppConfig(), []);
  const [dialogOpen, setDialogOpen] = useState(false);

  const canEdit = hasPermission('view_kpis', roles);

  useEffect(() => {
    (fetchBcvRate() as Promise<number | null>).then((rate) => ensureAppConfig(rate));
  }, []);

  if (!config) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100">
        <p className="text-sm font-medium">Bimoneda · config</p>
        <p className="mt-1 text-xs text-fog-500">Inicializando configuración…</p>
      </div>
    );
  }

  const rate =
    config.bcv_rate !== undefined ? `${config.bcv_rate.toFixed(2)} Bs/USD` : 'Sin tasa configurada';

  return (
    <>
      <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Bimoneda · {config.base_currency}</p>
            <p className="mt-1 text-xs text-fog-500">
              Tasa BCV: <span className="font-mono tabular-nums text-fog-100">{rate}</span>
              {config.bcv_rate_source ? ` · origen: ${config.bcv_rate_source}` : ''}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => setDialogOpen(true)}
              className="rounded-md border border-ink-600 px-3 py-1.5 text-sm font-medium text-fog-100 transition-colors hover:border-signal"
            >
              Configurar
            </button>
          )}
        </div>
      </div>
      <BcvRateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} roles={roles} />
    </>
  );
}
