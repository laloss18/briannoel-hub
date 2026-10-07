import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense } from 'react';
import { listZonas } from './zonasRepo';
import { crearClienteLocal } from './clientesRepo';
import { useSesion } from '../app/sesion';
import PageShell from '../app/PageShell';

const ClienteForm = lazy(() => import('./ClienteForm').then((m) => ({ default: m.ClienteForm })));

export default function ClienteFormPage() {
  const navigate = useNavigate();
  const { roles, email } = useSesion();
  const zonas = useLiveQuery(() => listZonas(), []);

  return (
    <PageShell titulo="Nuevo cliente" icono="userPlus" volverA="/clientes">
      {zonas === undefined ? (
        <p className="text-xs text-fog-600">Cargando…</p>
      ) : (
        <Suspense fallback={<p className="text-xs text-fog-600">Cargando…</p>}>
          <ClienteForm
            roles={roles}
            zonas={zonas}
            onSuccess={() => navigate('/clientes')}
            onSubmit={async (form, zonaId) => {
              await crearClienteLocal({ ...form, creado_por: email }, zonas, zonaId);
            }}
          />
        </Suspense>
      )}
    </PageShell>
  );
}
