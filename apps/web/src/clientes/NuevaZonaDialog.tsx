import { useState } from 'react';
import { municipiosDeEstado, VE_ESTADOS, type Zona } from '@brian/shared';
import { crearZonaLocal } from './zonasRepo';
import { CloseButton, PrimaryButton } from '../ui/actions';
import { FieldError, FormErrorSummary } from '../ui/form';
import { erroresDe, fieldAria, useFormErrors, type Validadores } from '../ui/formErrors';

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
  const { errors, fail, clear, validarCampo, summaryRef } = useFormErrors();

  if (!open) return null;

  const municipios = estado ? municipiosDeEstado(estado) : [];

  const validadores = {
    nombre: () => (nombre.trim() ? undefined : 'Escribe el nombre de la zona.'),
    estado: () => (estado ? undefined : 'Selecciona el estado al que pertenece la zona.'),
    municipio: () => (municipio ? undefined : 'Selecciona el municipio de la zona.'),
  } satisfies Validadores;

  const onGuardar = async () => {
    if (!fail(erroresDe(validadores))) return;
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
      fail({ general: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600';

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
      <div className="w-full max-w-md overscroll-contain rounded-2xl border border-ink-700 bg-ink-900 p-4 text-fog-100 shadow-popover">
        <div className="flex items-center justify-between gap-4">
          <p
            id="zona-dialog-title"
            className="font-mono text-2xs uppercase tracking-wider text-fog-500"
          >
            Nueva zona
          </p>
          <CloseButton onClick={onClose} label="Cerrar nueva zona" />
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          <FormErrorSummary errors={errors} summaryRef={summaryRef} />
          <input
            type="text"
            placeholder="Nombre de la zona *"
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
          <p className="text-2xs text-fog-500">
            El estado y el municipio quedan asociados a la zona: al elegirla para un cliente se
            muestran automáticamente.
          </p>
          <p role="status" className="text-xs text-ok">
            {message?.kind === 'ok' ? message.text : ''}
          </p>
          <PrimaryButton onClick={onGuardar} disabled={busy} size="sm">
            {busy ? 'Guardando…' : 'Crear zona'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
