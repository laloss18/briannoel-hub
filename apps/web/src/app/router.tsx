import { createHashRouter, Navigate, type RouteObject } from 'react-router-dom';
import AppShell from './AppShell';
import RequireBcvRate from './RequireBcvRate';
import RouteError from './RouteError';
import HomePage from './HomePage';

/**
 * Mapa de rutas del hub (2026-10-05). Cada sección es un `lazy` para que el
 * bundle inicial solo cargue shell + auth (DESIGN §bundle-dynamic-imports).
 *
 * Cada carga/de render de sección lleva `errorElement`: si un `lazy` falla
 * (dev server reiniciado, red caída) React Router muestra una pantalla con
 * "Reintentar" en vez del "Unexpected Application Error!" de fábrica.
 *
 * Formularios y detalles son **páginas**, no modales: `#/ventas/nueva`,
 * `#/clientes/:id`, `#/ventas/:id/editar`, … Deep-link y botón atrás de
 * Android funcionan sin configuración de servidor porque el router es
 * `HashRouter` (la PWA se sirve como estático).
 */
const lazy = (fn: () => Promise<{ default: React.ComponentType }>) => async () => {
  const m = await fn();
  return { Component: m.default, errorElement: <RouteError /> };
};

const rutas: RouteObject[] = [
  {
    element: <AppShell />,
    // Borde global del shell: el fallo de import de cualquier `lazy` hijo
    // burbujea hasta aquí (el hijo no alcanza a instalarse).
    errorElement: <RouteError />,
    children: [
      {
        // Gate de bimoneda: sin tasa BCV no se entra al hub (§2.6/§7.4).
        element: <RequireBcvRate />,
        children: [
          { index: true, Component: HomePage },
          { path: 'config', lazy: lazy(() => import('../config/ConfigPage')) },
          { path: 'config/tasa', lazy: lazy(() => import('../bimoneda/BcvRatePage')) },
          {
            path: 'config/usuarios',
            lazy: lazy(() => import('../config/UsuariosPage')),
          },
          {
            path: 'config/usuarios/nuevo',
            lazy: lazy(() => import('../config/NuevoUsuarioPage')),
          },

          { path: 'ventas', lazy: lazy(() => import('../ventas/VentasPage')) },
          { path: 'ventas/nueva', lazy: lazy(() => import('../ventas/VentaFormPage')) },
          { path: 'ventas/:id', lazy: lazy(() => import('../ventas/VentaDetallePage')) },
          {
            path: 'ventas/:id/editar',
            lazy: lazy(() => import('../ventas/VentaFormPage')),
          },

          { path: 'clientes', lazy: lazy(() => import('../clientes/ClientesPage')) },
          { path: 'clientes/nuevo', lazy: lazy(() => import('../clientes/ClienteFormPage')) },
          { path: 'clientes/:id', lazy: lazy(() => import('../clientes/ClienteDetallePage')) },
          {
            path: 'clientes/:id/editar',
            lazy: lazy(() => import('../clientes/ClienteDetallePage')),
          },

          { path: 'zonas', lazy: lazy(() => import('../clientes/ZonasPage')) },
          { path: 'zonas/nueva', lazy: lazy(() => import('../clientes/ZonaFormPage')) },
          { path: 'zonas/:id/editar', lazy: lazy(() => import('../clientes/ZonaFormPage')) },

          { path: 'catalogo', lazy: lazy(() => import('../catalogo/CatalogoPage')) },
          { path: 'catalogo/nuevo', lazy: lazy(() => import('../catalogo/ItemFormPage')) },
          { path: 'catalogo/:id/editar', lazy: lazy(() => import('../catalogo/ItemFormPage')) },

          { path: 'personal', lazy: lazy(() => import('../personal/PersonalPage')) },
          { path: 'personal/nuevo', lazy: lazy(() => import('../personal/PersonalFormPage')) },
          {
            path: 'personal/:id/editar',
            lazy: lazy(() => import('../personal/PersonalFormPage')),
          },

          // Las secciones del MVP aún no construidas caen en la home, no en un 404.
          {
            path: 'cobranza',
            element: <Navigate to="/" replace />,
          },
          { path: 'pagos', element: <Navigate to="/" replace /> },
          { path: 'rutas', element: <Navigate to="/" replace /> },
          { path: 'reportes', element: <Navigate to="/" replace /> },
          { path: '*', element: <Navigate to="/" replace /> },
        ],
      },
    ],
  },
];

export const router = createHashRouter(rutas);