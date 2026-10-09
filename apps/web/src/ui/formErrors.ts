import { useRef, useState } from 'react';

/**
 * Validación de formularios-página (DESIGN §10 "Formularios" y §12 FORMS):
 * error por campo conectado con `aria-invalid` + `aria-describedby`, y un
 * resumen `role="alert"` enfocable al tope del formulario que recibe el foco
 * tras un envío fallido (patrón de error summary de la guía UX del proyecto).
 */
export type FieldErrors = Record<string, string>;

export function useFormErrors() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const summaryRef = useRef<HTMLDivElement>(null);

  /** Aplica los errores encontrados; devuelve `true` si el formulario es válido. */
  const fail = (nuevos: FieldErrors): boolean => {
    setErrors(nuevos);
    if (Object.keys(nuevos).length === 0) return true;
    requestAnimationFrame(() => summaryRef.current?.focus());
    return false;
  };

  /** Quita el error de un campo (al reescribirlo). */
  const clear = (name: string) =>
    setErrors((prev) => {
      if (!(name in prev)) return prev;
      const siguiente = { ...prev };
      delete siguiente[name];
      return siguiente;
    });

  return { errors, fail, clear, summaryRef, setErrors };
}

/**
 * Props ARIA de un campo con error. El control debe llevar `id={name}` y, si es
 * un grupo (radios/checkboxes/fieldset), el contenedor focusable del grupo.
 */
export function fieldAria(name: string, errors: FieldErrors) {
  const invalido = Boolean(errors[name]);
  return {
    id: name,
    'aria-invalid': invalido || undefined,
    'aria-describedby': invalido ? `${name}-error` : undefined,
  } as const;
}
