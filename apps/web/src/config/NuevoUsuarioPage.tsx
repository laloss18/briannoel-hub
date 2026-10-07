import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasPermission, ROLES, usernameSchema, type Role as Rol } from '@brian/shared';
import PageShell from '../app/PageShell';
import { useSesion } from '../app/sesion';
import { adminCrearUsuario } from '../auth/usuariosRepo';

const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'administrador',
  supervisor: 'supervisor',
  promotor: 'promotor',
  cobrador: 'cobrador',
};

const CAMPO =
  'w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600';
const ETIQUETA = 'text-[11px] text-fog-500';

/**
 * Alta de cuenta (solo admin, §3.4): correo + nombre de usuario + contraseña
 * inicial + roles. No hay signup público — la RPC `admin_create_app_user` es
 * `SECURITY DEFINER` y valida el rol admin en el servidor. Tras crearla, la app
 * se sincroniza para bajar el perfil nuevo.
 */
export default function NuevoUsuarioPage() {
  const { roles: misRoles } = useSesion();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<Rol[]>(['promotor']);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  if (!hasPermission('manage_personal', misRoles)) {
    return (
      <PageShell titulo="Nuevo usuario" volverA="/config/usuarios">
        <p className="text-xs text-fog-500">
          Solo el administrador puede dar de alta cuentas del hub.
        </p>
      </PageShell>
    );
  }

  const toggle = (r: Rol) =>
    setRoles((v) => (v.includes(r) ? v.filter((x) => x !== r) : [...v, r]));

  const onGuardar = async () => {
    if (!usernameSchema.safeParse(username).success) {
      setError('El nombre de usuario necesita 3 a 24 caracteres válidos.');
      return;
    }
    if (password.length < 8) {
      setError('La contraseña necesita al menos 8 caracteres.');
      return;
    }
    if (roles.length === 0) {
      setError('Elige al menos un rol.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await adminCrearUsuario({ email, username, password, roles, name: name || undefined });
      navigate('/config/usuarios');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <PageShell titulo="Nuevo usuario" icono="userPlus" volverA="/config/usuarios">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={ETIQUETA}>
            Correo (clave de auditoría y de acceso)
          </label>
          <input
            id="email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={CAMPO}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className={ETIQUETA}>
            Nombre de usuario (lo que se ve en la app)
          </label>
          <input
            id="username"
            autoComplete="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ej. luis.p"
            className={`${CAMPO} font-mono`}
          />
          {username && !usernameSchema.safeParse(username).success && (
            <p className="text-[11px] text-danger">
              Solo letras, números, punto, guion y guion bajo.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className={ETIQUETA}>
            Nombre visible (opcional)
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={CAMPO}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className={ETIQUETA}>
            Contraseña inicial
          </label>
          <input
            id="password"
            type="text"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${CAMPO} font-mono`}
          />
          <p className="text-[11px] text-fog-600">
            Mínimo 8 caracteres. Entrégala al usuario: en el MVP no hay restablecimiento
            desde la app.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className={ETIQUETA}>Roles</p>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => {
              const activo = roles.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle(r)}
                  aria-pressed={activo}
                  className={`rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${
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
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void onGuardar()}
          disabled={guardando}
          className="flex items-center justify-center rounded-md bg-signal px-3 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft active:scale-[0.98] disabled:opacity-60"
        >
          {guardando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </div>
    </PageShell>
  );
}