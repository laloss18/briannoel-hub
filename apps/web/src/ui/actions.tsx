import type { ReactNode } from 'react';
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${VARIANTS[variant]} ${className ?? ''}`}
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
      className={`flex size-11 shrink-0 items-center justify-center rounded-md border border-transparent text-fog-500 transition-colors hover:border-ink-600 hover:text-fog-300 ${className ?? ''}`}
    >
      <Icon name="close" />
    </button>
  );
}

export type { IconName };
export type { ReactNode };