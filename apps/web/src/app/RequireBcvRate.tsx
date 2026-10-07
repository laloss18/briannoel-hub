import RequireBcvRateProvider from './RequireBcvRateGate';
import { useSesion } from './sesion';
import { Outlet } from 'react-router-dom';

/**
 * Requiere que la tasa BCV esté configurada y vigente antes de dejar entrar al
 * hub (PRD §2.6, §7.4). Mientras no haya tasa, delega en `TasaRequerida`.
 */
export default function RequireBcvRate() {
  const { roles } = useSesion();
  return (
    <RequireBcvRateProvider roles={roles}>
      <Outlet />
    </RequireBcvRateProvider>
  );
}