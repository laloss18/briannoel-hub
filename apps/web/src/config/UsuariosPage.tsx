import { useState } from 'react';
import { hasPermission, ROLES, usernameSchema, type Role as Rol } from '@brian/shared';
import PageShell from '../app/PageShell';
import { useSesion } from '../app/sesion';
import { useAppUsers, adminEditarUsuario } from '../auth/usuariosRepo';
import { ActionButton } from '../ui/actions';

const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'administrador',
  supervisor: 'supervisor',
  promotor: 'promotor',
  cobrador: 'cobrador',
};

function RoleChip({ rol }: { rol: Rol }) {
  return (
    <span className="rounded-md border border-signal/60 bg-signal/10 px-2 py-1 font-mono text-2xs uppercase tracking-wider text-signal">
      {ETIQUETA_ROL[rol]}
    </span>
  );
}

/** Panel de usuarios (solo admin, `manage_personal` §3.3). El alta vive en
 *  `/config/usuarios/nuevo`; aquí se edita username, el rol único y el estado. */
export default function UsuariosPage() {
  const { roles: misRoles } = useSesion();
  const usuarios = useAppUsers();
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<{ username: string; rol: Rol } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const puede = hasPermission('manage_personal', misRoles);

  if (!puede) {
    return (
      <PageShell titulo="Usuarios" icono="users" volverA="/">
        <p className="text-xs text-fog-500">
          Solo el administrador puede gestionar las cuentas del hub.
        </p>
      </PageShell>
    );
  }

  const abrir = (userId: string, username: string | undefined, roles: readonly Rol[]) => {
    setEditando(userId);
    setBorrador({ username: username ?? '', rol: roles[0] ?? 'promotor' });
    setError(null);
  };

  const cerrar = () => {
    setEditando(null);
    setBorrador(null);
  };

  const guardar = async (userId: string) => {
    if (!borrador) return;
    if (!usernameSchema.safeParse(borrador.username).success) {
      setError('El nombre de usuario necesita 3 a 40 caracteres (letras, números y espacios).');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await adminEditarUsuario({
        user_id: userId,
        username: borrador.username,
        roles: [borrador.rol],
      });
      cerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <PageShell
      titulo="Usuarios"
      icono="users"
      volverA="/config"
      accion={{
        label: 'Nuevo usuario',
        icon: 'plus',
        to: '/config/usuarios/nuevo',
        variant: 'primary',
        soloIcono: true,
      }}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-fog-500">
          El nombre de usuario es lo que la app muestra. El correo sigue siendo la clave de
          auditoría de cada registro.
        </p>

        {usuarios.length === 0 && (
          <p className="border-t border-ink-700/60 pt-3 text-xs text-fog-600">
            Todavía no hay cuentas. Da de alta la primera con el botón de arriba.
          </p>
        )}

        <ul className="flex flex-col divide-y divide-ink-700/60 border-y border-ink-700/60">
          {usuarios.map((u) => {
            const abierto = editando === u.user_id;
            return (
              <li key={u.user_id} className="flex flex-col gap-2 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-fog-100">
                      {u.username ?? '(sin username)'}
                    </p>
                    <p className="truncate font-mono text-2xs text-fog-600">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!u.active && (
                      <span className="font-mono text-2xs uppercase tracking-wider text-danger">
                        inactivo
                      </span>
                    )}
                    <ActionButton
                      label={abierto ? 'Cancelar' : 'Editar'}
                      icon={abierto ? 'clear' : 'pencil'}
                      onClick={() => (abierto ? cerrar() : abrir(u.user_id, u.username, u.roles))}
                    />
                  </div>
                </div>

                {!abierto && (
                  <div className="flex flex-wrap gap-1.5">
                    {u.roles.length > 0 ? (
                      u.roles.map((r) => <RoleChip key={r} rol={r} />)
                    ) : (
                      <span className="font-mono text-2xs uppercase tracking-wider text-fog-600">
                        sin rol
                      </span>
                    )}
                  </div>
                )}

                {abierto && borrador && (
                  <div className="flex flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`u-${u.user_id}`} className="text-2xs text-fog-500">
                        Nombre de usuario
                      </label>
                      <input
                        id={`u-${u.user_id}`}
                        value={borrador.username}
                        onChange={(e) => setBorrador({ ...borrador, username: e.target.value })}
                        className="rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600"
                      />
                      {usernameSchema.safeParse(borrador.username).success ? null : (
                        <p className="text-2xs text-danger">
                          Usa 3 a 40 caracteres: letras, números y espacios.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-2xs text-fog-500" id={`rol-label-${u.user_id}`}>
                        Rol
                      </p>
                      <div
                        role="radiogroup"
                        aria-labelledby={`rol-label-${u.user_id}`}
                        className="flex flex-wrap gap-1.5"
                      >
                        {ROLES.map((r) => {
                          const activo = borrador.rol === r;
                          return (
                            <button
                              key={r}
                              type="button"
                              role="radio"
                              aria-checked={activo}
                              onClick={() => setBorrador({ ...borrador, rol: r })}
                              className={`rounded-md border px-2 py-1 font-mono text-2xs uppercase tracking-wider transition-colors ${
                                activo
                                  ? 'border-signal/60 bg-signal/10 text-signal'
                                  : 'border-ink-700 text-fog-600 hover:border-ink-600'
                              }`}
                            >
                              {ETIQUETA_ROL[r]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {error && (
                      <p role="alert" className="text-2xs text-danger">
                        {error}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <ActionButton
                        label="Guardar"
                        icon="check"
                        variant="ok"
                        disabled={guardando}
                        onClick={() => void guardar(u.user_id)}
                      />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </PageShell>
  );
}
