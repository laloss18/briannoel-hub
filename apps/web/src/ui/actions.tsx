import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './icons';

export interface ActionButtonProps {
  /** Rótulo visible en escritorio y aria-label/title (accesibilidad, §a11y). */
  label: string;
  icon?: IconName;
  onClick: () => void;
  variant?: 'default' | 'ok' | 'danger' | 'primary';
  disabled?: boolean;
  className?: string;
}

const VARIANTS: Record<NonNullable<ActionButtonProps['variant']>, string> = {
  default: 'border-ink-600 text-fog-100 hover:border-ink-500',
  ok: 'border-ok/50 text-ok hover:border-ok hover:bg-ok/10',
  danger: 'border-danger/50 text-danger hover:border-danger hover:bg-danger/10',
  primary: 'border-signal bg-signal text-ink-950 hover:bg-signal-soft',
};

/**
 * Botón de acción con icono: en móvil solo el icono; en escritorio icono + texto
 * (`hidden sm:inline`). El `label` siempre queda en aria-label para no perder
 * accesibilidad (web-design-guidelines).
 */
export function ActionButton({
  label,
  icon,
  onClick,
  variant = 'default',
  disabled,
  className,
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`btn-lift inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium disabled:opacity-50 ${VARIANTS[variant]} ${variant === 'primary' ? 'cta-glow' : ''} ${className ?? ''}`}
    >
      {icon && <Icon name={icon} />}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export function ActionIconGlyph({ icon, className }: { icon: IconName; className?: string }) {
  return (
    <span aria-hidden="true" className={className}>
      <Icon name={icon} />
    </span>
  );
}

/**
 * Botón icon-only de 44px para acciones en filas de lista (edición rápida sin
 * abrir el registro). El nombre accesible va en `label` (aria-label + title).
 */
export function IconButton({
  label,
  icon,
  onClick,
  variant = 'default',
  disabled,
  className,
}: {
  label: string;
  icon: IconName;
  onClick: () => void;
  variant?: NonNullable<ActionButtonProps['variant']>;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`btn-lift flex size-11 shrink-0 items-center justify-center rounded-md border disabled:opacity-50 ${VARIANTS[variant]} ${className ?? ''}`}
    >
      <Icon name={icon} className="size-4" />
    </button>
  );
}

const SIN_BORDE: Record<'default' | 'ok' | 'danger', string> = {
  default: 'text-fog-300 hover:bg-ink-800 hover:text-fog-100',
  ok: 'text-ok hover:bg-ok/10',
  danger: 'text-danger hover:bg-danger/10',
};

/**
 * Icono de acción compacto y SIN borde (DESIGN: los iconos viven libres del
 * contenedor). Mantiene el área táctil de 44px (regla global de `index.css`)
 * pero el glifo se ve suelto, con fondo suave solo al pasar o presionar.
 * Acepta enlace (`to`) para acciones de navegación como "editar".
 */
export function IconAction({
  label,
  icon,
  onClick,
  to,
  variant = 'default',
  disabled,
  className,
}: {
  label: string;
  icon: IconName;
  onClick?: () => void;
  to?: string;
  variant?: keyof typeof SIN_BORDE;
  disabled?: boolean;
  className?: string;
}) {
  const cls = `btn-lift flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${SIN_BORDE[variant]} ${className ?? ''}`;
  if (to) {
    return (
      <Link to={to} aria-label={label} title={label} className={cls}>
        <Icon name={icon} className="size-4" />
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cls}
    >
      <Icon name={icon} className="size-4" />
    </button>
  );
}

/** Cierre de diálogos/modales con icono X (a11y: aria-label propio). */
export function CloseButton({
  onClick,
  label = 'Cerrar',
  className,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`btn-lift flex size-11 shrink-0 items-center justify-center rounded-md border border-transparent text-fog-500 hover:border-ink-600 hover:text-fog-300 ${className ?? ''}`}
    >
      <Icon name="close" />
    </button>
  );
}

export type { IconName };
export type { ReactNode };
