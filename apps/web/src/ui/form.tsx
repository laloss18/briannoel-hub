import type { RefObject } from 'react';
import type { FieldErrors } from './formErrors';

/** Clase base de un campo de formulario (input / select / textarea). */
export const inputCls =
  'w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600';

/** Clase de la `<label>` que envuelve a un campo y su mensaje de error. */
export const labelCls = 'flex flex-col gap-1 text-xs text-fog-500';

/** Mensaje de error inline bajo el campo, referenciado por `fieldAria`. */
export function FieldError({ name, error }: { name: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${name}-error`} className="text-2xs text-danger">
      {error}
    </p>
  );
}

/** Resumen de errores (role="alert", enfocable) al tope del formulario. */
export function FormErrorSummary({
  errors,
  summaryRef,
}: {
  errors: FieldErrors;
  summaryRef: RefObject<HTMLDivElement | null>;
}) {
  const mensajes = [...new Set(Object.values(errors))];
  if (mensajes.length === 0) return null;
  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      role="alert"
      aria-labelledby="form-error-title"
      className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger outline-none"
    >
      <p id="form-error-title" className="font-medium">
        Revisa el formulario
      </p>
      <ul className="mt-1 list-disc pl-4">
        {mensajes.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
