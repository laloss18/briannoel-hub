import { useState } from 'react';
import { hasPermission, type Role } from '@brian/shared';
import { Link } from 'react-router-dom';
import { Icon } from '../ui/icons';
import { useTasaGate } from '../app/RequireBcvRateGate';
import { haceRelativo } from '../ui/tiempo';
import { dosDecimales } from '../lib/moneda';

interface BimonedaCardProps {
  roles: readonly Role[];
}

/**
 * Bimoneda (PRD §7.4): resumen de la tasa BCV con su origen y antigüedad.
 * Botón de refresco directo (llama a la misma cadena de fuentes que el gate);
 * el lápiz lleva a `#/config/tasa` para la captura manual y el detalle.
 */
export default function BimonedaCard({ roles }: BimonedaCardProps) {
  const { tasa, source, actualizadoEn, refrescar, refrescando } = useTasaGate();
  const canEdit = hasPermission('view_kpis', roles);
  const [aviso, setAviso] = useState<string | null>(null);

  const onRefrescar = async () => {
    setAviso(null);
    const v = await refrescar();
    setAviso(
      v === null
        ? 'Sin respuesta de la API oficial'
        : `Tasa actualizada: ${dosDecimales(v)} Bs/USD`,
    );
  };

  const origen =
    source === 'BCV_API' ? 'api oficial' : source === 'manual' ? 'captura manual' : 'sin origen';

  return (
    <div className="card-lift rounded-2xl border border-ink-700 bg-ink-900 p-4 text-fog-100 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">
            Tasa BCV · {origen}
          </p>
          <p className="mt-1 font-mono text-2xl tabular-nums text-fog-100">
            {tasa !== null ? dosDecimales(tasa) : '—'}
            <span className="ml-1.5 font-sans text-xs font-medium text-fog-500">Bs/USD</span>
          </p>
          <p className="mt-1 text-2xs text-fog-500">
            {actualizadoEn ? `actualizada ${haceRelativo(actualizadoEn)}` : 'sin actualizar aún'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => void onRefrescar()}
              disabled={refrescando}
              aria-label="Actualizar tasa desde la API oficial"
              title="Actualizar desde la API oficial"
              aria-busy={refrescando}
              className="btn-lift flex size-11 items-center justify-center rounded-full text-fog-300 transition-colors hover:bg-signal/10 hover:text-signal-strong disabled:opacity-60"
            >
              <Icon name="refresh" className={refrescando ? 'animate-spin' : undefined} />
            </button>
          )}
          <Link
            to="/config/tasa"
            aria-label="Configurar tasa BCV"
            title="Configurar tasa"
            className="btn-lift flex size-11 items-center justify-center rounded-full text-fog-300 transition-colors hover:bg-signal/10 hover:text-signal-strong"
          >
            <Icon name="pencil" />
          </Link>
        </div>
      </div>

      {aviso && (
        <p role="status" className="mt-2 text-2xs text-fog-500">
          {aviso}
        </p>
      )}
      {!canEdit && (
        <p className="mt-2 text-2xs text-fog-600">Solo lectura: tu rol no modifica la tasa.</p>
      )}
    </div>
  );
}
