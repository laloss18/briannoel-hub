import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { listClientes, canEditClientes } from './clientesRepo';
import { listZonas } from './zonasRepo';
import PageShell from '../app/PageShell';
import { useSesion } from '../app/sesion';
import { useMemo, type ReactNode } from 'react';
import { Icon } from '../ui/icons';

/**
 * Ficha del cliente (DESIGN §5.3): indicadores (score/límite/plazo) arriba,
 * acciones fijas al pie (llamar / editar) y los datos por debajo en `<dl>`.
 * La edición vive en su propia página (`#/clientes/:id/editar`, `ClienteEditarPage`),
 * así el botón atrás de Android sale del formulario sin cancelar en memoria.
 */
export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { roles } = useSesion();
  const clientes = useLiveQuery(() => listClientes(), []);
  const zonas = useLiveQuery(() => listZonas(), []);
  const cliente = useMemo(() => (clientes ?? []).find((c) => c.id === id), [clientes, id]);
  const zona = useMemo(
    () => (zonas ?? []).find((z) => z.id === cliente?.zona_id),
    [zonas, cliente],
  );
  const puedeEditar = canEditClientes(roles);

  if (clientes === undefined) {
    return (
      <PageShell eyebrow="ficha de cliente" titulo="Cargando" icono="users">
        <p className="text-sm text-fog-500">Cargando cliente…</p>
      </PageShell>
    );
  }

  if (!cliente) {
    return (
      <PageShell eyebrow="ficha de cliente" titulo="No encontrado" icono="users">
        <p className="text-sm text-fog-500">Este cliente no existe o fue eliminado.</p>
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow="ficha de cliente" titulo={cliente.nombre} icono="users">
      <div className="flex flex-col gap-4">
        {/* Indicadores: el dato de instrumento, en cifra grande */}
        <section className="rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-card">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">score</p>
              <p className="font-mono text-2xl tabular-nums text-fog-100">
                {cliente.score ?? '—'}
                <span className="ml-1 text-xs font-medium text-fog-500">/100</span>
              </p>
              <p className="text-2xs text-fog-500">
                {cliente.score_grado ? `grado ${cliente.score_grado}` : 'por calcular'}
              </p>
            </div>
            <div>
              <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">límite</p>
              <p className="font-mono text-2xl tabular-nums text-fog-100">
                US$ {cliente.credito_limite.toFixed(0)}
              </p>
              <p className="text-2xs text-fog-500">crédito</p>
            </div>
            <div>
              <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">plazo</p>
              <p className="font-mono text-2xl tabular-nums text-fog-100">
                {cliente.credito_dias}
                <span className="ml-1 text-xs font-medium text-fog-500">días</span>
              </p>
              <p className="text-2xs text-fog-500">{zona?.nombre ?? 'sin zona'}</p>
            </div>
          </div>
        </section>

        {/* Acciones rápidas: llamada + edición, al alcance del pulgar */}
        <div
          className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-ink-700 bg-ink-950/95 px-4 py-3 backdrop-blur-sm md:-mx-6 md:px-6"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          {cliente.telefono ? (
            <a
              href={`tel:${cliente.telefono}`}
              className="btn-lift inline-flex min-w-[9rem] flex-1 items-center justify-center gap-2 rounded-md border border-ok/60 bg-ok/10 px-4 py-3 text-sm font-semibold text-ok transition-colors hover:bg-ok/20"
            >
              <Icon name="phone" className="size-4 shrink-0" />
              Llamar
            </a>
          ) : (
            <p className="text-2xs text-fog-600">Sin teléfono registrado.</p>
          )}
          {puedeEditar && (
            <Link
              to={`/clientes/${cliente.id}/editar`}
              className="btn-lift inline-flex items-center justify-center gap-2 rounded-md border border-ink-600 px-4 py-3 text-sm font-semibold text-fog-100 transition-colors hover:bg-ink-800"
            >
              <Icon name="pencil" className="size-4 shrink-0" />
              Editar
            </Link>
          )}
        </div>

        <section className="rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-card">
          <h2 className="font-mono text-2xs uppercase tracking-wider text-fog-600">datos</h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Campo label="nombre">{cliente.nombre}</Campo>
            <Campo label="cédula/rif">{cliente.documento ?? '—'}</Campo>
            <Campo label="teléfono">
              {cliente.telefono ? (
                <a
                  href={`tel:${cliente.telefono}`}
                  className="underline decoration-ink-600 underline-offset-2 hover:text-signal"
                >
                  {cliente.telefono}
                </a>
              ) : (
                '—'
              )}
              {cliente.telefono2 ? ` · ${cliente.telefono2}` : ''}
            </Campo>
            <Campo label="zona">{zona?.nombre ?? '—'}</Campo>
            <Campo label="municipio/estado" className="sm:col-span-2">
              {zona && (zona.municipio || zona.estado)
                ? `${zona.municipio}${zona.estado ? `, ${zona.estado}` : ''}`
                : '—'}
            </Campo>
            <Campo label="dirección" className="sm:col-span-2">
              {cliente.direccion ?? '—'}
            </Campo>
            <Campo label="ubicación en mapa" className="sm:col-span-2">
              {cliente.lat != null && cliente.lng != null ? (
                <a
                  href={`https://www.openstreetmap.org/?mlat=${cliente.lat}&mlon=${cliente.lng}#map=17/${cliente.lat}/${cliente.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-signal underline decoration-ink-600 underline-offset-2"
                >
                  {cliente.lat.toFixed(5)}, {cliente.lng.toFixed(5)}
                </a>
              ) : (
                (cliente.plus_code ?? '—')
              )}
            </Campo>
          </dl>
        </section>

        <section className="rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-card">
          <h2 className="font-mono text-2xs uppercase tracking-wider text-fog-600">
            condiciones de crédito
          </h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Campo label="límite">US${cliente.credito_limite.toFixed(2)}</Campo>
            <Campo label="plazo">{cliente.credito_dias} días</Campo>
            <Campo label="score" className="sm:col-span-2">
              {cliente.score != null ? (
                <>
                  {cliente.score}
                  <span className="text-fog-500"> / 100</span>
                  {cliente.score_grado ? (
                    <span className="ml-1 text-ok">· {cliente.score_grado}</span>
                  ) : null}
                </>
              ) : (
                'por calcular'
              )}
            </Campo>
            <Campo label="notas" className="sm:col-span-2">
              {cliente.notas_referencia ?? '—'}
            </Campo>
          </dl>
        </section>
      </div>
    </PageShell>
  );
}

function Campo({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="font-mono text-2xs uppercase tracking-wider text-fog-600">{label}</dt>
      <dd className="text-sm text-fog-100">{children}</dd>
    </div>
  );
}
