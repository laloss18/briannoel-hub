import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { Role, Zona } from '@brian/shared';
import type { NuevoClienteRepoInput } from './clientesRepo';
import { matchZona } from './clientesRepo';
import { GeoBoton } from '../ui/geo';
import { obtenerCoords } from '../lib/geo';
import { compressImage } from '../lib/photo';
import { MiniFoto } from '../ui/fotos';
import { CrearZonaBoton } from '../ui/zonas';
import { NuevaZonaDialog } from './NuevaZonaDialog';
import { FieldError, FormErrorSummary, inputCls, labelCls } from '../ui/form';
import { PrimaryButton } from '../ui/actions';
import { fieldAria, useFormErrors } from '../ui/formErrors';

/** Campos que reúne el formulario; `creado_por` lo inyecta quien lo invoca. */
type ClienteFormInput = Omit<NuevoClienteRepoInput, 'creado_por'>;

interface ClienteFormProps {
  roles: readonly Role[];
  zonas: Zona[];
  /** `zonaId` es la zona elegida (auto por cercanía o manual); puede ser null. */
  onSubmit: (form: ClienteFormInput, zonaId?: string | null) => Promise<void>;
  /** Se dispara tras guardar (la página navega al listado). */
  onSuccess: () => void;
}

/**
 * Alta de cliente (PRD §2.5, §3.3, §3.5) como **página** (sin modal): nombre +
 * datos + geolocalización. La zona se sugiere por cercanía (haversine, módulo
 * `@brian/clientes`) pero puede elegirse manualmente; al elegir la zona se
 * muestran detrás el estado y el municipio asociados. El consentimiento
 * informado es obligatorio (§3.5). El encabezado lo aporta `PageShell`.
 */
