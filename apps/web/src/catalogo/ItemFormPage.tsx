import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { listItems, crearItemLocal, editarItemLocal } from '../ventas/itemsRepo';
import PageShell from '../app/PageShell';
import { useEffect, useRef, useState } from 'react';

export default function ItemFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const items = useLiveQuery(() => listItems(), []);
  const item = id ? (items ?? []).find((i) => i.id === id) ?? null : null;
  const editando = Boolean(id && item);
  const [nombre, setNombre] = useState('');
  const [precioCredito, setPrecioCredito] = useState('0');
  const [precioContado, setPrecioContado] = useState('0');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Precarga una sola vez cuando el ítem llega (Dexie async); no se repite en
  // cada sync para no pisar lo que el usuario va escribiendo.
  const precargado = useRef(false);
  useEffect(() => {
    if (!item || precargado.current) return;
    precargado.current = true;
    setNombre(item.nombre);
    setPrecioCredito(item.precio_credito.toString());
    setPrecioContado(item.precio_contado.toString());
  }, [item]);

  const onGuardar = async () => {
    const pc = Number(precioCredito);
    const pco = Number(precioContado);
    if (!nombre.trim()) {
      setError('Escribe el nombre del ítem.');
      return;
    }
    if (!Number.isFinite(pc) || pc <= 0 || !Number.isFinite(pco) || pco <= 0) {
      setError('Los precios deben ser números mayores que cero.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editando && item) {
        await editarItemLocal(item, { nombre, precio_credito: pc, precio_contado: pco });
      } else {
        await crearItemLocal({ nombre, precio_credito: pc, precio_contado: pco });
      }
      navigate('/catalogo');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (id && items !== undefined && !item) {
    return (
      <PageShell titulo="Editar ítem" icono="package" volverA="/catalogo">
        <p className="text-xs text-fog-600">Ítem no encontrado.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      titulo={editando ? 'Editar ítem' : 'Nuevo ítem'}
      icono="package"
      volverA="/catalogo"
    >
      <div className="flex flex-col gap-2.5">
        <label className="flex flex-col gap-1 text-xs text-fog-500">
          Nombre del ítem *
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 outline-none transition-colors focus:border-ink-600"
          />
        </label>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-fog-500">
            Precio crédito (USD) *
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={precioCredito}
              onChange={(e) => setPrecioCredito(e.target.value)}
              className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm tabular-nums text-fog-100 outline-none transition-colors focus:border-ink-600"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fog-500">
            Precio contado (USD) *
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={precioContado}
              onChange={(e) => setPrecioContado(e.target.value)}
              className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm tabular-nums text-fog-100 outline-none transition-colors focus:border-ink-600"
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={onGuardar}
            disabled={busy}
            className="rounded-md bg-signal px-3.5 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear ítem'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/catalogo')}
            className="rounded-md border border-ink-600 px-3.5 py-2 text-sm font-medium text-fog-100 transition-colors hover:border-ink-500"
          >
            Cancelar
          </button>
        </div>
      </div>
    </PageShell>
  );
}
