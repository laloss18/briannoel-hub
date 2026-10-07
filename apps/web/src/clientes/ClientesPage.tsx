import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { canEditClientes, listClientes } from './clientesRepo';
import { listZonas } from './zonasRepo';
import PageShell from '../app/PageShell';
import { ActionButton } from '../ui/actions';
import { useSesion } from '../app/sesion';

const normaliza = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/**
 * Sección Clientes (PRD §2.5): listado con filtros compactos (búsqueda, zona,
 * grado). Clic en un cliente → su ficha (`#/clientes/:id`); el alta vive en
 * `#/clientes/nuevo`. Todo es navegación, nada de overlays.
 */
export default function ClientesPage() {
  const { roles } = useSesion();
  const clientes = useLiveQuery(() => listClientes(), []);
  const zonas = useLiveQuery(() => listZonas(), []);
  const [busqueda, setBusqueda] = useState('');
  const [zona, setZona] = useState('');
  const [grado, setGrado] = useState('');

  const canEdit = canEditClientes(roles);
  const total = clientes?.length ?? 0;
  const conZona = clientes?.filter((c) => c.zona_id !== null).length ?? 0;
  const hayFiltros = busqueda !== '' || zona !== '' || grado !== '';

  const termino = normaliza(busqueda.trim());
  const filtrados = useMemo(
    () =>
      (clientes ?? [])
        .filter((c) => {
          if (zona && c.zona_id !== zona) return false;
          if (grado && (c.score_grado ?? '') !== grado) return false;
          if (
            termino &&
            !normaliza(c.nombre).includes(termino) &&
            !(c.documento ?? '').toLowerCase().includes(termino) &&
            !(c.telefono ?? '').toLowerCase().includes(termino)
          )
            return false;
          return true;
        })
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [clientes, zona, grado, termino],
  );

  const inputCls =
    'rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-fog-100 outline-none transition-colors placeholder:text-fog-600 focus:border-ink-600';
  const selectCls =
    'rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-xs text-fog-100 outline-none transition-colors focus:border-ink-600';

  return (
    <PageShell
      titulo="Clientes"
      icono="users"
      volverA="/"
      accion={canEdit ? { label: 'Nuevo cliente', icon: 'userPlus', to: '/clientes/nuevo' } : undefined}
    >
      <div className="flex flex-col gap-4">
        <p className="font-mono text-xs tabular-nums text-fog-500">
          {total} cliente{total === 1 ? '' : 's'} · {conZona} con zona ·{' '}
          {zonas?.length ?? 0} zonas
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="search"
            placeholder="Buscar por nombre, cédula o teléfono"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar cliente"
            className={`${inputCls} min-w-44 flex-1`}
          />
          <select
            aria-label="Filtrar por zona"
            value={zona}
            onChange={(e) => setZona(e.target.value)}
            className={selectCls}
          >
            <option value="">zona</option>
            {(zonas ?? []).map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por score"
            value={grado}
            onChange={(e) => setGrado(e.target.value)}
            className={selectCls}
          >
            <option value="">score</option>
            {['A', 'B', 'C', 'D'].map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          {hayFiltros && (
            <ActionButton
              label="Limpiar"
              icon="clear"
              onClick={() => {
                setBusqueda('');
                setZona('');
                setGrado('');
              }}
            />
          )}
        </div>

        {clientes && clientes.length === 0 && (
          <p className="border-t border-ink-700/60 pt-3 text-xs text-fog-600">
            Todavía no hay clientes. Usa «Nuevo cliente» para dar de alta el primero.
          </p>
        )}

        {hayFiltros && filtrados.length > 0 && (
          <p className="font-mono text-xs tabular-nums text-fog-600">
            {filtrados.length} de {total}
          </p>
        )}

        <ul className="flex flex-col divide-y divide-ink-700/60 border-y border-ink-700/60">
          {filtrados.map((c) => {
            const z = zonas?.find((zz) => zz.id === c.zona_id);
            return (
              <li key={c.id}>
                <Link
                  to={`/clientes/${c.id}`}
                  className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-ink-950/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-fog-100">
                      {c.nombre}
                    </span>
                    <span className="block truncate font-mono text-xs text-fog-500">
                      {c.documento || 'sin documento'} ·{' '}
                      {z ? `${z.nombre} · ${z.estado} (${z.municipio})` : 'sin zona'}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <ScoreBadge score={c.score} grado={c.score_grado ?? null} />
                    <span className="font-mono text-xs tabular-nums text-fog-500">
                      US${c.credito_limite.toFixed(2)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </PageShell>
  );
}

function ScoreBadge({ score, grado }: { score: number | null; grado: string | null }) {
  return (
    <span
      className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px] tabular-nums ${
        grado === null ? 'border-ink-700 text-fog-600' : 'border-ok/40 text-fog-300'
      }`}
      title={`score ${score ?? '—'} · grado ${grado ?? '—'}`}
    >
      {grado ?? '·'}
    </span>
  );
}