export function ClienteForm({ roles, zonas, onSubmit, onSuccess }: ClienteFormProps) {
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [telefono2, setTelefono2] = useState('');
  const [notas, setNotas] = useState('');
  const [direccion, setDireccion] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [zonaId, setZonaId] = useState('');
  const [zonaDialogOpen, setZonaDialogOpen] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [fotoFachada, setFotoFachada] = useState('');
  const [fotoCliente, setFotoCliente] = useState('');
  const [fotoCedula, setFotoCedula] = useState('');
  const [fotoError, setFotoError] = useState('');
  const [fotoCasa, setFotoCasa] = useState(false);
  const [fotoDocumento, setFotoDocumento] = useState(false);
  const [avisoDocumento, setAvisoDocumento] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { errors, fail, clear, summaryRef } = useFormErrors();

  // En Fase 2 la edición solo la autoriza quien tenga `edit_client` (§3.2).
  const canEdit = roles.includes('admin') || roles.includes('supervisor');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const zonaMatch = matchZona(
    { lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null },
    zonas,
  );
  const zonaFinal = zonas.find((z) => z.id === (zonaId || zonaMatch?.id || '')) ?? null;

  const usarMiUbicacion = async () => {
    setGeoBusy(true);
    const coords = await obtenerCoords();
    setGeoBusy(false);
    if (coords) {
      setLat(String(coords.lat));
      setLng(String(coords.lng));
      setZonaId('');
      clear('geo');
      return;
    }
    // Con lat/lng ya cargadas NO se avisa: el cliente ya tiene su ubicación.
    if (!lat.trim() && !lng.trim()) {
      fail({
        geo: 'No se pudo obtener la ubicación. Escríbela manualmente en latitud y longitud.',
      });
    }
  };

  const onFoto = async (e: ChangeEvent<HTMLInputElement>, set: (data: string) => void) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      set(await compressImage(file));
      setFotoError('');
    } catch {
      setFotoError('No se pudo leer la foto elegida. Intenta con otra.');
    }
  };

  const onClickGuardar = async () => {
    const hayConsentimiento = fotoCasa || fotoDocumento || fotoFachada !== '' || fotoCedula !== '';
    const nuevos = {
      ...(nombre.trim() ? {} : { nombre: 'Escribe el nombre del cliente.' }),
      ...(zonas.length > 0 && !zonaFinal
        ? { zona: 'Elige o crea la zona del cliente (se sugiere por cercanía).' }
        : {}),
      ...(hayConsentimiento
        ? {}
        : { consentimiento: 'Marca una opción de consentimiento para continuar.' }),
    };
    if (!fail(nuevos)) return;
    setBusy(true);
    setMessage(null);
    try {
      await onSubmit(
        {
          nombre,
          documento: documento || undefined,
          telefono: telefono || undefined,
          telefono2: telefono2 || undefined,
          notas_referencia: notas || undefined,
          direccion: direccion || undefined,
          lat: lat ? Number(lat) : null,
          lng: lng ? Number(lng) : null,
          foto_fachada: fotoFachada || undefined,
          foto_cliente: fotoCliente || undefined,
          foto_cedula: fotoCedula || undefined,
          consentimiento: {
            fecha: new Date().toISOString(),
            foto_casa: fotoCasa || fotoFachada !== '',
            foto_documento: fotoDocumento || fotoCedula !== '',
            aviso_documento: fotoDocumento || fotoCedula !== '' ? avisoDocumento : false,
          },
        },
        zonaFinal?.id,
      );
      setBusy(false);
      setMessage({ kind: 'ok', text: 'Cliente creado y encolado para sync.' });
      onSuccess();
    } catch (err) {
      setBusy(false);
      fail({ general: err instanceof Error ? err.message : String(err) });
    }
  };

  if (!canEdit) {
    return (
      <p className="text-xs text-fog-500">
        Tu rol no tiene permiso para crear clientes. Consúltalo con tu supervisor.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 text-fog-100">
      <FormErrorSummary errors={errors} summaryRef={summaryRef} />
      <label className={labelCls}>
        Nombre del cliente *
        <input
          ref={inputRef}
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
      <div className="grid grid-cols-2 gap-2">
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
        <label className={`${labelCls} col-span-2`}>
          Teléfono 2 (opcional)
          <input
            type="tel"
            value={telefono2}
            onChange={(e) => setTelefono2(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>
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

      <p className="font-mono text-xs uppercase tracking-wider text-fog-500">
        Ubicación para la zona
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <label className={labelCls}>
            Latitud
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => {
                setLat(e.target.value);
                setZonaId('');
                clear('geo');
              }}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Longitud
            <input
              type="number"
              step="any"
              value={lng}
              onChange={(e) => {
                setLng(e.target.value);
                setZonaId('');
                clear('geo');
              }}
              className={inputCls}
            />
          </label>
        </div>
        <div className="flex items-end">
          <GeoBoton onClick={usarMiUbicacion} busy={geoBusy} />
        </div>
      </div>

      <label className={labelCls}>
        Zona del cliente *
        <span className="flex items-start gap-2">
          <select
            value={zonaId || zonaMatch?.id || ''}
            onChange={(e) => {
              setZonaId(e.target.value);
              clear('zona');
            }}
            className={`${inputCls} min-w-0 flex-1 appearance-none`}
            {...fieldAria('zona', errors)}
          >
            <option value="">Elige una zona…</option>
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre} · {z.estado} ({z.municipio})
              </option>
            ))}
          </select>
          <CrearZonaBoton onClick={() => setZonaDialogOpen(true)} />
        </span>
        <FieldError name="zona" error={errors.zona} />
      </label>
      <p className="text-xs text-fog-500">
        Se sugiere la zona por cercanía; estado / municipio:{' '}
        <span className="text-signal">
          {zonaFinal ? `${zonaFinal.estado} · ${zonaFinal.municipio}` : 'por elegir zona'}
        </span>
      </p>

      <p className="font-mono text-xs uppercase tracking-wider text-fog-500">fotos del cliente</p>
      <MiniFoto
        titulo="Fachada de la vivienda"
        foto={fotoFachada}
        onChange={setFotoFachada}
        onError={onFoto}
      />
      <MiniFoto
        titulo="Foto del cliente"
        foto={fotoCliente}
        onChange={setFotoCliente}
        onError={onFoto}
      />
      <MiniFoto
        titulo="Cédula de identidad"
        foto={fotoCedula}
        onChange={setFotoCedula}
        onError={onFoto}
      />
      {fotoError && <p className="text-xs text-danger">{fotoError}</p>}
      <p className="text-xs text-fog-500">
        Fotos recomendadas: se comprimen en el dispositivo y viajan con el registro.
      </p>

      <fieldset
        aria-invalid={errors.consentimiento ? true : undefined}
        aria-describedby={errors.consentimiento ? 'consentimiento-error' : undefined}
        className="flex flex-col gap-1.5 border-t border-ink-700 pt-3 text-xs text-fog-500"
      >
        <legend className="pr-2 font-mono text-xs uppercase tracking-wider text-fog-500">
          consentimiento (obligatorio)
        </legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={fotoCasa}
            onChange={(e) => {
              setFotoCasa(e.target.checked);
              clear('consentimiento');
            }}
            className="size-4 accent-signal"
          />
          Foto de la vivienda
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={fotoDocumento}
            onChange={(e) => {
              setFotoDocumento(e.target.checked);
              clear('consentimiento');
            }}
            className="size-4 accent-signal"
          />
          Foto del documento de identidad (opcional)
        </label>
        {fotoDocumento && (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={avisoDocumento}
              onChange={(e) => setAvisoDocumento(e.target.checked)}
              className="size-4 accent-signal"
            />
            El cliente fue informado del tratamiento del documento
          </label>
        )}
        <FieldError name="consentimiento" error={errors.consentimiento} />
      </fieldset>

      <p
        role="status"
        className={`min-h-4 text-xs ${message?.kind === 'ok' ? 'text-ok' : 'text-danger'}`}
      >
        {message?.text ?? ''}
      </p>

      <PrimaryButton onClick={onClickGuardar} disabled={busy} className="self-start">
        {busy ? 'Guardando…' : 'Crear cliente'}
      </PrimaryButton>

      <NuevaZonaDialog
        open={zonaDialogOpen}
        onClose={() => setZonaDialogOpen(false)}
        onCreated={(z) => {
          setZonaId(z.id);
          setZonaDialogOpen(false);
        }}
      />
    </div>
  );
}
