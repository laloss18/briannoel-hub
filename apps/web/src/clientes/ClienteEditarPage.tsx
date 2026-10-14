import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { editarClienteLocal, listClientes } from './clientesRepo';
import { listZonas } from './zonasRepo';
import PageShell from '../app/PageShell';
import { PrimaryButton, SecondaryButton } from '../ui/actions';
import { EstadoNoEncontrado } from '../app/EstadoNoEncontrado';
import { usePrecargaUnaVez, useRegistroPorId } from '../lib/hooks';
import { useSesion } from '../app/sesion';
import { useState } from 'react';
import { FieldError, FormErrorSummary, inputCls, labelCls } from '../ui/form';
import { erroresDe, fieldAria, useFormErrors, type Validadores } from '../ui/formErrors';
import { GeoBoton } from '../ui/geo';
import { obtenerCoords } from '../lib/geo';

/**
 * Edición de un cliente como **página** (`#/clientes/:id/editar`): el formulario
 * abre con los datos actuales como valor inicial (precarga en `useEffect` con
 * `useRef` de una sola vez, para no pisar lo que el usuario escribe durante la
 * re-sync) y al guardar navega de vuelta a la ficha. Sin vista duplicada debajo.
 */
export default function ClienteEditarPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { email } = useSesion();
  const clientes = useLiveQuery(() => listClientes(), []);
  const zonas = useLiveQuery(() => listZonas(), []);
  const { registro: cliente, noEncontrado } = useRegistroPorId(id, clientes);

  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [telefono2, setTelefono2] = useState('');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const { errors, fail, clear, validarCampo, summaryRef } = useFormErrors();

  usePrecargaUnaVez(cliente, (c) => {
    setNombre(c.nombre);
    setDocumento(c.documento ?? '');
    setTelefono(c.telefono ?? '');
    setTelefono2(c.telefono2 ?? '');
    setDireccion(c.direccion ?? '');
    setNotas(c.notas_referencia ?? '');
    setLat(c.lat != null ? String(c.lat) : '');
    setLng(c.lng != null ? String(c.lng) : '');
  });

  const usarMiUbicacion = async () => {
    setGeoBusy(true);
    const coords = await obtenerCoords();
    setGeoBusy(false);
    if (coords) {
      setLat(String(coords.lat));
      setLng(String(coords.lng));
      clear('geo');
    }
  };

  const validadores = {
    nombre: () => (nombre.trim() ? undefined : 'Escribe el nombre del cliente.'),
  } satisfies Validadores;

  const onGuardar = async () => {
    if (!cliente) return;
    if (!fail(erroresDe(validadores))) return;
    setBusy(true);
    try {
      await editarClienteLocal(cliente, email, zonas ?? [], {
        nombre,
        documento: documento || undefined,
        telefono: telefono || undefined,
        telefono2: telefono2 || undefined,
        direccion: direccion || undefined,
        notas_referencia: notas || undefined,
        lat: lat.trim() !== '' && Number.isFinite(Number(lat)) ? Number(lat) : null,
        lng: lng.trim() !== '' && Number.isFinite(Number(lng)) ? Number(lng) : null,
      });
      navigate(`/clientes/${cliente.id}`);
    } catch (e) {
      fail({ general: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  if (noEncontrado) {
    return (
      <EstadoNoEncontrado
        titulo="Editar cliente"
        icono="userPlus"
        mensaje="Cliente no encontrado."
      />
    );
  }

  if (!cliente) {
    return (
      <PageShell titulo="Editar cliente" icono="userPlus">
        <p className="text-xs text-fog-600">Cargando…</p>
      </PageShell>
    );
  }

  return (
    <PageShell titulo="Editar cliente" icono="userPlus" volverA={`/clientes/${cliente.id}`}>
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 text-fog-100">
        <FormErrorSummary errors={errors} summaryRef={summaryRef} />
        <label className={labelCls}>
          Nombre del cliente *
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className={labelCls}>
            Documento (V/RIF)
            <input
              type="text"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Teléfono (WhatsApp)
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
        <label className={labelCls}>
          Teléfono 2 (opcional)
          <input
            type="tel"
            value={telefono2}
            onChange={(e) => setTelefono2(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Dirección
          <input
            type="text"
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          Notas de referencia
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={2}
            placeholder="Puntos de referencia para llegar, horarios, etc."
            className={`${inputCls} resize-none`}
          />
        </label>

        <p className="text-2xs font-medium tracking-wide text-fog-500">Ubicación</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <div className="grid grid-cols-2 gap-2 sm:contents">
            <label className={labelCls}>
              Latitud
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className={labelCls}>
              Longitud
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className={inputCls}
              />
            </label>
          </div>
          <div className="flex items-end">
            <GeoBoton onClick={usarMiUbicacion} busy={geoBusy} />
          </div>
        </div>

        <div className="mt-1 flex gap-2">
          <PrimaryButton onClick={() => void onGuardar()} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </PrimaryButton>
          <SecondaryButton onClick={() => navigate(`/clientes/${cliente.id}`)}>
            Cancelar
          </SecondaryButton>
        </div>
      </div>
    </PageShell>
  );
}
