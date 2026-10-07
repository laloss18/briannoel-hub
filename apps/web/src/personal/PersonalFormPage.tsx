import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useMemo } from 'react';
import { listPersonal, crearPersonalLocal, editarPersonalLocal } from './personalRepo';
import { useSesion } from '../app/sesion';
import PageShell from '../app/PageShell';
import type { NuevaPersonalRepoInput } from './personalRepo';

const PersonalForm = lazy(() => import('./PersonalForm').then((m) => ({ default: m.PersonalForm })));

export default function PersonalFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { email } = useSesion();
  const personas = useLiveQuery(() => listPersonal(), []);
  const persona = useMemo(() => (personas ?? []).find((x) => x.id === id) ?? null, [personas, id]);
  const titulo = id ? 'Editar persona' : 'Nueva persona';

  return (
    <PageShell titulo={titulo} icono="user" volverA="/personal">
      {id && personas !== undefined && !persona ? (
        <p className="text-xs text-fog-600">Persona no encontrada.</p>
      ) : (
        <Suspense fallback={<p className="text-xs text-fog-600">Cargando…</p>}>
          <PersonalForm
            persona={id ? persona : null}
            onSuccess={() => navigate('/personal')}
            onSubmit={async (input: NuevaPersonalRepoInput) => {
              if (persona) {
                await editarPersonalLocal(persona, input, email);
              } else {
                await crearPersonalLocal(input, email);
              }
            }}
          />
        </Suspense>
      )}
    </PageShell>
  );
}
