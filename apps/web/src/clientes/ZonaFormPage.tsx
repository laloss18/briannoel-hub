import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { listZonas, crearZonaLocal, editarZonaLocal } from './zonasRepo';
import PageShell from '../app/PageShell';
import { PrimaryButton, SecondaryButton } from '../ui/actions';
import { VE_ESTADOS, municipiosDeEstado } from '@brian/shared';
import { EstadoNoEncontrado } from '../app/EstadoNoEncontrado';
import { usePrecargaUnaVez, useRegistroPorId } from '../lib/hooks';
import { useState } from 'react';
import { FieldError, FormErrorSummary, inputCls } from '../ui/form';
import { erroresDe, fieldAria, useFormErrors, type Validadores } from '../ui/formErrors';

export default function ZonaFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const zonas = useLiveQuery(() => listZonas(), []);
  const { registro: zona, editando, noEncontrado } = useRegistroPorId(id, zonas);
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [busy, setBusy] = useState(false);
  const { errors, fail, clear, validarCampo, summaryRef } = useFormErrors();

  usePrecargaUnaVez(zona, (z) => {
    setNombre(z.nombre);
    setEstado(z.estado);
    setMunicipio(z.municipio);
  });

  const municipios = estado ? municipiosDeEstado(estado) : [];

  const validadores = {
    nombre: () => (nombre.trim() ? undefined : 'Escribe el nombre de la zona.'),
    estado: () => (estado ? undefined : 'Selecciona el estado al que pertenece la zona.'),
    municipio: () => (municipio ? undefined : 'Selecciona el municipio de la zona.'),
  } satisfies Validadores;

  const onGuardar = async () => {
    if (!fail(erroresDe(validadores))) return;
    setBusy(true);
    try {
      if (editando && zona) {
        await editarZonaLocal(zona, { nombre, municipio, estado });
      } else {
        await crearZonaLocal({ nombre, municipio, estado });
      }
      navigate('/zonas');
    } catch (e) {
      fail({ general: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  if (noEncontrado) {
    return <EstadoNoEncontrado titulo="Editar zona" icono="map" mensaje="Zona no encontrada." />;
  }

  return (
    <PageShell titulo={editando ? 'Editar zona' : 'Nueva zona'} icono="map">
      <div className="flex flex-col gap-2.5">
        <FormErrorSummary errors={errors} summaryRef={summaryRef} />
        <label className="flex flex-col gap-1 text-xs text-fog-500">
          Nombre de la zona *
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
        <label className="flex flex-col gap-1 text-xs text-fog-500">
          Estado *
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value);
              setMunicipio('');
              clear('estado');
              clear('municipio');
            }}
            onBlur={() => validarCampo('estado', validadores.estado())}
            className={inputCls}
            {...fieldAria('estado', errors)}
          >
            <option value="">Estado de Venezuela *</option>
            {VE_ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <FieldError name="estado" error={errors.estado} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-fog-500">
          Municipio *
          <select
            value={municipio}
            onChange={(e) => {
              setMunicipio(e.target.value);
              clear('municipio');
            }}
            onBlur={() => validarCampo('municipio', validadores.municipio())}
            disabled={!estado}
            className={`${inputCls} disabled:opacity-50`}
            {...fieldAria('municipio', errors)}
          >
            <option value="">{estado ? 'Municipio *' : 'Elige primero el estado'}</option>
            {municipios.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <FieldError name="municipio" error={errors.municipio} />
        </label>
        <div className="mt-1 flex gap-2">
          <PrimaryButton onClick={onGuardar} disabled={busy}>
            {busy ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear zona'}
          </PrimaryButton>
          <SecondaryButton onClick={() => navigate('/zonas')}>Cancelar</SecondaryButton>
        </div>
      </div>
    </PageShell>
  );
}
