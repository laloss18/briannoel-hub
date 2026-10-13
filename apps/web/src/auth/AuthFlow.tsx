import { useState } from 'react';
import { Brand, StatusStrip } from '../ui/brand';
import type { UseAuthResult } from './useAuth';
import type { AuthScreen } from './useAuth';

/**
 * Pantallas de auth del hub (PRD §3.4): login online, creación de PIN en el
 * primer ingreso y desbloqueo posterior. Un solo hilo visual: tinta + ámbar
 * (nodo bimoneda/BCV) + reloj del dispositivo, que es la fuente de verdad del
 * sync (clockSync).
 */
export default function AuthFlow({ auth }: { auth: UseAuthResult }) {
  if (auth.screen === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col justify-between gap-8 px-5 py-6 sm:py-10">
        <Brand />
        <p className="font-mono text-2xs text-fog-600">leyendo dispositivo…</p>
        <StatusStrip />
      </div>
    );
  }
  switch (auth.screen) {
    case 'setup-pin':
      return <SetupPinScreen auth={auth} />;
    case 'unlock':
      return <UnlockScreen auth={auth} />;
    default:
      return <LoginScreen auth={auth} />;
  }
}

/* ── Caparazón compartido ─────────────────────────────────────────────── */

function Card({
  children,
  title,
  hint,
}: {
  children: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col justify-between gap-8 px-5 py-6 sm:py-10">
      <Brand />
      <div className="rise-in mx-auto w-full max-w-[360px]">
        <p className="text-xs font-medium text-fog-100">{title}</p>
        {hint && <p className="mt-1 text-xs leading-relaxed text-fog-500">{hint}</p>}
        <div className="mt-5">{children}</div>
      </div>
      <StatusStrip />
    </div>
  );
}

/* ── Login online ─────────────────────────────────────────────────────── */

function LoginScreen({ auth }: { auth: UseAuthResult }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await auth.login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const input =
    'w-full rounded-lg bg-ink-900 px-3.5 py-2.5 text-sm text-fog-100 placeholder:text-fog-600 caret-signal outline-none transition-colors hover:bg-ink-800';

  return (
    <Card title="Entrar a tu operación" hint="Sesión cifrada y guardada en este dispositivo.">
      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div>
          <label
            className="mb-1 block font-mono text-2xs uppercase tracking-wider text-fog-500"
            htmlFor="login-email"
          >
            correo
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            autoFocus={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
            placeholder="tu@briannoel.com"
          />
        </div>
        <div>
          <label
            className="mb-1 block font-mono text-2xs uppercase tracking-wider text-fog-500"
            htmlFor="login-password"
          >
            contraseña
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={input}
            placeholder="••••••••"
          />
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded-lg bg-signal px-3.5 py-2.5 text-sm font-semibold text-on-signal transition-[filter,background-color] hover:bg-signal-soft active:brightness-90 disabled:opacity-50 btn-lift cta-glow"
        >
          {busy ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    </Card>
  );
}

/* ── Creación de PIN (primer ingreso) ─────────────────────────────────── */

function SetupPinScreen({ auth }: { auth: UseAuthResult }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== confirm) {
      setError('Los dos PIN no coinciden.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await auth.setupPin(pin);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const pinInput =
    'w-full rounded-lg bg-ink-900 px-3.5 py-3 text-center font-mono text-lg tracking-[0.5em] text-fog-100 caret-signal outline-none transition-colors hover:bg-ink-800';

  return (
    <Card title="Crea tu PIN" hint="4 a 8 dígitos. Es la llave para abrir el hub sin conexión.">
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <label
            className="mb-1 block font-mono text-2xs uppercase tracking-wider text-fog-500"
            htmlFor="pin-1"
          >
            nuevo PIN
          </label>
          <input
            id="pin-1"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={4}
            maxLength={8}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className={pinInput}
            placeholder="••••"
          />
        </div>
        <div>
          <label
            className="mb-1 block font-mono text-2xs uppercase tracking-wider text-fog-500"
            htmlFor="pin-2"
          >
            confirmar
          </label>
          <input
            id="pin-2"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            minLength={4}
            maxLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
            className={pinInput}
            placeholder="••••"
          />
        </div>
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || pin.length < 4 || confirm.length < 4}
          className="rounded-lg bg-signal px-3.5 py-2.5 text-sm font-semibold text-on-signal transition-[filter,background-color] hover:bg-signal-soft active:brightness-90 disabled:opacity-50 btn-lift cta-glow"
        >
          {busy ? 'Guardando…' : 'Guardar PIN'}
        </button>
      </form>
    </Card>
  );
}

/* ── Desbloqueo ───────────────────────────────────────────────────────── */

function UnlockScreen({ auth }: { auth: UseAuthResult }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const ok = await auth.unlock(pin);
    if (!ok) {
      const left = auth.state.attempts_left;
      setError(
        left > 0
          ? `PIN incorrecto. Quedan ${left} intento${left === 1 ? '' : 's'}.`
          : 'PIN incorrecto.',
      );
      setPin('');
    }
    setBusy(false);
  };

  const pinInput =
    'w-full rounded-lg bg-ink-900 px-3.5 py-3 text-center font-mono text-lg tracking-[0.5em] text-fog-100 caret-signal outline-none transition-colors hover:bg-ink-800';

  return (
    <Card
      title="Desbloquear hub"
      hint={
        auth.state.locked ? 'Demasiados intentos. Espera 60 s o pide ayuda al admin.' : undefined
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <label
          className="mb-1 block font-mono text-2xs uppercase tracking-wider text-fog-500"
          htmlFor="pin-unlock"
        >
          tu PIN
        </label>
        <input
          id="pin-unlock"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          required
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          className={pinInput}
          placeholder="••••"
          disabled={auth.state.locked}
        />
        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        {auth.state.locked && (
          <p className="text-xs text-signal-strong">
            Dispositivo bloqueado hasta que el admin lo desbloquee.
          </p>
        )}
        <button
          type="submit"
          disabled={busy || auth.state.locked || pin.length < 4}
          className="rounded-lg bg-signal px-3.5 py-2.5 text-sm font-semibold text-on-signal transition-[filter,background-color] hover:bg-signal-soft active:brightness-90 disabled:opacity-50 btn-lift cta-glow"
        >
          {busy ? 'Verificando…' : 'Entrar'}
        </button>
        <button
          type="button"
          onClick={auth.logout}
          className="text-center font-mono text-2xs text-fog-600 transition-colors hover:text-fog-500"
        >
          salir y borrar datos locales
        </button>
      </form>
    </Card>
  );
}

export { LoginScreen, SetupPinScreen, UnlockScreen };
export type { AuthScreen };
