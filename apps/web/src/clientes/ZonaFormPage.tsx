import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { listZonas, crearZonaLocal, editarZonaLocal } from './zonasRepo';
import PageShell from '../app/PageShell';
import { PrimaryButton, SecondaryButton } from '../ui/actions';
import { VE_ESTADOS, municipiosDeEstado } from '@brian/shared';
import { useEffect, useRef, useState } from 'react';
import { FieldError, FormErrorSummary, inputCls } from '../ui/form';
import { fieldAria, useFormErrors } from '../ui/formErrors';

export default function ZonaFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const zonas = useLiveQuery(() => listZonas(), []);
  const zona = id ? ((zonas ?? []).find((z) => z.id === id) ?? null) : null;
  const editando = Boolean(id && zona);
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [busy, setBusy] = useState(false);
  const { errors, fail, clear, summaryRef } = useFormErrors();

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
    const nuevos = {
      ...(nombre.trim() ? {} : { nombre: 'Escribe el nombre de la zona.' }),
      ...(estado ? {} : { estado: 'Selecciona el estado al que pertenece la zona.' }),
      ...(municipio ? {} : { municipio: 'Selecciona el municipio de la zona.' }),
    };
    if (!fail(nuevos)) return;
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

  if (id && zonas !== undefined && !zona) {
    return (
      <PageShell titulo="Editar zona" icono="map">
        <p className="text-xs text-fog-600">Zona no encontrada.</p>
      </PageShell>
    );
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
