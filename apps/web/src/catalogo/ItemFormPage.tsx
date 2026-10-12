import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { listItems, crearItemLocal, editarItemLocal } from '../ventas/itemsRepo';
import PageShell from '../app/PageShell';
import { PrimaryButton, SecondaryButton } from '../ui/actions';
import { EstadoNoEncontrado } from '../app/EstadoNoEncontrado';
import { usePrecargaUnaVez, useRegistroPorId } from '../lib/hooks';
import { useState } from 'react';
import { FieldError, FormErrorSummary, inputCls } from '../ui/form';
import { erroresDe, fieldAria, useFormErrors, type Validadores } from '../ui/formErrors';

export default function ItemFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const items = useLiveQuery(() => listItems(), []);
  const { registro: item, editando, noEncontrado } = useRegistroPorId(id, items);
  const [nombre, setNombre] = useState('');
  const [precioCredito, setPrecioCredito] = useState('0');
  const [precioContado, setPrecioContado] = useState('0');
  const [busy, setBusy] = useState(false);
  const { errors, fail, clear, validarCampo, summaryRef } = useFormErrors();

  usePrecargaUnaVez(item, (i) => {
    setNombre(i.nombre);
    setPrecioCredito(i.precio_credito.toString());
    setPrecioContado(i.precio_contado.toString());
  });

  const validadores = {
    nombre: () => (nombre.trim() ? undefined : 'Escribe el nombre del ítem.'),
    precioCredito: () =>
      Number.isFinite(Number(precioCredito)) && Number(precioCredito) > 0
        ? undefined
        : 'Indica un precio de crédito mayor que cero.',
    precioContado: () =>
      Number.isFinite(Number(precioContado)) && Number(precioContado) > 0
        ? undefined
        : 'Indica un precio de contado mayor que cero.',
  } satisfies Validadores;

  const onGuardar = async () => {
    const pc = Number(precioCredito);
    const pco = Number(precioContado);
    if (!fail(erroresDe(validadores))) return;
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

  if (noEncontrado) {
    return (
      <EstadoNoEncontrado titulo="Editar ítem" icono="package" mensaje="Ítem no encontrado." />
    );
  }

  return (
    <PageShell titulo={editando ? 'Editar ítem' : 'Nuevo ítem'} icono="package">
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
            onBlur={() => validarCampo('nombre', validadores.nombre())}
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
              onBlur={() => validarCampo('precioCredito', validadores.precioCredito())}
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
              onBlur={() => validarCampo('precioContado', validadores.precioContado())}
              className={`${inputCls} tabular-nums`}
              {...fieldAria('precioContado', errors)}
            />
            <FieldError name="precioContado" error={errors.precioContado} />
          </label>
        </div>
        <div className="mt-1 flex gap-2">
          <PrimaryButton onClick={onGuardar} disabled={busy}>
            {busy ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear ítem'}
          </PrimaryButton>
          <SecondaryButton onClick={() => navigate('/catalogo')}>Cancelar</SecondaryButton>
        </div>
      </div>
    </PageShell>
  );
}
