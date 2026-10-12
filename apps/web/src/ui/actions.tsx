import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon, type IconName } from './icons';

interface ActionButtonProps {
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
  primary: 'border-signal bg-signal text-on-signal hover:bg-signal-soft',
};

/**
 * Botón de acción con icono: en móvil solo el icono; en escritorio icono + texto
 * (`hidden sm:inline`). El `label` siempre queda en aria-label para no perder
 * accesibilidad (DESIGN §a11y).
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
      className={`btn-lift inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50 ${VARIANTS[variant]} ${variant === 'primary' ? 'cta-glow' : ''} ${className ?? ''}`}
    >
      {icon && <Icon name={icon} />}
      <span className="hidden sm:inline">{label}</span>
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
      className={`btn-lift flex size-11 shrink-0 items-center justify-center rounded-lg border border-transparent text-fog-500 hover:border-ink-600 hover:text-fog-300 ${className ?? ''}`}
    >
      <Icon name="close" />
    </button>
  );
}

const BTN_TAMANO = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-3.5 py-2 text-sm active:scale-[0.98]',
} as const;

/**
 * CTA primario (fondo `signal`): «guardar», «crear», «continuar». Tamaño `md`
 * por defecto; `sm` para wizards y diálogos anidados.
 */
export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  size = 'md',
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  size?: keyof typeof BTN_TAMANO;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn-lift cta-glow inline-flex items-center justify-center rounded-lg bg-signal font-semibold text-on-signal transition-colors hover:bg-signal-soft disabled:opacity-50 ${BTN_TAMANO[size]} ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

/** Botón secundario (contorno neutro): «cancelar», «volver». */
export function SecondaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn-lift inline-flex items-center justify-center rounded-lg border border-ink-600 px-3.5 py-2 text-sm font-medium text-fog-100 transition-colors hover:border-ink-500 ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
