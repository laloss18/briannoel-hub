import { useEffect, useRef, useState } from 'react';
import { ROLES, type Role } from '@brian/shared';
import type { NuevaPersonalRepoInput } from './personalRepo';
import { FieldError, FormErrorSummary } from '../ui/form';
import { fieldAria, useFormErrors } from '../ui/formErrors';

export interface PersonalFormProps {
  /** Persona a editar; null = crear una nueva. */
  persona: { id: string; nombre: string; telefono?: string; email?: string; rol: Role } | null;
  onSubmit: (input: NuevaPersonalRepoInput) => Promise<void>;
  /** Se dispara tras guardar (la página navega al listado). */
  onSuccess: () => void;
}

/**
 * Alta/edición de una persona del roster (PRD §3.1) como **página** (sin
 * modal): promotores y personal de operación para asignar quién captó al
 * cliente y quién entrega. Sólo `manage_personal` (§3.2, admin). El encabezado
 * (volver + título) lo aporta `PageShell` de la página contenedora.
 */
export function PersonalForm({ persona, onSubmit, onSuccess }: PersonalFormProps) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<Role>('promotor');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const precargadoId = useRef<string | null>(null);
  const { errors, fail, clear, summaryRef, setErrors } = useFormErrors();

  useEffect(() => {
    const key = persona?.id ?? 'nuevo';
    if (precargadoId.current === key) return;
    precargadoId.current = key;
    setNombre(persona?.nombre ?? '');
    setTelefono(persona?.telefono ?? '');
    setEmail(persona?.email ?? '');
    setRol(persona?.rol ?? 'promotor');
    setBusy(false);
    setMessage(null);
    setErrors({});
    inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persona]);

  const onClickGuardar = async () => {
    const nuevos = {
      ...(nombre.trim() ? {} : { nombre: 'El nombre es obligatorio.' }),
      ...(email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? { email: 'Escribe un correo válido o déjalo vacío.' }
        : {}),
    };
    if (!fail(nuevos)) return;
    setBusy(true);
    setMessage(null);
    try {
      await onSubmit({
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
        email: email.trim() || undefined,
        rol,
      });
      setBusy(false);
      setMessage({ kind: 'ok', text: 'Persona guardada y encolada para sincronizar.' });
      onSuccess();
    } catch (err) {
      setBusy(false);
      fail({ general: err instanceof Error ? err.message : String(err) });
    }
  };

  const labelCls = 'flex flex-col gap-1 text-xs text-fog-500';
  const inputCls =
    'w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600';

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 text-fog-100">
      <FormErrorSummary errors={errors} summaryRef={summaryRef} />
      <label className={labelCls}>
        Nombre *
        <input
          ref={inputRef}
          type="text"
          placeholder="ej. Ana Rojas"
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
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <p role="status" className="min-h-4 text-xs text-ok">
        {message?.kind === 'ok' ? message.text : ''}
      </p>

      <button
        onClick={onClickGuardar}
        disabled={busy}
        className="self-start rounded-md bg-signal px-3.5 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft active:scale-[0.98] disabled:opacity-50 btn-lift cta-glow"
      >
        {busy ? 'Guardando…' : persona ? 'Guardar cambios' : 'Crear persona'}
      </button>
    </div>
  );
}
