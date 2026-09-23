import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ensureAppConfig, getAppConfig, saveBcvRate } from '../bimoneda/appConfig';
import { fetchBcvRate } from '../bimoneda/api';
import { hasPermission, type Role } from '@brian/shared';

interface ConfigCardProps {
  roles: readonly Role[];
}

/**
 * Bimoneda (PRD §7.4): muestra la moneda base y la tasa BCV de `app_config`,
 * permite recargarla desde la API oficial o capturarla manualmente cuando hay
 * red. Solo admin/supervisor editan (permisos §3.3 a través de hasPermission).
 */
export default function BimonedaCard({ roles }: ConfigCardProps) {
  const config = useLiveQuery(() => getAppConfig(), []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [manualRate, setManualRate] = useState('');

  const canEdit = hasPermission('view_kpis', roles);

  useEffect(() => {
    (fetchBcvRate() as Promise<number | null>).then((rate) => ensureAppConfig(rate));
  }, []);

  const onClickRefresh = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    const rate = await fetchBcvRate();
    if (rate === null) {
      setMessage('Sin red para BCV: usa captura manual.');
    } else {
      await saveBcvRate(rate, 'BCV_API');
      setMessage(`Tasa BCV actualizada: ${rate.toFixed(2)} Bs/USD`);
    }
    setBusy(false);
  }, []);

  const onClickManual = useCallback(async () => {
    const rate = Number(manualRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      setMessage('Tasa inválida.');
      return;
    }
    setBusy(true);
    setMessage(null);
    await saveBcvRate(rate, 'manual');
    setBusy(false);
    setMessage(`Tasa manual guardada: ${rate.toFixed(2)} Bs/USD`);
    setManualRate('');
  }, [manualRate]);

  if (!config) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100">
        <p className="text-sm font-medium">Bimoneda · config</p>
        <p className="mt-1 text-xs text-zinc-400">Inicializando configuración…</p>
      </div>
    );
  }

  const rate =
    config.bcv_rate !== undefined ? `${config.bcv_rate.toFixed(2)} Bs/USD` : 'Sin tasa configurada';

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-zinc-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Bimoneda · {config.base_currency}</p>
          <p className="mt-1 text-xs text-zinc-400">
            Tasa BCV: <span className="text-zinc-200">{rate}</span>
            {config.bcv_rate_source ? ` · origen: ${config.bcv_rate_source}` : ''}
          </p>
          {message && <p className="mt-1 text-xs text-emerald-400">{message}</p>}
        </div>
        {canEdit && (
          <button
            onClick={onClickRefresh}
            disabled={busy}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? 'Cargando…' : 'Actualizar BCV'}
          </button>
        )}
      </div>
      {canEdit && (
        <div className="mt-3 flex gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Tasa manual (fallback)"
            value={manualRate}
            onChange={(e) => setManualRate(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none focus:border-blue-500"
          />
          <button
            onClick={onClickManual}
            disabled={busy}
            className="rounded-md bg-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-100 hover:bg-zinc-600 disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}
