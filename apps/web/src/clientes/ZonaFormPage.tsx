import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { listZonas, crearZonaLocal, editarZonaLocal } from './zonasRepo';
import PageShell from '../app/PageShell';
import { VE_ESTADOS, municipiosDeEstado } from '@brian/shared';
import { useEffect, useRef, useState } from 'react';

export default function ZonaFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const zonas = useLiveQuery(() => listZonas(), []);
  const zona = id ? (zonas ?? []).find((z) => z.id === id) ?? null : null;
  const editando = Boolean(id && zona);
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Precarga una sola vez cuando la zona llega (Dexie async); no se repite en
  // cada sync para no pisar lo que el usuario va escribiendo.
  const precargado = useRef(false);
  useEffect(() => {
    if (!zona || precargado.current) return;
    precargado.current = true;
    setNombre(zona.nombre);
    setEstado(zona.estado);
    setMunicipio(zona.municipio);
  }, [zona]);

  const municipios = estado ? municipiosDeEstado(estado) : [];

  const onGuardar = async () => {
    if (!nombre.trim() || !estado || !municipio) {
      setError('Completa nombre, estado y municipio.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editando && zona) {
        await editarZonaLocal(zona, { nombre, municipio, estado });
      } else {
        await crearZonaLocal({ nombre, municipio, estado });
      }
      navigate('/zonas');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (id && zonas !== undefined && !zona) {
    return (
      <PageShell titulo="Editar zona" icono="map" volverA="/zonas">
        <p className="text-xs text-fog-600">Zona no encontrada.</p>
      </PageShell>
    );
  }

  return (
    <PageShell titulo={editando ? 'Editar zona' : 'Nueva zona'} icono="map" volverA="/zonas">
      <div className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1 text-xs text-fog-500">
          Nombre de la zona *
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 outline-none transition-colors focus:border-ink-600"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-fog-500">
          Estado *
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value);
              setMunicipio('');
            }}
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 outline-none transition-colors focus:border-ink-600"
          >
            <option value="">Estado de Venezuela *</option>
            {VE_ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-fog-500">
          Municipio *
          <select
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            disabled={!estado}
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 outline-none transition-colors focus:border-ink-600 disabled:opacity-50"
          >
            <option value="">{estado ? 'Municipio *' : 'Elige primero el estado'}</option>
            {municipios.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <div className="mt-1 flex gap-2">
          <button
            onClick={onGuardar}
            disabled={busy}
            className="rounded-md bg-signal px-3.5 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear zona'}
          </button>
          <button
            onClick={() => navigate('/zonas')}
            className="rounded-md border border-ink-600 px-3.5 py-2 text-sm font-medium text-fog-100 transition-colors hover:border-ink-500"
          >
            Cancelar
          </button>
        </div>
      </div>
    </PageShell>
  );
}