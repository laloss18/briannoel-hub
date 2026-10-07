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

function RoleChips({
  roles,
  disabled,
  onToggle,
}: {
  roles: readonly Rol[];
  disabled?: boolean;
  onToggle?: (r: Rol) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ROLES.map((r) => {
        const activo = roles.includes(r);
        const Tag = onToggle ? 'button' : 'span';
        return (
          <Tag
            key={r}
            {...(onToggle ? { type: 'button' as const, onClick: () => onToggle(r), disabled } : {})}
            className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              activo
                ? 'border-signal/60 bg-signal/10 text-signal'
                : 'border-ink-700 text-fog-600'
            } ${onToggle && !disabled ? 'cursor-pointer hover:border-ink-600' : ''}`}
          >
            {ETIQUETA_ROL[r]}
          </Tag>
        );
      })}
    </div>
  );
}

/** Panel de usuarios (solo admin, `manage_personal` §3.3). El alta vive en
 *  `/config/usuarios/nuevo`; aquí se edita username, roles y estado. */
export default function UsuariosPage() {
  const { roles: misRoles } = useSesion();
  const usuarios = useAppUsers();
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<{ username: string; roles: Rol[] } | null>(null);
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

  const abrir = (userId: string, username: string, roles: readonly Rol[]) => {
    setEditando(userId);
    setBorrador({ username, roles: [...roles] });
    setError(null);
  };

  const cerrar = () => {
    setEditando(null);
    setBorrador(null);
  };

  const toggleRol = (r: Rol) => {
    setBorrador((b) =>
      b ? { ...b, roles: b.roles.includes(r) ? b.roles.filter((x) => x !== r) : [...b.roles, r] } : b,
    );
  };

  const guardar = async (userId: string) => {
    if (!borrador) return;
    if (borrador.roles.length === 0) {
      setError('Deja al menos un rol.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await adminEditarUsuario({ user_id: userId, username: borrador.username, roles: borrador.roles });
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
      accion={{ label: 'Nuevo usuario', icon: 'userPlus', to: '/config/usuarios/nuevo' }}
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
                    <p className="truncate text-[13px] font-medium text-fog-100">
                      {u.username ?? '(sin username)'}
                    </p>
                    <p className="truncate font-mono text-[10px] text-fog-600">{u.email}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!u.active && (
                      <span className="font-mono text-[10px] uppercase tracking-wider text-danger">
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
                {!abierto && <RoleChips roles={u.roles} />}

                {abierto && borrador && (
                  <div className="flex flex-col gap-3 rounded-lg border border-ink-700 bg-ink-900 p-3">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`u-${u.user_id}`} className="text-[11px] text-fog-500">
                        Nombre de usuario
                      </label>
                      <input
                        id={`u-${u.user_id}`}
                        value={borrador.username}
                        onChange={(e) => setBorrador({ ...borrador, username: e.target.value })}
                        className="rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600"
                      />
                      {usernameSchema.safeParse(borrador.username).success ? null : (
                        <p className="text-[11px] text-danger">
                          3 a 24 caracteres: solo letras, números, punto, guion y guion bajo.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <p className="text-[11px] text-fog-500">Roles</p>
                      <RoleChips roles={borrador.roles} onToggle={toggleRol} />
                    </div>
                    {error && (
                      <p role="alert" className="text-[11px] text-danger">
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