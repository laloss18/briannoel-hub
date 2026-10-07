import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { listClientes, editarClienteLocal } from './clientesRepo';
import { listZonas } from './zonasRepo';
import PageShell from '../app/PageShell';
import { useSesion } from '../app/sesion';
import { useMemo, useState } from 'react';

export default function ClienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { email } = useSesion();
  const clientes = useLiveQuery(() => listClientes(), []);
  const zonas = useLiveQuery(() => listZonas(), []);
  const cliente = useMemo(() => (clientes ?? []).find((c) => c.id === id), [clientes, id]);
  const zona = useMemo(() => (zonas ?? []).find((z) => z.id === cliente?.zona_id), [zonas, cliente]);
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(cliente?.nombre ?? '');
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '');
  const [busy, setBusy] = useState(false);

  if (clientes === undefined) {
    return (
      <PageShell titulo="Ficha de cliente" icono="users" volverA="/clientes">
        <p className="text-xs text-fog-600">Cargando…</p>
      </PageShell>
    );
  }

  if (!cliente) {
    return (
      <PageShell titulo="Ficha de cliente" icono="users" volverA="/clientes">
        <p className="text-xs text-fog-600">Cliente no encontrado.</p>
      </PageShell>
    );
  }

  const onGuardar = async () => {
    setBusy(true);
    try {
      await editarClienteLocal(cliente, email, zonas ?? [], { nombre, telefono });
      setEditando(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell
      titulo={cliente.nombre}
      icono="users"
      volverA="/clientes"
      accion={
        editando
          ? undefined
          : {
              label: 'Editar',
              icon: 'pencil',
              onClick: () => {
                setNombre(cliente.nombre);
                setTelefono(cliente.telefono ?? '');
                setEditando(true);
              },
            }
      }
    >
      <div className="flex flex-col gap-4">
        <section className="rounded-md border border-ink-700/60 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-fog-100">Datos</p>
          <div className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">nombre</span>
              <span className="text-sm text-fog-100">{cliente.nombre}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">cédula/rif</span>
              <span className="text-sm text-fog-100">{cliente.documento ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">teléfono</span>
              <span className="text-sm text-fog-100">
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
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">zona</span>
              <span className="text-sm text-fog-100">{zona?.nombre ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">ubicación</span>
              <span className="text-sm text-fog-100">
                {zona && (zona.municipio || zona.estado)
                  ? `${zona.municipio}${zona.estado ? `, ${zona.estado}` : ''}`
                  : '—'}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">dirección</span>
              <span className="text-sm text-fog-100">{cliente.direccion ?? '—'}</span>
            </div>
            <div className="flex flex-col gap-0.5 sm:col-span-2">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">ubicación en mapa</span>
              <span className="text-sm text-fog-100">
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
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-ink-700/60 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-fog-100">Condiciones de crédito</p>
          <div className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">límite</span>
              <span className="text-sm text-fog-100">US${cliente.credito_limite.toFixed(2)}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">plazo</span>
              <span className="text-sm text-fog-100">{cliente.credito_dias} días</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">score</span>
              <span className="text-sm text-fog-100">
                {cliente.score != null ? (
                  <>
                    {cliente.score}
                    <span className="text-fog-500"> / 100</span>
                    {cliente.score_grado ? <span className="ml-1 text-ok">· {cliente.score_grado}</span> : null}
                  </>
                ) : (
                  'por calcular'
                )}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xs uppercase tracking-wider text-fog-500">notas</span>
              <span className="text-sm text-fog-100">{cliente.notas_referencia ?? '—'}</span>
            </div>
          </div>
        </section>

        {editando && (
          <section className="rounded-md border border-signal/40 p-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-fog-100">Editar datos</p>
            <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-fog-500">
                Nombre *
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 outline-none transition-colors focus:border-ink-600"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-fog-500">
                Teléfono
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 outline-none transition-colors focus:border-ink-600"
                />
              </label>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onGuardar}
                disabled={busy || !nombre.trim()}
                className="rounded-md bg-signal px-3.5 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? 'Guardando…' : 'Guardar'}
              </button>
              <button
                onClick={() => setEditando(false)}
                className="rounded-md border border-ink-600 px-3.5 py-2 text-sm font-medium text-fog-100 transition-colors hover:border-ink-500"
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