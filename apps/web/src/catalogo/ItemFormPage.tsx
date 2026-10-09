import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { listItems, crearItemLocal, editarItemLocal } from '../ventas/itemsRepo';
import PageShell from '../app/PageShell';
import { useEffect, useRef, useState } from 'react';
import { FieldError, FormErrorSummary } from '../ui/form';
import { fieldAria, useFormErrors } from '../ui/formErrors';

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
  const { errors, fail, clear, summaryRef } = useFormErrors();

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
    const nuevos = {
      ...(nombre.trim() ? {} : { nombre: 'Escribe el nombre del ítem.' }),
      ...(Number.isFinite(pc) && pc > 0 ? {} : { precioCredito: 'Indica un precio de crédito mayor que cero.' }),
      ...(Number.isFinite(pco) && pco > 0 ? {} : { precioContado: 'Indica un precio de contado mayor que cero.' }),
    };
    if (!fail(nuevos)) return;
    setBusy(true);
    try {
      if (editando && item) {
        await editarItemLocal(item, { nombre, precio_credito: pc, precio_contado: pco });
      } else {
        await crearItemLocal({ nombre, precio_credito: pc, precio_contado: pco });
      }
      navigate('/catalogo');
    } catch (e) {
      fail({ general: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  if (id && items !== undefined && !item) {
    return (
      <PageShell titulo="Editar ítem" icono="package">
        <p className="text-xs text-fog-600">Ítem no encontrado.</p>
      </PageShell>
    );
  }

  const inputCls =
    'w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600';

  return (
    <PageShell
      titulo={editando ? 'Editar ítem' : 'Nuevo ítem'}
      icono="package"
    >
      <div className="flex flex-col gap-2.5">
        <FormErrorSummary errors={errors} summaryRef={summaryRef} />
        <label className="flex flex-col gap-1 text-xs text-fog-500">
          Nombre del ítem *
          <input
            type="text"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              clear('nombre');
            }}
            className={inputCls}
            {...fieldAria('nombre', errors)}
          />
          <FieldError name="nombre" error={errors.nombre} />
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
              onChange={(e) => {
                setPrecioCredito(e.target.value);
                clear('precioCredito');
              }}
              className={`${inputCls} tabular-nums`}
              {...fieldAria('precioCredito', errors)}
            />
            <FieldError name="precioCredito" error={errors.precioCredito} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-fog-500">
            Precio contado (USD) *
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={precioContado}
              onChange={(e) => {
                setPrecioContado(e.target.value);
                clear('precioContado');
              }}
              className={`${inputCls} tabular-nums`}
              {...fieldAria('precioContado', errors)}
            />
            <FieldError name="precioContado" error={errors.precioContado} />
          </label>
        </div>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            onClick={onGuardar}
            disabled={busy}
            className="rounded-md bg-signal px-3.5 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft active:scale-[0.98] disabled:opacity-50 btn-lift cta-glow"
          >
            {busy ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear ítem'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/catalogo')}
            className="btn-lift rounded-md border border-ink-600 px-3.5 py-2 text-sm font-medium text-fog-100 transition-colors hover:border-ink-500"
          >
            Cancelar
          </button>
        </div>
      </div>
    </PageShell>
  );
}
