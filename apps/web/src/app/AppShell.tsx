import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useSync } from '../sync/useSync';
import SyncButton from '../sync/SyncButton';
import { StatusStrip } from '../ui/brand';
import { Icon } from '../ui/icons';
import NavSidebar from './NavSidebar';
import { useSesion } from './sesion';

/**
 * Shell del hub con sesión (DESIGN §5): sidebar colapsable + contenido. En
 * `md+` es un grid con la columna de navegación y la de contenido a ancho
 * completo; en móvil la navegación es un drawer y el contenido sí lleva
 * `max-w-2xl`. El botón de menú está en la esquina superior derecha del header,
 * con el de sincronización justo a su izquierda.
 */
export default function AppShell() {
  const { roles } = useSesion();
  const { busy, last, error, sync } = useSync();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const onMenu = () => {
    // En desktop colapsa/expande; en móvil abre/cierra el drawer. El breakpoint
    // de Tailwind (md=768px) es el mismo que usa el `hidden md:flex` del aside.
    if (window.matchMedia('(min-width: 768px)').matches) setCollapsed((c) => !c);
    else setMobileOpen((o) => !o);
  };

  return (
    <div className="flex min-h-dvh">
      <NavSidebar
        roles={roles}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-ink-700/60 bg-ink-950/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-mono text-[11px] uppercase tracking-wider text-fog-600">
                Brian Noel · hub
              </p>
              {error ? (
                <p className="truncate text-[11px] text-danger">{error}</p>
              ) : (
                <p className="truncate text-[11px] text-fog-500">
                  Última sincronización: {last ?? '(nunca)'}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <SyncButton busy={busy} onSync={() => void sync()} />
              <button
                type="button"
                onClick={onMenu}
                aria-label="Menú"
                aria-expanded={mobileOpen || !collapsed}
                className="flex size-11 items-center justify-center rounded-md border border-ink-700 text-fog-100 transition-colors hover:border-ink-600 active:brightness-90"
              >
                <Icon name={collapsed ? 'panelLeftOpen' : 'menu'} />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5 md:max-w-none md:px-6">
          <Outlet />
        </main>

        <footer className="mx-auto w-full max-w-2xl px-4 pb-4 md:max-w-none md:px-6">
          <StatusStrip />
        </footer>
      </div>
    </div>
  );
}