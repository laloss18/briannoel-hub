import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasPermission, ROLES, usernameSchema, type Role as Rol } from '@brian/shared';
import PageShell from '../app/PageShell';
import { useSesion } from '../app/sesion';
import { adminCrearUsuario } from '../auth/usuariosRepo';
import { runSync } from '../sync/useSync';
import { FieldError, FormErrorSummary, inputCls } from '../ui/form';
import { erroresDe, fieldAria, useFormErrors, type Validadores } from '../ui/formErrors';

const ETIQUETA_ROL: Record<Rol, string> = {
  admin: 'administrador',
  supervisor: 'supervisor',
  promotor: 'promotor',
  cobrador: 'cobrador',
};

const ETIQUETA = 'text-2xs text-fog-500';

/**
 * Alta de cuenta (solo admin, §3.4): correo + nombre de usuario + contraseña
 * inicial + **un** rol (el usuario es una persona, un rol). No hay signup
 * público — la RPC `admin_create_app_user` es `SECURITY DEFINER` y valida el
 * rol admin en el servidor. Tras crearla, se dispara una sync para bajar el
 * perfil nuevo por delta.
 */
export default function NuevoUsuarioPage() {
  const { roles: misRoles } = useSesion();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<Rol>('promotor');
  const [guardando, setGuardando] = useState(false);
  const [estado, setEstado] = useState('');
  const { errors, fail, clear, validarCampo, summaryRef } = useFormErrors();

  if (!hasPermission('manage_personal', misRoles)) {
    return (
      <PageShell titulo="Nuevo usuario">
        <p className="text-xs text-fog-500">
          Solo el administrador puede dar de alta cuentas del hub.
        </p>
      </PageShell>
    );
  }

  const validadores = {
    email: () =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? undefined
        : 'Escribe un correo válido (clave de acceso y auditoría).',
    username: () =>
      usernameSchema.safeParse(username).success
        ? undefined
        : 'El nombre de usuario necesita 3 a 40 caracteres (letras, números y espacios).',
    password: () =>
      password.length >= 8 ? undefined : 'La contraseña necesita al menos 8 caracteres.',
  } satisfies Validadores;

  const onGuardar = async () => {
    if (!fail(erroresDe(validadores))) return;
    setGuardando(true);
    setEstado('');
    try {
      await adminCrearUsuario({ email, username, password, roles: [rol] });
      // La cuenta vive en el servidor: la bajamos ahora para que aparezca sin
      // esperar a la próxima sync (si falla, no bloquea el alta).
      setEstado('Cuenta creada. Sincronizando…');
      try {
        await runSync();
      } catch {
        // best-effort: el perfil llegará con la próxima sincronización
      }
      navigate('/config/usuarios');
    } catch (e) {
      fail({ general: e instanceof Error ? e.message : String(e) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <PageShell titulo="Nuevo usuario" icono="userPlus">
      <div className="flex flex-col gap-4">
        <FormErrorSummary errors={errors} summaryRef={summaryRef} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className={ETIQUETA}>
            Correo (clave de auditoría y de acceso)
          </label>
          <input
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              clear('email');
            }}
            onBlur={() => validarCampo('email', validadores.email())}
            className={inputCls}
            {...fieldAria('email', errors)}
          />
          <FieldError name="email" error={errors.email} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="username" className={ETIQUETA}>
            Nombre de usuario (lo que se ve en la app)
          </label>
          <input
            autoComplete="off"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              clear('username');
            }}
            onBlur={() => validarCampo('username', validadores.username())}
            placeholder="ej. Luis Pérez"
            className={inputCls}
            {...fieldAria('username', errors)}
          />
          <FieldError name="username" error={errors.username} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className={ETIQUETA}>
            Contraseña inicial
          </label>
          <input
            type="text"
            autoComplete="off"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              clear('password');
            }}
            onBlur={() => validarCampo('password', validadores.password())}
            className={`${inputCls} font-mono`}
            {...fieldAria('password', errors)}
          />
          <FieldError name="password" error={errors.password} />
          <p className="text-2xs text-fog-600">
            Mínimo 8 caracteres. Entrégala al usuario: en el MVP no hay restablecimiento desde la
            app.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className={ETIQUETA} id="rol-label">
            Rol
          </p>
          <div role="radiogroup" aria-labelledby="rol-label" className="flex flex-wrap gap-1.5">
            {ROLES.map((r) => {
              const activo = rol === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => setRol(r)}
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
          <p className="text-2xs text-fog-600">
            Un solo rol por cuenta. Cada persona tiene un único nivel de acceso.
          </p>
        </div>

        <p role="status" className="min-h-4 text-xs text-fog-500">
          {estado}
        </p>

        <button
          type="button"
          onClick={() => void onGuardar()}
          disabled={guardando}
          className="btn-lift cta-glow flex items-center justify-center rounded-md bg-signal px-3 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft active:scale-[0.98] disabled:opacity-60"
        >
          {guardando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </div>
    </PageShell>
  );
}
