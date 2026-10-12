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

  /**
   * Valida un solo campo al salir de él (`onBlur`): muestra su error inline o lo
   * limpia si ya es válido, sin depender de un envío previo.
   */
  const validarCampo = (name: string, mensaje: string | undefined) =>
    setErrors((prev) => {
      if (!mensaje) {
        if (!(name in prev)) return prev;
        const siguiente = { ...prev };
        delete siguiente[name];
        return siguiente;
      }
      return prev[name] === mensaje ? prev : { ...prev, [name]: mensaje };
    });

  return { errors, fail, clear, validarCampo, summaryRef, setErrors };
}

/** Valida un campo y devuelve su mensaje (o `undefined` si es válido). */
export type Validador = () => string | undefined;
export type Validadores = Record<string, Validador>;

/**
 * Reúne los errores de un mapa de validadores por campo (los válidos se omiten).
 * Es la misma fuente que alimenta el resumen del envío y el `onBlur` de cada
 * campo, así el mensaje nunca diverge entre ambos caminos.
 */
export function erroresDe(validadores: Validadores): FieldErrors {
  const out: FieldErrors = {};
  for (const [name, validar] of Object.entries(validadores)) {
    const mensaje = validar();
    if (mensaje) out[name] = mensaje;
  }
  return out;
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
