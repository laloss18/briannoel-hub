import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { lazy, Suspense, useMemo } from 'react';
import { listClientes } from '../clientes/clientesRepo';
import { listZonas } from '../clientes/zonasRepo';
import { listItems } from './itemsRepo';
import { listDespachos, crearDespachoLocal, editarDespachoLocal } from './ventasRepo';
import { listPersonal } from '../personal/personalRepo';
import { useSesion } from '../app/sesion';
import PageShell from '../app/PageShell';
import type { EditarVentaFormInput, VentaFormInput } from './VentaForm';

/** Wizard de venta (carga bajo demanda: photos/compress + zonas + BCV). */
const VentaForm = lazy(() => import('./VentaForm').then((m) => ({ default: m.VentaForm })));

export default function VentaFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { roles, email } = useSesion();
  const clientes = useLiveQuery(() => listClientes(), []);
  const items = useLiveQuery(() => listItems(), []);
  const zonas = useLiveQuery(() => listZonas(), []);
  const personal = useLiveQuery(() => listPersonal(), []);
  const despachos = useLiveQuery(() => listDespachos(), []);
  const editing = useMemo(() => (id ? (despachos ?? []).find((d) => d.id === id) ?? null : null), [despachos, id]);
  const titulo = id ? 'Editar venta' : 'Registrar venta';

  const editorRole = roles[0] ?? 'promotor';

  const onSubmit = async (form: VentaFormInput) => {
    await crearDespachoLocal({ ...form, vendedor: email, editor_role: editorRole });
  };

  const onEdit = async (form: EditarVentaFormInput) => {
    if (!editing) throw new Error('No hay despacho en edición.');
    await editarDespachoLocal(editing, { ...form, vendedor: email, editor_role: editorRole });
  };

  const onSuccess = () => navigate(editing ? `/ventas/${editing.id}` : '/ventas');

  const cargando =
    clientes === undefined ||
    items === undefined ||
    zonas === undefined ||
    personal === undefined ||
    (Boolean(id) && despachos === undefined);

  return (
    <PageShell titulo={titulo} icono="cart" volverA="/ventas">
      {cargando ? (
        <p className="text-xs text-fog-600">Cargando…</p>
      ) : id && !editing ? (
        <p className="text-xs text-fog-600">Despacho no encontrado.</p>
      ) : (
        <Suspense fallback={<p className="text-xs text-fog-600">Cargando formulario…</p>}>
          <VentaForm
            roles={roles}
            clientes={clientes ?? []}
            items={items ?? []}
            zonas={zonas ?? []}
            personal={personal ?? []}
            email={email}
            editing={editing}
            onSubmit={onSubmit}
            onEdit={onEdit}
            onSuccess={onSuccess}
          />
        </Suspense>
      )}
    </PageShell>
  );
}
