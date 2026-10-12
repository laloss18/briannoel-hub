import { useEffect, useState } from 'react';
import type { Personal, Role } from '@brian/shared';
import { crearPersonalLocal } from './personalRepo';
import { CloseButton, PrimaryButton } from '../ui/actions';
import { FieldError, FormErrorSummary, inputCls, labelCls } from '../ui/form';
import { erroresDe, fieldAria, useFormErrors, type Validadores } from '../ui/formErrors';

interface NuevaPersonaDialogProps {
  open: boolean;
  onClose: () => void;
  /** Email del usuario que crea (auditoría `created_by`/`updated_by`). */
  editor: string;
  /** Roles ofrecidos en el selector, según el slot del wizard de venta. */
  rolesDisponibles: readonly Role[];
  /** Rol preseleccionado al abrir. */
  rolInicial: Role;
  /** Se entrega la persona recién creada para seleccionarla al instante. */
  onCreated: (persona: Personal) => void;
}

/**
 * Alta rápida de una persona del roster (promotor/supervisor) desde el propio
 * wizard de venta, cuando no está registrada (excepción anidada como
 * `NuevaZonaDialog`, DESIGN §5.8). Sólo `manage_personal` (admin) la usa.
 */
export function NuevaPersonaDialog({
  open,
  onClose,
  editor,
  rolesDisponibles,
  rolInicial,
  onCreated,
}: NuevaPersonaDialogProps) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<Role>(rolInicial);
  const [busy, setBusy] = useState(false);
  const { errors, fail, clear, validarCampo, summaryRef, setErrors } = useFormErrors();

  useEffect(() => {
    if (!open) return;
    setNombre('');
    setTelefono('');
    setEmail('');
    setRol(rolInicial);
    setBusy(false);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rolInicial]);

  if (!open) return null;

  const validadores = {
    nombre: () => (nombre.trim() ? undefined : 'El nombre es obligatorio.'),
    email: () =>
      email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? 'Escribe un correo válido o déjalo vacío.'
        : undefined,
  } satisfies Validadores;

  const onGuardar = async () => {
    if (!fail(erroresDe(validadores))) return;
    setBusy(true);
    try {
      const persona = await crearPersonalLocal(
        {
          nombre: nombre.trim(),
          telefono: telefono.trim() || undefined,
          email: email.trim() || undefined,
          rol,
        },
        editor,
      );
      onCreated(persona);
    } catch (err) {
      fail({ general: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-dialog-title"
    >
      <div className="w-full max-w-md overscroll-contain rounded-2xl border border-ink-700 bg-ink-900 p-4 text-fog-100 shadow-popover">
        <div className="flex items-center justify-between gap-4">
          <p
            id="persona-dialog-title"
            className="font-mono text-2xs uppercase tracking-wider text-fog-500"
          >
            Nueva persona
          </p>
          <CloseButton onClick={onClose} label="Cerrar nueva persona" />
        </div>

        <div className="mt-4 flex flex-col gap-2.5">
          <FormErrorSummary errors={errors} summaryRef={summaryRef} />
          <label className={labelCls}>
            Nombre *
            <input
              type="text"
              placeholder="ej. Ana Rojas"
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
          <label className={labelCls}>
            Teléfono (opcional)
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className={labelCls}>
            Correo (opcional)
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clear('email');
              }}
              onBlur={() => validarCampo('email', validadores.email())}
              className={inputCls}
              {...fieldAria('email', errors)}
            />
            <FieldError name="email" error={errors.email} />
          </label>
          <label className={labelCls}>
            Rol en la operación
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as Role)}
              className={`${inputCls} appearance-none`}
            >
              {rolesDisponibles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <PrimaryButton onClick={onGuardar} disabled={busy} size="sm">
            {busy ? 'Guardando…' : 'Crear persona'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
