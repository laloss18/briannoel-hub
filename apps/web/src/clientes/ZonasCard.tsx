import { useLiveQuery } from 'dexie-react-hooks';
import { listZonas } from './zonasRepo';

/**
 * Módulo Zonas (PRD §2.8 módulo 3): zona → municipio → estado. En Fase 2 las
 * zonas llegan desde el servidor (backfill 0004 Carabobo/Aragua) por delta;
 * aquí se muestran para verificar que el mirror local las tiene.
 */
export default function ZonasCard() {
  const zonas = useLiveQuery(() => listZonas(), []);

  const total = zonas?.length ?? 0;
  const conGeo = zonas?.filter((z) => z.lat !== null && z.lng !== null).length ?? 0;
  const estados = new Set(zonas?.map((z) => z.estado) ?? []).size;

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100">
      <div>
        <p className="text-sm font-medium">Zonas · reparto</p>
        <p className="mt-1 text-xs text-fog-500">
          {total} zonas · {conGeo} con geo · {estados} estado{estados === 1 ? '' : 's'}
        </p>
      </div>

      <div className="mt-4 flex max-h-64 flex-col gap-2 overflow-y-auto">
        {zonas && zonas.length === 0 && (
          <p className="text-xs text-fog-700">
            El mirror no tiene zonas aún. Sincroniza para bajar el backfill (0004).
          </p>
        )}
        {zonas?.map((z) => (
          <div
            key={z.id}
            className="flex items-center justify-between gap-3 border-t border-ink-700/60 pt-2"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{z.nombre}</p>
              <p className="truncate font-mono text-[10px] text-fog-700">
                {z.municipio} · {z.estado}
              </p>
            </div>
            <span
              className={`font-mono text-[10px] uppercase tracking-wider ${
                z.lat !== null && z.lng !== null ? 'text-ok' : 'text-fog-700'
              }`}
            >
              {z.lat !== null && z.lng !== null ? 'geo' : 'sin geo'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
