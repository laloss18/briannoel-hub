/** Opción seleccionable de `PersonaSelect`: el `value` es lo que se guarda en el
 *  despacho (username del usuario o nombre del roster); `detalle` es secundario
 *  (rol/email) que solo aparece en el texto de la opción. */
export interface PersonaOpcion {
  value: string;
  detalle?: string;
}

const inputCls =
  'w-full rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600';

/** Selector de persona: las opciones SIEMPRE vienen de identidades registradas
 *  (usuarios `app_users` + roster `personal`, filtradas por rol desde el caller),
 *  nunca se puede escribir libremente. Si no hay nadie del rol pedido, muestra
 *  un estado vacío (el admin debe registrar al usuario en Configuración). */
export function PersonaSelect({
  value,
  opciones,
  placeholder,
  emptyMessage = 'No hay usuarios registrados en este rol',
  onChange,
  id,
  invalid,
  describedBy,
  onBlur,
}: {
  value: string;
  opciones: PersonaOpcion[];
  placeholder: string;
  emptyMessage?: string;
  onChange: (v: string) => void;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  onBlur?: () => void;
}) {
  const aria = {
    id,
    'aria-invalid': invalid || undefined,
    'aria-describedby': invalid ? describedBy : undefined,
  } as const;
  const resto = opciones.filter((o) => o.value !== value);
  if (opciones.length === 0) {
    return (
      <select disabled aria-label={placeholder} className={`${inputCls} opacity-60`} {...aria}>
        <option value="">{emptyMessage}</option>
      </select>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      aria-label={placeholder}
      className={`${inputCls} appearance-none`}
      {...aria}
    >
      <option value="">{placeholder}</option>
      {value && <option value={value}>{value}</option>}
      {resto.map((o) => (
        <option key={o.value} value={o.value}>
          {o.detalle ? `${o.value} · ${o.detalle}` : o.value}
        </option>
      ))}
    </select>
  );
}
