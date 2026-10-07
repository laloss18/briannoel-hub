import type { Personal } from '@brian/shared';

const inputCls =
  'w-full rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-[13px] text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600';

/** Selector de persona del roster (`personal`): la opción SIEMPRE viene de la
 *  lista de usuarios registrados, filtrada por rol desde el caller. Si el roster
 *  no tiene nadie del rol pedido, muestra un estado vacío (no permite escribir
 *  libremente: el admin debe registrar al personal en Configuración). */
export function PersonaSelect({
  value,
  personas,
  placeholder,
  emptyMessage = 'No hay usuarios registrados en este rol',
  onChange,
}: {
  value: string;
  personas: Personal[];
  placeholder: string;
  emptyMessage?: string;
  onChange: (v: string) => void;
}) {
  const opciones = personas.filter((p) => p.nombre !== value);
  if (personas.length === 0) {
    return (
      <select disabled aria-label={placeholder} className={`${inputCls} opacity-60`}>
        <option value="">{emptyMessage}</option>
      </select>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
      className={`${inputCls} appearance-none`}
    >
      <option value="">{placeholder}</option>
      {value && <option value={value}>{value}</option>}
      {opciones.map((p) => (
        <option key={p.id} value={p.nombre}>
          {p.nombre} · {p.rol}
          {p.email ? ` · ${p.email}` : ''}
        </option>
      ))}
    </select>
  );
}