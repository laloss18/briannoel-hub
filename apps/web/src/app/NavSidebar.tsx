import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { hasPermission, type Role } from '@brian/shared';
import { Icon, type IconName } from '../ui/icons';
import { Monogram } from '../ui/brand';
import { useSesion } from './sesion';

/** Secciones del MVP (PRD §2). `listo` navega; el resto queda atenuado y sin ruta. */
export interface Seccion {
  id: string;
  nombre: string;
  to: string;
  icono: IconName;
  estado: 'listo' | 'pendiente';
  /** Permiso requerido para verla; sin rol no aparece. */
  permiso?: Parameters<typeof hasPermission>[0];
}

const SECCIONES: readonly Seccion[] = [
  { id: 'inicio', nombre: 'Inicio', to: '/', icono: 'home', estado: 'listo' },
  { id: 'ventas', nombre: 'Ventas', to: '/ventas', icono: 'cart', estado: 'listo' },
  { id: 'clientes', nombre: 'Clientes', to: '/clientes', icono: 'users', estado: 'listo' },
  { id: 'zonas', nombre: 'Zonas', to: '/zonas', icono: 'map', estado: 'listo' },
  { id: 'catalogo', nombre: 'Catálogo', to: '/catalogo', icono: 'package', estado: 'listo' },
  { id: 'usuarios', nombre: 'Usuarios', to: '/config/usuarios', icono: 'users', estado: 'listo', permiso: 'manage_personal' },
  { id: 'config', nombre: 'Configuración', to: '/config', icono: 'settings', estado: 'listo', permiso: 'view_kpis' },
];

interface NavSidebarProps {
  roles: readonly Role[];
  /** Colapsado en desktop (w-14): el contenido del enlace se oculta. */
  collapsed: boolean;
  /** Alterna colapsado/expandido en desktop desde el botón del sidebar. */
  onToggleCollapse: () => void;
  /** Drawer en móvil. */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

/**
 * Sidebar de navegación (DESIGN §5): en desktop es una columna persistente que
 * colapsa a iconos; en móvil es el mismo nav dentro de un drawer. El botón de
 * colapsar vive DENTRO del sidebar (arriba); en móvil el drawer se abre desde
 * el botón de la cabecera.
 */
export default function NavSidebar({
  roles,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileClose,
}: NavSidebarProps) {
  const { pathname } = useLocation();
  const { username, email, onLogout } = useSesion();
  const visibles = SECCIONES.filter((s) => !s.permiso || hasPermission(s.permiso, roles));

  // Gana la sección con el prefijo más largo: `/config/usuarios` activa Usuarios
  // (y NO Configuración), aunque `/config` sea prefijo de ambas.
  const coincide = (to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`));
  const activoId = visibles
    .filter((s) => coincide(s.to))
    .sort((a, b) => b.to.length - a.to.length)[0]?.id;

  const nav = (
    <>
      <div className={collapsed ? 'flex justify-center px-2 py-4' : 'px-2 py-4'}>
        <Link
          to="/"
          onClick={onMobileClose}
          className="flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:brightness-110 active:brightness-95"
          aria-label="Ir al inicio"
        >
          <Monogram />
          {!collapsed && (
            <span className="hidden min-w-0 text-left leading-tight sm:block">
              <span className="block truncate text-xs font-semibold tracking-tight text-fog-100">
                Brian Noel
              </span>
              <span className="block text-2xs text-fog-500">hub de operaciones</span>
            </span>
          )}
        </Link>
      </div>

      <nav aria-label="Secciones" className="flex flex-1 flex-col gap-1 overflow-y-auto px-2">
        {visibles.map((s) => {
          const activo = s.id === activoId;
          const Etiqueta = s.estado === 'listo' ? Link : 'span';
          return (
            <Etiqueta
              key={s.id}
              {...(s.estado === 'listo' ? { to: s.to, onClick: onMobileClose } : { to: s.to })}
              aria-current={activo ? 'page' : undefined}
              aria-disabled={s.estado !== 'listo' || undefined}
              title={collapsed ? s.nombre : undefined}
              className={`flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors ${
                activo ? 'bg-ink-800 text-fog-100' : 'text-fog-300 hover:bg-ink-800/60 hover:text-fog-100'
              } ${collapsed ? 'justify-center' : ''} ${
                s.estado !== 'listo' ? 'cursor-default opacity-50' : ''
              }`}
            >
              <Icon name={s.icono} className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{s.nombre}</span>}
            </Etiqueta>
          );
        })}
      </nav>

      <div className="border-t border-ink-700/60 p-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className={`hidden w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-fog-500 transition-colors hover:bg-ink-800/60 hover:text-fog-100 md:flex ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <Icon name={collapsed ? 'panelLeftOpen' : 'panelLeftClose'} className="size-4 shrink-0" />
          {!collapsed && <span>Colapsar</span>}
        </button>
        <div className={collapsed ? 'flex justify-center px-1 pb-1' : 'px-1 pb-1'}>
          <p className="truncate text-2xs text-fog-500" title={username ?? email}>
            {collapsed ? (username ?? email.slice(0, 2)) : (username ?? email)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          title={collapsed ? 'Salir' : undefined}
          className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-fog-500 transition-colors hover:bg-ink-800/60 hover:text-fog-100 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <Icon name="logout" className="size-4 shrink-0" />
          {!collapsed && <span>Salir</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: columna persistente colapsable. El toggle de colapso vive
          dentro del propio sidebar; en móvil el drawer se abre desde la
          cabecera. */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-ink-700/60 bg-ink-900/40 md:flex ${
          collapsed ? 'w-14' : 'w-56'
        } transition-[width] duration-200`}
      >
        {nav}
      </aside>

      {/* Móvil: drawer */}
      <MobileDrawer open={mobileOpen} onClose={onMobileClose}>
        {nav}
      </MobileDrawer>
    </>
  );
}

function MobileDrawer({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-ink-950/80 overscroll-contain md:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Menú"
    >
      <div className="slide-in-right flex h-dvh w-full max-w-xs overscroll-contain flex-col border-r border-ink-700 bg-ink-900 text-fog-100">
        {children}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar menú"
          className="flex items-center justify-center border-t border-ink-700/60 py-2 text-fog-500"
        >
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}