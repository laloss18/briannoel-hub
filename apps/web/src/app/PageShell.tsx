import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../ui/icons';

/**
 * Contenedor de página (DESIGN §5.1): encabezado con volver + eyebrow mono +
 * título + acción a la derecha, y el cuerpo debajo. Reemplaza a los modales:
 * los formularios y los detalles son páginas, así que todo es navegable con el
 * botón atrás de Android y con deep-links (`#/ventas/nueva`).
 *
 * Jerarquía de la cabecera: eyebrow (contexto, mono 11px) → título (18px
 * semibold) → acción (2º plano salvo `variant: 'primary'`, que es el CTA de la
 * pantalla). El cuerpo no compite con el título: un solo `h1` por página.
 */
export interface PageShellProps {
  titulo: string;
  /** Contexto mono sobre el título (p. ej. "ventas", "detalle del pedido"). */
  eyebrow?: string;
  /** Etiqueta del enlace de vuelta; por defecto "volver". */
  volver?: string;
  /** Destino del volver. Si se omite, se usa `navigate(-1)`. */
  volverA?: string;
  icono?: IconName;
  /** Acción de la esquina superior derecha (p. ej. "nuevo cliente"). */
  accion?: {
    label: string;
    icon?: IconName;
    to?: string;
    onClick?: () => void;
    variant?: 'default' | 'primary';
    /** Renderiza SOLO el icono (un "+" redondo sin borde): el label va al accesible. */
    soloIcono?: boolean;
  };
  /** Grupo de iconos compactos sin borde en la cabecera junto al título
   *  (p. ej. el CRUD del detalle). `to` pinta un enlace, `onClick` un botón. */
  acciones?: PageShellAccion[];
  children: ReactNode;
}

export interface PageShellAccion {
  label: string;
  icon: IconName;
  to?: string;
  onClick?: () => void;
  variant?: 'default' | 'ok' | 'danger';
  disabled?: boolean;
}

const ACCION_DEFAULT = 'border-ink-600 text-fog-100 hover:bg-ink-800';
const ACCION_PRIMARY = 'border-signal bg-signal text-ink-950 hover:bg-signal-soft cta-glow';

export default function PageShell({
  titulo,
  eyebrow,
  volver = 'volver',
  volverA,
  icono,
  accion,
  acciones,
  children,
}: PageShellProps) {
  const navigate = useNavigate();

  const onVolver = () => (volverA ? navigate(volverA) : navigate(-1));
  const accionCls = `btn-lift flex shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium active:brightness-90 ${
    accion?.variant === 'primary' ? ACCION_PRIMARY : ACCION_DEFAULT
  }`;
  const accionIconoCls =
    accion?.variant === 'primary'
      ? 'btn-lift flex size-11 shrink-0 items-center justify-center rounded-full bg-signal text-ink-950 active:brightness-90 cta-glow'
      : 'btn-lift flex size-11 shrink-0 items-center justify-center rounded-full text-fog-100 active:brightness-90 hover:bg-ink-800';

  const ACCION_ICONO: Record<NonNullable<PageShellAccion['variant']>, string> = {
    default: 'text-fog-300 hover:bg-ink-800 hover:text-fog-100',
    ok: 'text-ok hover:bg-ok/10',
    danger: 'text-danger hover:bg-danger/10',
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onVolver}
            aria-label={volver}
            className="btn-lift flex size-11 shrink-0 items-center justify-center rounded-full text-fog-500 transition-colors hover:bg-ink-800 hover:text-fog-100 active:brightness-90"
          >
            <Icon name="arrowLeft" />
          </button>
          <div className="min-w-0">
            {eyebrow && (
              <p className="truncate font-mono text-2xs uppercase tracking-wider text-fog-600">
                {eyebrow}
              </p>
            )}
            <h1 className="flex items-center gap-1.5 truncate text-lg font-semibold tracking-[-0.01em] text-fog-100">
              {icono && <Icon name={icono} className="size-4 shrink-0 text-fog-500" />}
              {titulo}
            </h1>
          </div>
        </div>
        {accion &&
          (accion.soloIcono ? (
            accion.to ? (
              <Link
                to={accion.to}
                aria-label={accion.label}
                title={accion.label}
                className={accionIconoCls}
              >
                {accion.icon && <Icon name={accion.icon} />}
              </Link>
            ) : (
              <button
                type="button"
                onClick={accion.onClick}
                aria-label={accion.label}
                title={accion.label}
                className={accionIconoCls}
              >
                {accion.icon && <Icon name={accion.icon} />}
              </button>
            )
          ) : accion.to ? (
            <Link
              to={accion.to}
              aria-label={accion.label}
              title={accion.label}
              className={accionCls}
            >
              {accion.icon && <Icon name={accion.icon} />}
              <span className="hidden sm:inline">{accion.label}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={accion.onClick}
              aria-label={accion.label}
              title={accion.label}
              className={accionCls}
            >
              {accion.icon && <Icon name={accion.icon} />}
              <span className="hidden sm:inline">{accion.label}</span>
            </button>
          ))}
        {acciones && acciones.length > 0 && (
          <div
            className="flex shrink-0 items-center gap-1"
            role="group"
            aria-label="acciones del pedido"
          >
            {acciones.map((a) => {
              const cls = `btn-lift flex size-11 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${ACCION_ICONO[a.variant ?? 'default']}`;
              return a.to ? (
                <Link key={a.label} to={a.to} aria-label={a.label} title={a.label} className={cls}>
                  <Icon name={a.icon} />
                </Link>
              ) : (
                <button
                  key={a.label}
                  type="button"
                  onClick={a.onClick}
                  disabled={a.disabled}
                  aria-label={a.label}
                  title={a.label}
                  className={cls}
                >
                  <Icon name={a.icon} />
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="rise-in">{children}</div>
    </div>
  );
}
