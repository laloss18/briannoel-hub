import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useSesion } from '../app/sesion';
import { Icon, type IconName } from '../ui/icons';
import { usernameSchema } from '@brian/shared';
import BimonedaCard from '../bimoneda/BimonedaCard';
import { supabase } from '../sync/supabase';

interface Item {
  label: string;
  to: string;
  icon: IconName;
}

const LINKS: readonly Item[] = [
  { label: 'Tasa BCV', to: '/config/tasa', icon: 'coins' },
];

/** Configuración del hub: acceso a tasa, cuentas, catálogo y zonas. */
export default function ConfigPage() {
  const { roles } = useSesion();

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-fog-100">
          <Icon name="settings" className="size-4 text-fog-500" />
          Configuración
        </h1>
      </header>

      <nav aria-label="Ajustes" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LINKS.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex items-center gap-2 rounded-md border border-ink-700 bg-ink-900 px-3 py-2.5 text-[13px] text-fog-100 transition-colors hover:border-ink-600 active:scale-[0.98]"
          >
            <Icon name={l.icon} className="size-4 shrink-0 text-signal" />
            <span className="truncate">{l.label}</span>
          </Link>
        ))}
      </nav>

      <BimonedaCard roles={roles} />
      <MiPerfil />
    </div>
  );
}

function MiPerfil() {
  const sesion = useSesion();
  const [uname, setUname] = useState(sesion.username ?? '');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUname(sesion.username ?? '');
  }, [sesion.username]);

  const onGuardar = async () => {
    const v = uname.trim().toLowerCase();
    const ok = usernameSchema.safeParse(v);
    if (!ok.success) {
      setMsg({ kind: 'error', text: 'Username inválido (3–20 letras/números/guión bajo).' });
      return;
    }
    if (!supabase) {
      setMsg({ kind: 'error', text: 'Supabase no configurado.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { username: v } });
      if (error) throw error;
      await supabase.auth.refreshSession();
      setMsg({ kind: 'ok', text: 'Username actualizado. Puede que necesites recargar para verlo en la sesión.' });
    } catch (e) {
      setMsg({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Mi perfil</p>
          <p className="mt-1 text-xs text-fog-500">Configura tu nombre de usuario visible</p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-fog-500">email</span>
          <input
            type="email"
            value={sesion.email}
            disabled
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-fog-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-fog-500">username</span>
          <input
            type="text"
            value={uname}
            onChange={(e) => setUname(e.target.value)}
            placeholder="tu_usuario"
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-fog-100"
          />
        </label>
        <button
          onClick={onGuardar}
          disabled={busy}
          className="mt-1 self-start rounded-md border border-ink-600 px-3 py-1.5 text-sm font-medium text-fog-100 transition-colors hover:border-ink-500 disabled:opacity-50"
        >
          {busy ? 'Guardando…' : 'Guardar username'}
        </button>
        {msg && (
          <p role="alert" className={`text-xs ${msg.kind === 'error' ? 'text-danger' : 'text-ok'}`}>
            {msg.text}
          </p>
        )}
      </div>
    </div>
  );
}