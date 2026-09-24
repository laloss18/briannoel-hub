import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Role } from '@brian/shared';
import { canEditClientes, crearClienteLocal, listClientes } from './clientesRepo';
import { listZonas } from './zonasRepo';
import { ClienteForm } from './ClienteForm';

interface ClientesCardProps {
  roles: readonly Role[];
  /** Email del usuario de la sesión activa para auditoría created_by/updated_by (§3.1). */
  email: string;
}

/**
 * Módulo Clientes + scoring (PRD §2.5, §3.3, §3.5): tarjeta del hub con resumen
 * y alta de cliente (consentimiento + geolocalización + zona automática).
 * El score (4 factores) lo recalculan ventas/CxC en Fases 3-5; el override
 * manual solo lo autoriza quien tenga `edit_client`.
 */
export default function ClientesCard({ roles, email }: ClientesCardProps) {
  const clientes = useLiveQuery(() => listClientes(), []);
  const zonas = useLiveQuery(() => listZonas(), []);
  const [formOpen, setFormOpen] = useState(false);
  const canEdit = canEditClientes(roles);

  const total = clientes?.length ?? 0;
  const conZona = clientes?.filter((c) => c.zona_id !== null).length ?? 0;
  const zonados = zonas?.length ?? 0;

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Clientes · geolocalización + scoring</p>
          <p className="mt-1 text-xs text-fog-500">
            {total} cliente{total === 1 ? '' : 's'} · {conZona} con zona · {zonados} zonas en mirror
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setFormOpen(true)}
            className="rounded-md border border-signal px-3 py-1.5 text-sm font-medium text-signal transition-colors hover:bg-signal hover:text-ink-950"
          >
            Nuevo cliente
          </button>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {clientes && clientes.length === 0 && (
          <p className="text-xs text-fog-700">
            Sin clientes todavía. Sincroniza tras el alta para subir el registro.
          </p>
        )}
        {clientes?.map((c) => {
          const zona = zonas?.find((z) => z.id === c.zona_id);
          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-3 border-t border-ink-700/60 pt-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{c.nombre}</p>
                <p className="truncate font-mono text-[10px] text-fog-700">
                  {c.documento || 'sin documento'} ·{' '}
                  {zona ? `${zona.nombre} (${zona.municipio})` : 'sin zona'}
                </p>
              </div>
              <ScoreBadge score={c.score} grado={c.score_grado ?? null} />
            </div>
          );
        })}
      </div>

      <ClienteForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        roles={roles}
        zonas={zonas ?? []}
        onSubmit={async (form) => {
          await crearClienteLocal({ ...form, creado_por: email }, zonas ?? []);
          setFormOpen(false);
        }}
      />
    </div>
  );
}

function ScoreBadge({ score, grado }: { score: number | null; grado: string | null }) {
  return (
    <span
      className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px] tabular-nums ${
        grado === null ? 'border-ink-700 text-fog-700' : 'border-ok/40 text-fog-300'
      }`}
      title={`score ${score ?? '—'} · grado ${grado ?? '—'}`}
    >
      {grado ?? '·'}
    </span>
  );
}
