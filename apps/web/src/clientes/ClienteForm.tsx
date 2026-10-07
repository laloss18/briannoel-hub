import { useEffect, useRef, useState } from 'react';
import type { Role, Zona } from '@brian/shared';
import type { NuevoClienteRepoInput } from './clientesRepo';
import { matchZona } from './clientesRepo';
import { GeoBoton } from '../ui/geo';
import { CrearZonaBoton } from '../ui/zonas';
import { NuevaZonaDialog } from './NuevaZonaDialog';

/** Campos que reúne el formulario; `creado_por` lo inyecta quien lo invoca. */
export type ClienteFormInput = Omit<NuevoClienteRepoInput, 'creado_por'>;

export interface ClienteFormProps {
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
  const [direccion, setDireccion] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [zonaId, setZonaId] = useState('');
  const [zonaDialogOpen, setZonaDialogOpen] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [fotoCasa, setFotoCasa] = useState(false);
  const [fotoDocumento, setFotoDocumento] = useState(false);
  const [avisoDocumento, setAvisoDocumento] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const usarMiUbicacion = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setMessage({ kind: 'error', text: 'Tu dispositivo no tiene geolocalización.' });
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setZonaId('');
        setGeoBusy(false);
      },
      () => {
        setGeoBusy(false);
        setMessage({
          kind: 'error',
          text: 'No se pudo obtener la ubicación. Escríbela manualmente en latitud y longitud.',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  const onClickGuardar = async () => {
    if (!nombre.trim()) {
      setMessage({ kind: 'error', text: 'Escribe el nombre del cliente.' });
      return;
    }
    if (zonas.length > 0 && !zonaFinal) {
      setMessage({
        kind: 'error',
        text: 'Elige o crea la zona del cliente (se sugiere por cercanía).',
      });
      return;
    }
    if (!fotoCasa && !fotoDocumento) {
      setMessage({ kind: 'error', text: 'Marca una opción de consentimiento para continuar.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await onSubmit(
        {
          nombre,
          documento: documento || undefined,
          telefono: telefono || undefined,
          direccion: direccion || undefined,
          lat: lat ? Number(lat) : null,
          lng: lng ? Number(lng) : null,
          consentimiento: {
            fecha: new Date().toISOString(),
            foto_casa: fotoCasa,
            foto_documento: fotoDocumento,
            aviso_documento: fotoDocumento ? avisoDocumento : false,
          },
        },
        zonaFinal?.id,
      );
      setBusy(false);
      setMessage({ kind: 'ok', text: 'Cliente creado y encolado para sync.' });
      onSuccess();
    } catch (err) {
      setBusy(false);
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const labelCls = 'flex flex-col gap-1 text-xs text-fog-500';
  const inputCls =
    'w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600';

  if (!canEdit) {
    return (
      <p className="text-xs text-fog-500">
        Tu rol no tiene permiso para crear clientes. Consúltalo con tu supervisor.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 text-fog-100">
      <label className={labelCls}>
        Nombre del cliente *
        <input
          ref={inputRef}
          type="text"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={inputCls}
        />
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

      <p className="font-mono text-xs uppercase tracking-wider text-fog-500">
        Ubicación para la zona
      </p>
      <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
        <label className={labelCls}>
          Latitud
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => {
              setLat(e.target.value);
              setZonaId('');
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
            }}
            className={inputCls}
          />
        </label>
        <div className="pt-5">
          <GeoBoton onClick={usarMiUbicacion} busy={geoBusy} />
        </div>
      </div>

      <label className={labelCls}>
        Zona del cliente *
        <span className="flex items-start gap-2">
          <select
            value={zonaId || zonaMatch?.id || ''}
            onChange={(e) => setZonaId(e.target.value)}
            className={`${inputCls} min-w-0 flex-1 appearance-none`}
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
      </label>
      <p className="text-xs text-fog-500">
        Se sugiere la zona por cercanía; estado / municipio:{' '}
        <span className="text-signal">
          {zonaFinal ? `${zonaFinal.estado} · ${zonaFinal.municipio}` : 'por elegir zona'}
        </span>
      </p>

      <fieldset className="flex flex-col gap-1.5 border-t border-ink-700 pt-3 text-xs text-fog-500">
        <legend className="pr-2 font-mono text-xs uppercase tracking-wider text-fog-500">
          consentimiento (obligatorio)
        </legend>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={fotoCasa}
            onChange={(e) => setFotoCasa(e.target.checked)}
            className="size-4 accent-signal"
          />
          Foto de la vivienda
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={fotoDocumento}
            onChange={(e) => setFotoDocumento(e.target.checked)}
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
      </fieldset>

      <p
        role="alert"
        className={`min-h-4 text-xs ${message?.kind === 'error' ? 'text-danger' : 'text-ok'}`}
      >
        {message?.text ?? ''}
      </p>

      <button
        onClick={onClickGuardar}
        disabled={busy}
        className="self-start rounded-md bg-signal px-3.5 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? 'Guardando…' : 'Crear cliente'}
      </button>

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
