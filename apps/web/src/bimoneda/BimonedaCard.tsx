import { useLiveQuery } from 'dexie-react-hooks';
import { getAppConfig } from './appConfig';
import { hasPermission, type Role } from '@brian/shared';
import { Link } from 'react-router-dom';
import { Icon } from '../ui/icons';

interface BimonedaCardProps {
  roles: readonly Role[];
}

/**
 * Bimoneda (PRD §7.4): resumen de la moneda base y la tasa BCV de `app_config`.
 * Editar ya no es un modal: lleva a la página `#/config/tasa`, que es también la
 * pantalla del gate de entrada. Quien no tiene `view_kpis` la ve en solo lectura.
 */
export default function BimonedaCard({ roles }: BimonedaCardProps) {
  const config = useLiveQuery(() => getAppConfig(), []);
  const canEdit = hasPermission('view_kpis', roles);

  if (!config) {
    return (
      <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100">
        <p className="text-sm font-medium">Bimoneda</p>
        <p className="mt-1 text-xs text-fog-500">Inicializando configuración…</p>
      </div>
    );
  }

  const rate =
    config.bcv_rate !== undefined ? `${config.bcv_rate.toFixed(2)} Bs/USD` : 'Sin tasa configurada';
  const origen =
    config.bcv_rate_source === 'BCV_API'
      ? 'tasa oficial'
      : config.bcv_rate_source === 'manual'
        ? 'captura manual'
        : null;

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium">Bimoneda · {config.base_currency}</p>
          <p className="mt-1 truncate text-xs text-fog-500">
            Tasa BCV: <span className="font-mono tabular-nums text-fog-100">{rate}</span>
            {origen ? ` · ${origen}` : ''}
          </p>
        </div>
        <Link
          to="/config/tasa"
          aria-label="Configurar tasa BCV"
          className="flex size-11 shrink-0 items-center justify-center rounded-md border border-ink-600 text-fog-100 transition-colors hover:border-signal"
        >
          <Icon name="pencil" />
        </Link>
        {!canEdit && (
          <p className="text-[11px] text-fog-600">Solo lectura</p>
        )}
      </div>
    </div>
  );
}