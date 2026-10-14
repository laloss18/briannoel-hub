import { useNavigate, useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { label } from '../ui/section';

/**
 * Frontera de error de la ruta (DESIGN §9): si un `lazy` falla (dev server
 * reiniciado, red caída, chunk 404), React Router renderiza esto en lugar de
 * su propia pantalla "Unexpected Application Error!". El shell de AppShell
 * sigue montado, así que el usuario mantiene el contexto y puede reintentar.
 */
export default function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();

  const detalle = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);

  return (
    <div role="alert" className="mx-auto flex max-w-sm flex-col gap-3 py-14">
      <p className={label}>error</p>
      <h1 className="text-lg font-semibold text-fog-100">No se pudo cargar la vista</h1>
      <p className="text-xs text-fog-500">
        No llegó el módulo de esta sección. Suele ser la conexión o un reinicio del servidor de
        desarrollo: vuelve a intentar.
      </p>
      <p className="rounded-lg border border-ink-700 bg-ink-900 p-2 font-mono text-2xs text-fog-600">
        {detalle}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-lift rounded-lg border border-signal bg-signal px-3 py-2 text-sm font-medium text-on-signal hover:bg-signal-soft cta-glow active:brightness-90"
        >
          Reintentar
        </button>
        <button
          type="button"
          onClick={() => navigate('/')}
          className="btn-lift rounded-lg border border-ink-600 px-3 py-2 text-sm font-medium text-fog-100 hover:bg-ink-800 active:brightness-90"
        >
          Ir al inicio
        </button>
      </div>
    </div>
  );
}
