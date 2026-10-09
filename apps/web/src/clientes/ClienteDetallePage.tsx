import { useParams, useMatch, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { listClientes, editarClienteLocal, canEditClientes } from './clientesRepo';
import { listZonas } from './zonasRepo';
import PageShell from '../app/PageShell';
import { useSesion } from '../app/sesion';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Icon } from '../ui/icons';
import { GeoBoton, AbrirMapa } from '../ui/geo';
import { obtenerCoords } from '../lib/geo';

/**
 * Ficha del cliente (DESIGN §5.3): indicadores (score/límite/plazo) arriba,
 * acciones fijas al pie (llamar / editar) y los datos por debajo en `<dl>`.
 * `#/clientes/:id/editar` abre el modo edición con el deep-link, así que el botón
 * atrás de Android sale del formulario sin cancelar en memoria. La edición
 * cubre los datos principales y la geo (la zona se reasigna sola, §3.3).
 */
export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const matchEdicion = useMatch('/clientes/:id/editar');
  const navigate = useNavigate();
  const { roles, email } = useSesion();
  const clientes = useLiveQuery(() => listClientes(), []);
  const zonas = useLiveQuery(() => listZonas(), []);
  const cliente = useMemo(() => (clientes ?? []).find((c) => c.id === id), [clientes, id]);
  const zona = useMemo(() => (zonas ?? []).find((z) => z.id === cliente?.zona_id), [zonas, cliente]);
  const puedeEditar = canEditClientes(roles);
  const [editando, setEditando] = useState(matchEdicion !== null);
  const [nombre, setNombre] = useState(cliente?.nombre ?? '');
  const [documento, setDocumento] = useState(cliente?.documento ?? '');
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '');
  const [telefono2, setTelefono2] = useState(cliente?.telefono2 ?? '');
  const [direccion, setDireccion] = useState(cliente?.direccion ?? '');
  const [notas, setNotas] = useState(cliente?.notas_referencia ?? '');
  const [lat, setLat] = useState(cliente?.lat != null ? String(cliente.lat) : '');
  const [lng, setLng] = useState(cliente?.lng != null ? String(cliente.lng) : '');
  const [geoBusy, setGeoBusy] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEditando(matchEdicion !== null);
    if (matchEdicion && cliente) {
      setNombre(cliente.nombre);
      setDocumento(cliente.documento ?? '');
      setTelefono(cliente.telefono ?? '');
      setTelefono2(cliente.telefono2 ?? '');
      setDireccion(cliente.direccion ?? '');
      setNotas(cliente.notas_referencia ?? '');
      setLat(cliente.lat != null ? String(cliente.lat) : '');
      setLng(cliente.lng != null ? String(cliente.lng) : '');
    }
  }, [matchEdicion, cliente]);

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

  const onGuardar = async () => {
    setBusy(true);
    try {
      await editarClienteLocal(cliente, email, zonas ?? [], {
        nombre,
        documento,
        telefono,
        telefono2,
        direccion,
        notas_referencia: notas,
        lat: lat.trim() !== '' && Number.isFinite(Number(lat)) ? Number(lat) : null,
        lng: lng.trim() !== '' && Number.isFinite(Number(lng)) ? Number(lng) : null,
      });
      navigate(`/clientes/${cliente.id}`);
    } finally {
      setBusy(false);
    }
  };

  const onCancelar = () => navigate(`/clientes/${cliente.id}`);

  const usarMiUbicacion = async () => {
    setGeoBusy(true);
    const coords = await obtenerCoords();
    setGeoBusy(false);
    if (!coords) return;
    setLat(String(coords.lat));
    setLng(String(coords.lng));
  };

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
              <p className="text-2xs text-fog-500">{cliente.score_grado ? `grado ${cliente.score_grado}` : 'por calcular'}</p>
            </div>
            <div>
              <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">límite</p>
              <p className="font-mono text-2xl tabular-nums text-fog-100">US$ {cliente.credito_limite.toFixed(0)}</p>
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
          {puedeEditar && !editando && (
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
                <a href={`tel:${cliente.telefono}`} className="underline decoration-ink-600 underline-offset-2 hover:text-signal">
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
            <Campo label="dirección" className="sm:col-span-2">{cliente.direccion ?? '—'}</Campo>
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
                cliente.plus_code ?? '—'
              )}
            </Campo>
          </dl>
        </section>

        <section className="rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-card">
          <h2 className="font-mono text-2xs uppercase tracking-wider text-fog-600">condiciones de crédito</h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Campo label="límite">US${cliente.credito_limite.toFixed(2)}</Campo>
            <Campo label="plazo">{cliente.credito_dias} días</Campo>
            <Campo label="score" className="sm:col-span-2">
              {cliente.score != null ? (
                <>
                  {cliente.score}
                  <span className="text-fog-500"> / 100</span>
                  {cliente.score_grado ? <span className="ml-1 text-ok">· {cliente.score_grado}</span> : null}
                </>
              ) : (
                'por calcular'
              )}
            </Campo>
            <Campo label="notas" className="sm:col-span-2">{cliente.notas_referencia ?? '—'}</Campo>
          </dl>
        </section>

        {editando && (
          <section className="rounded-xl border border-signal/50 bg-ink-900 p-4 shadow-card">
            <h2 className="font-mono text-2xs uppercase tracking-wider text-fog-600">editar datos</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-fog-500">
                Nombre *
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-signal"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fog-500">
                Cédula/RIF
                <input
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  className="rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-signal"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fog-500">
                Teléfono
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  inputMode="tel"
                  className="rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-signal"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fog-500">
                Teléfono 2
                <input
                  value={telefono2}
                  onChange={(e) => setTelefono2(e.target.value)}
                  inputMode="tel"
                  className="rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-signal"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fog-500 sm:col-span-2">
                Dirección
                <input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-signal"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fog-500 sm:col-span-2">
                Notas de referencia
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={2}
                  className="rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-signal"
                />
              </label>
              <div className="flex items-end gap-2 sm:col-span-2">
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-fog-500">
                  Latitud
                  <input
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    inputMode="decimal"
                    placeholder={cliente.lat != null ? String(cliente.lat) : '10.48…'}
                    className="w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-signal"
                  />
                </label>
                <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-fog-500">
                  Longitud
                  <input
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    inputMode="decimal"
                    placeholder={cliente.lng != null ? String(cliente.lng) : '-66.90…'}
                    className="w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-signal"
                  />
                </label>
                <GeoBoton onClick={usarMiUbicacion} busy={geoBusy} label="usar mi ubicación" />
                {lat.trim() !== '' && lng.trim() !== '' && (
                  <AbrirMapa lat={Number(lat)} lng={Number(lng)} />
                )}
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void onGuardar()}
                disabled={busy || !nombre.trim()}
                className="btn-lift cta-glow rounded-md bg-signal px-4 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={onCancelar}
                className="btn-lift rounded-md border border-ink-600 px-4 py-2.5 text-sm font-medium text-fog-100 transition-colors hover:bg-ink-800"
              >
                Cancelar
              </button>
            </div>
          </section>
        )}
      </div>
    </PageShell>
  );
}

function Campo({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="font-mono text-2xs uppercase tracking-wider text-fog-600">{label}</dt>
      <dd className="text-sm text-fog-100">{children}</dd>
    </div>
  );
}
