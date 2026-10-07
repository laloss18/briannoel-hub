import { useState } from 'react';
import { municipiosDeEstado, VE_ESTADOS, type Zona } from '@brian/shared';
import { crearZonaLocal } from './zonasRepo';
import { CloseButton } from '../ui/actions';

interface NuevaZonaDialogProps {
  open: boolean;
  onClose: () => void;
  /** Si se entrega, al crear la zona se cierra el diálogo y se devuelve la
   *  zona creada para que el llamador la seleccione al instante. */
  onCreated?: (zona: Zona) => void;
}

/**
 * Alta manual de zona (PRD §2.8 módulo 3): estado + municipio de Venezuela
 * (cascada) + nombre de la zona. Reutilizable desde la tarjeta de Zonas o
 * desde un formulario de registro (cliente/venta) cuando falta la zona.
 */
export function NuevaZonaDialog({ open, onClose, onCreated }: NuevaZonaDialogProps) {
  const [nombre, setNombre] = useState('');
  const [estado, setEstado] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  if (!open) return null;

  const municipios = estado ? municipiosDeEstado(estado) : [];

  const onGuardar = async () => {
    if (!nombre.trim()) {
      setMessage({ kind: 'error', text: 'Escribe el nombre de la zona.' });
      return;
    }
    if (!estado) {
      setMessage({ kind: 'error', text: 'Selecciona el estado al que pertenece la zona.' });
      return;
    }
    if (!municipio) {
      setMessage({ kind: 'error', text: 'Selecciona el municipio de la zona.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const zona = await crearZonaLocal({ nombre, municipio, estado });
      if (onCreated) {
        setNombre('');
        setMunicipio('');
        onCreated(zona);
        return;
      }
      setNombre('');
      setMunicipio('');
      setMessage({ kind: 'ok', text: 'Zona creada y encolada para sync.' });
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="zona-dialog-title"
    >
      <div className="w-full max-w-md overscroll-contain rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between gap-4">
          <p id="zona-dialog-title" className="font-mono text-[11px] uppercase tracking-wider text-fog-500">
            Nueva zona
          </p>
          <CloseButton onClick={onClose} label="Cerrar nueva zona" />
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          <input
            type="text"
            placeholder="Nombre de la zona *"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className={inputCls}
          />
          <select
            value={estado}
            onChange={(e) => {
              setEstado(e.target.value);
              setMunicipio('');
            }}
            className={inputCls}
          >
            <option value="">Estado de Venezuela *</option>
            {VE_ESTADOS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <select
            value={municipio}
            onChange={(e) => setMunicipio(e.target.value)}
            disabled={!estado}
            className={inputCls}
          >
            <option value="">{estado ? 'Municipio *' : 'Elige primero el estado'}</option>
            {municipios.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-fog-500">
            El estado y el municipio quedan asociados a la zona: al elegirla para un cliente se muestran
            automáticamente.
          </p>
          <p
            role="alert"
            className={`text-xs ${message?.kind === 'error' ? 'text-danger' : 'text-ok'}`}
          >
            {message?.text ?? ''}
          </p>
          <button
            onClick={onGuardar}
            disabled={busy}
            className="rounded-md bg-signal px-3 py-1.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Crear zona'}
          </button>
        </div>
      </div>
    </div>
  );
}