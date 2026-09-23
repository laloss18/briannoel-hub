import { useState } from 'react';
import type { UseAuthResult } from './useAuth';
import type { AuthScreen } from './useAuth';

export default function AuthFlow({ auth }: { auth: UseAuthResult }) {
  switch (auth.screen) {
    case 'login':
      return <LoginScreen auth={auth} />;
    case 'setup-pin':
      return <SetupPinScreen auth={auth} />;
    case 'unlock':
      return <UnlockScreen auth={auth} />;
    default:
      return (
        <div className="text-sm text-zinc-400">
          Cargando dispositivo… <span className="animate-pulse">▮</span>
        </div>
      );
  }
}

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

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div>
        <label className="text-xs text-zinc-400" htmlFor="login-email">
          Correo
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-400" htmlFor="login-password">
          Contraseña
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {busy ? 'Entrando…' : 'Entrar · primer login'}
      </button>
    </form>
  );
}

function SetupPinScreen({ auth }: { auth: UseAuthResult }) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin !== confirm) {
      setError('Los PINs no coinciden');
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

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-xs text-zinc-400">
        Crea un PIN de 4-8 dígitos para abrir la app sin conexión (§3.4).
      </p>
      <div>
        <label className="text-xs text-zinc-400" htmlFor="pin-1">
          PIN
        </label>
        <input
          id="pin-1"
          type="password"
          inputMode="numeric"
          required
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-400" htmlFor="pin-2">
          Confirmar PIN
        </label>
        <input
          id="pin-2"
          type="password"
          inputMode="numeric"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {busy ? 'Guardando…' : 'Activar PIN'}
      </button>
    </form>
  );
}

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
      setError(`PIN incorrecto · ${auth.state.attempts_left} intentos restantes`);
      setPin('');
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-xs text-zinc-400">Ingresa tu PIN para continuar.</p>
      {auth.state.locked && (
        <p className="text-xs text-amber-400">
          Dispositivo bloqueado: contacta al admin para desbloquear.
        </p>
      )}
      <input
        type="password"
        inputMode="numeric"
        required
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-blue-500"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy || auth.state.locked}
        className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {busy ? 'Verificando…' : 'Desbloquear'}
      </button>
      <button
        type="button"
        onClick={auth.logout}
        className="text-xs text-zinc-500 hover:text-zinc-300"
      >
        Salir y borrar datos locales
      </button>
    </form>
  );
}

export { LoginScreen, SetupPinScreen, UnlockScreen };
export type { AuthScreen };
