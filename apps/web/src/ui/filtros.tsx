import { useState, type ReactNode } from 'react';
import { Icon, type IconName } from './icons';

/** Campo base de los controles de filtro: 44px (regla global), forma suave y
 *  foco al acento. Compartido por selects y campos de fecha. */
const campoCls =
  'w-full rounded-lg border border-ink-600 bg-ink-950 px-3 text-sm text-fog-100 caret-signal outline-none transition-colors placeholder:text-fog-600 focus:border-signal';

/**
 * Barra de filtros **compacta y plegable**: la búsqueda siempre está visible y
 * un botón «Filtros» (con contador de activos) despliega/pliega el resto. Así el
 * listado no compite con el filtrado y el modo desplegado conserva jerarquía
 * (etiquetas + chips + pie con resumen/limpiar).
 */
export function FilterBar({
  searchValue,
  onSearchChange,
  placeholder,
  ariaLabel,
  activos = 0,
  children,
}: {
  searchValue: string;
  onSearchChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
  /** Nº de filtros activos (excluye la búsqueda: ya es evidente en el input). */
  activos?: number;
  children: ReactNode;
}) {
  const [abierto, setAbierto] = useState(activos > 0);
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-ink-700 bg-ink-900 p-2.5 shadow-card">
      <div className="flex items-center gap-2">
        <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-ink-600 bg-ink-950 px-3 focus-within:border-signal">
          <Icon name="search" className="size-4 shrink-0 text-fog-500" />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            className="min-w-0 flex-1 bg-transparent text-sm text-fog-100 caret-signal outline-none placeholder:text-fog-600"
          />
        </div>
        <button
          type="button"
          aria-expanded={abierto}
          aria-label={abierto ? 'Ocultar filtros' : 'Mostrar filtros'}
          onClick={() => setAbierto((v) => !v)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1 rounded-full border border-ink-700 px-3 text-xs font-medium text-fog-300 transition-colors hover:bg-ink-800 hover:text-fog-100"
        >
          <Icon name="filter" className="size-4" />
          <span className="hidden sm:inline">Filtros</span>
          {activos > 0 && (
            <span
              aria-hidden="true"
              className="flex min-w-4 items-center justify-center rounded-full bg-signal px-1 font-mono text-2xs tabular-nums text-on-signal"
            >
              {activos}
            </span>
          )}
          <Icon
            name="chevronDown"
            className={`size-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {abierto && (
        <div className="flex flex-col gap-2.5 border-t border-ink-800 pt-2.5">{children}</div>
      )}
    </section>
  );
}

/** Grupo de filtros con etiqueta: los chips se envuelven (nunca se aprietan). */
export function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-2xs font-medium uppercase tracking-wider text-fog-600">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

/** Chip de filtro conmutable (el activo se rellena con el acento). El alto de
 *  44px lo impone la regla global de `index.css`. */
export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-2.5 text-xs font-medium transition-colors ${
        active
          ? 'border-signal bg-signal text-on-signal'
          : 'border-ink-700 text-fog-300 hover:border-ink-600 hover:bg-ink-800 hover:text-fog-100'
      }`}
    >
      {children}
    </button>
  );
}

/** Select etiquetado para conjuntos abiertos (p. ej. zonas): un control grande
 *  y claro en su propia fila, en vez de un select diminuto junto a otros. */
export function FilterSelect({
  label,
  ariaLabel,
  value,
  onChange,
  children,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-2xs font-medium uppercase tracking-wider text-fog-600">{label}</span>
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${campoCls} cursor-pointer`}
      >
        {children}
      </select>
    </label>
  );
}

/** Campo de fecha etiquetado, al mismo nivel visual que el resto. */
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-2xs font-medium uppercase tracking-wider text-fog-600">{label}</span>
      <input
        type="date"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={campoCls}
      />
    </label>
  );
}

/** Pie del panel de filtros: recuento a la izquierda y "Limpiar" a la derecha
 *  cuando hay filtros activos. Separa los metadatos de los controles. */
export function ToolbarFooter({ meta, onClear }: { meta: ReactNode; onClear?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-ink-800 pt-2">
      <p className="font-mono text-2xs tabular-nums text-fog-600" aria-live="polite">
        {meta}
      </p>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-full px-2 text-xs font-medium text-fog-300 transition-colors hover:text-fog-100"
        >
          <Icon name="clear" className="size-3.5" />
          Limpiar
        </button>
      )}
    </div>
  );
}

export type { IconName };
