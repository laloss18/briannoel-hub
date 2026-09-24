import { useEffect, useRef, useState } from 'react';
import type { Role, Zona } from '@brian/shared';
import type { NuevoClienteRepoInput } from './clientesRepo';
import { matchZona } from './clientesRepo';

/** Campos que reúne el formulario; `creado_por` lo inyecta quien lo invoca. */
export type ClienteFormInput = Omit<NuevoClienteRepoInput, 'creado_por'>;

export interface ClienteFormProps {
  open: boolean;
  onClose: () => void;
  roles: readonly Role[];
  zonas: Zona[];
  onSubmit: (form: ClienteFormInput) => Promise<void>;
}

/**
 * Alta de cliente (PRD §2.5, §3.3, §3.5): nombre + datos + geolocalización.
 * La zona se asigna de forma automática (Plus Code o haversine, módulo
 * `@brian/clientes`) y el consentimiento informado es obligatorio (§3.5).
 */
export function ClienteForm({ open, onClose, zonas, onSubmit, roles }: ClienteFormProps) {
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [fotoCasa, setFotoCasa] = useState(false);
  const [fotoDocumento, setFotoDocumento] = useState(false);
  const [avisoDocumento, setAvisoDocumento] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // En Fase 2 la edición solo la autoriza quien tenga `edit_client` (§3.2).
  const canEdit = roles.includes('admin') || roles.includes('supervisor');

  useEffect(() => {
    if (!open) return;
    setNombre('');
    setDocumento('');
    setTelefono('');
    setDireccion('');
    setLat('');
    setLng('');
    setFotoCasa(false);
    setFotoDocumento(false);
    setAvisoDocumento(false);
    setMessage(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const previewZona = () => {
    const geo = { lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null };
    const zona = matchZona(geo, zonas);
    return zona
      ? `${zona.nombre} · ${zona.municipio} (${zona.estado})`
      : 'sin coincidencia de zona';
  };

  const onClickGuardar = async () => {
    if (!nombre.trim()) {
      setMessage({ kind: 'error', text: 'El nombre es obligatorio.' });
      return;
    }
    if (!fotoCasa && !fotoDocumento) {
      setMessage({ kind: 'error', text: 'Registra el consentimiento informado (§3.5).' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await onSubmit({
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
      });
      setBusy(false);
      setMessage({ kind: 'ok', text: 'Cliente creado y encolado para sync.' });
      onClose();
    } catch (err) {
      setBusy(false);
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const inputCls =
    'w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cliente-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between gap-4">
          <p
            id="cliente-dialog-title"
            className="font-mono text-[11px] uppercase tracking-wider text-fog-500"
          >
            Nuevo cliente
          </p>
          <button
            onClick={onClose}
            aria-label="Cerrar diálogo"
            className="rounded-md px-2 py-1 font-mono text-[11px] text-fog-500 transition-colors hover:text-fog-300"
          >
            cerrar
          </button>
        </div>

        {canEdit ? (
          <div className="mt-4 flex flex-col gap-2.5">
            <input
              ref={inputRef}
              type="text"
              placeholder="Nombre *"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Documento"
                value={documento}
                onChange={(e) => setDocumento(e.target.value)}
                className={inputCls}
              />
              <input
                type="text"
                placeholder="Teléfono"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={inputCls}
              />
            </div>
            <input
              type="text"
              placeholder="Dirección"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className={inputCls}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                placeholder="Latitud (geo)"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className={inputCls}
              />
              <input
                type="number"
                step="any"
                placeholder="Longitud (geo)"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className={inputCls}
              />
            </div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-fog-700">
              zona asignada: <span className="text-signal">{previewZona()}</span>
            </p>

            <div className="mt-1 flex flex-col gap-1.5 text-xs text-fog-500">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={fotoCasa}
                  onChange={(e) => setFotoCasa(e.target.checked)}
                  className="size-3.5 accent-signal"
                />
                Consentimiento: foto de la vivienda
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={fotoDocumento}
                  onChange={(e) => setFotoDocumento(e.target.checked)}
                  className="size-3.5 accent-signal"
                />
                Foto del documento de identidad (opcional)
              </label>
              {fotoDocumento && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={avisoDocumento}
                    onChange={(e) => setAvisoDocumento(e.target.checked)}
                    className="size-3.5 accent-signal"
                  />
                  Aviso explícito del tratamiento del documento (§3.5)
                </label>
              )}
            </div>

            <button
              onClick={onClickGuardar}
              disabled={busy}
              className="mt-2 rounded-md bg-signal px-3 py-1.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft disabled:opacity-50"
            >
              {busy ? 'Guardando…' : 'Crear cliente'}
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-fog-500">
            Tu rol no puede crear clientes (§3.2: requiere edit_client).
          </p>
        )}

        <p
          role="alert"
          className={`mt-3 text-xs ${message?.kind === 'error' ? 'text-danger' : 'text-ok'}`}
        >
          {message?.text ?? ''}
        </p>
      </div>
    </div>
  );
}
