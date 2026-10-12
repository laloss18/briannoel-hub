import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { canEditClientes, listClientes } from './clientesRepo';
import { listZonas } from './zonasRepo';
import PageShell from '../app/PageShell';
import { Icon } from '../ui/icons';
import { FilterBar, FilterChip, FilterGroup, FilterSelect, ToolbarFooter } from '../ui/filtros';
import { useSesion } from '../app/sesion';

const normaliza = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

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

  const limpiar = () => {
    setBusqueda('');
    setZona('');
    setGrado('');
  };

  return (
    <PageShell
      titulo="Clientes"
      icono="users"
      volverA="/"
      accion={
        canEdit
          ? {
              label: 'Nuevo cliente',
              icon: 'plus',
              to: '/clientes/nuevo',
              variant: 'primary',
              soloIcono: true,
            }
          : undefined
      }
    >
      <div className="flex flex-col gap-4">
        <FilterBar
          searchValue={busqueda}
          onSearchChange={setBusqueda}
          placeholder="Buscar por nombre, cédula o teléfono"
          ariaLabel="Buscar cliente"
          activos={(zona ? 1 : 0) + (grado ? 1 : 0)}
        >
          <FilterSelect label="Zona" ariaLabel="Filtrar por zona" value={zona} onChange={setZona}>
            <option value="">Todas las zonas</option>
            {(zonas ?? []).map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </FilterSelect>
          <FilterGroup label="Score">
            <FilterChip active={grado === ''} onClick={() => setGrado('')}>
              Todos
            </FilterChip>
            {['A', 'B', 'C', 'D'].map((g) => (
              <FilterChip key={g} active={grado === g} onClick={() => setGrado(g)}>
                {g}
              </FilterChip>
            ))}
          </FilterGroup>
          <ToolbarFooter
            meta={
              <>
                {filtrados.length} de {total} · {conZona} con zona
              </>
            }
            onClear={hayFiltros ? limpiar : undefined}
          />
        </FilterBar>

        {clientes && clientes.length === 0 && (
          <p className="text-xs text-fog-600">
            Todavía no hay clientes. Usa «Nuevo cliente» para dar de alta el primero.
          </p>
        )}

        {hayFiltros && filtrados.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink-700 p-6 text-center">
            <p className="text-sm text-fog-500">Ningún cliente coincide con los filtros.</p>
            <button
              type="button"
              onClick={limpiar}
              className="rounded-md border border-ink-600 px-3 py-2 text-sm font-medium text-fog-100 transition-colors hover:bg-ink-800"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        <ul className="flex flex-col gap-1.5">
          {filtrados.map((c) => {
            const z = zonas?.find((zz) => zz.id === c.zona_id);
            return (
              <li
                key={c.id}
                className="flex items-center gap-1 rounded-xl bg-ink-900 px-1.5 py-1.5"
              >
                <Link
                  to={`/clientes/${c.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-ink-800/60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-fog-100">
                      {c.nombre}
                    </span>
                    <span className="block truncate font-mono text-2xs text-fog-600">
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

                <div className="flex shrink-0 items-center gap-0.5">
                  {c.telefono && (
                    <a
                      href={`tel:${c.telefono}`}
                      aria-label={`Llamar a ${c.nombre}`}
                      title="Llamar"
                      className="btn-lift flex size-11 shrink-0 items-center justify-center rounded-full text-fog-300 transition-colors hover:bg-ok/10 hover:text-ok"
                    >
                      <Icon name="phone" className="size-4" />
                    </a>
                  )}
                  {canEdit && (
                    <Link
                      to={`/clientes/${c.id}/editar`}
                      aria-label={`Editar ${c.nombre}`}
                      title="Editar"
                      className="btn-lift flex size-11 shrink-0 items-center justify-center rounded-full text-fog-300 transition-colors hover:bg-ink-800 hover:text-fog-100"
                    >
                      <Icon name="pencil" className="size-4" />
                    </Link>
                  )}
                </div>
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
      className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-2xs tabular-nums ${
        grado === null ? 'border-ink-700 text-fog-600' : 'border-ok/40 text-fog-300'
      }`}
      title={`score ${score ?? '—'} · grado ${grado ?? '—'}`}
    >
      {grado ?? '·'}
    </span>
  );
}
