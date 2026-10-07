/** Botón de icono para abrir el alta rápida de zona desde un formulario de
 *  registro (cliente/venta); ahorra el espacio de un botón de texto. */
export function CrearZonaBoton({
  onClick,
  label = 'crear zona',
  disabled = false,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-md border border-ink-700 bg-ink-950 text-fog-300 transition-colors hover:border-ink-600 hover:text-fog-100 disabled:opacity-50"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="size-4"
        aria-hidden="true"
      >
        <path strokeLinecap="round" d="M12 5v14M5 12h14" />
      </svg>
    </button>
  );
}