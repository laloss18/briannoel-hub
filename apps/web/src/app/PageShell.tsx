import { Link, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '../ui/icons';

/**
 * Contenedor de página (DESIGN §5.1): encabezado con volver + título + acción a
 * la derecha y el cuerpo debajo. Reemplaza a los modales: los formularios y los
 * detalles son páginas, así que todo es navegable con el botón atrás de Android
 * y con deep-links (`#/ventas/nueva`).
 */
export interface PageShellProps {
  titulo: string;
  /** Etiqueta del enlace de vuelta; por defecto "volver". */
  volver?: string;
  /** Destino del volver. Si se omite, se usa `navigate(-1)`. */
  volverA?: string;
  icono?: IconName;
  /** Acción de la esquina superior derecha (p. ej. "nuevo cliente"). */
  accion?: { label: string; icon?: IconName; to?: string; onClick?: () => void };
  children: ReactNode;
}

export default function PageShell({
  titulo,
  volver = 'volver',
  volverA,
  icono,
  accion,
  children,
}: PageShellProps) {
  const navigate = useNavigate();

  const onVolver = () => (volverA ? navigate(volverA) : navigate(-1));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onVolver}
            aria-label={volver}
            className="flex size-11 shrink-0 items-center justify-center rounded-md border border-ink-700 text-fog-500 transition-colors hover:border-ink-600 hover:text-fog-100 active:brightness-90"
          >
            <Icon name="arrowLeft" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-1.5 truncate text-base font-semibold tracking-tight text-fog-100">
              {icono && <Icon name={icono} className="size-4 shrink-0 text-fog-500" />}
              {titulo}
            </h1>
          </div>
        </div>
        {accion &&
          (accion.to ? (
            <Link
              to={accion.to}
              aria-label={accion.label}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-medium text-fog-100 transition-colors hover:border-ink-500 active:brightness-90"
            >
              {accion.icon && <Icon name={accion.icon} />}
              <span className="hidden sm:inline">{accion.label}</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={accion.onClick}
              aria-label={accion.label}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-medium text-fog-100 transition-colors hover:border-ink-500 active:brightness-90"
            >
              {accion.icon && <Icon name={accion.icon} />}
              <span className="hidden sm:inline">{accion.label}</span>
            </button>
          ))}
      </header>

      <div className="rise-in">{children}</div>
    </div>
  );
}