import { useEffect, useState } from 'react';
import { useSesion } from '../app/sesion';
import { useTema } from '../app/tema';
import { Icon } from '../ui/icons';
import { usernameSchema } from '@brian/shared';
import BimonedaCard from '../bimoneda/BimonedaCard';
import { supabase } from '../sync/supabase';

/** Configuración del hub: la tasa BCV vive en la tarjeta bimoneda (con acceso
 *  de edición para admin/supervisor), apariencia y perfil. */
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

      <Apariencia />
      <BimonedaCard roles={roles} />
      <MiPerfil />
    </div>
  );
}

/** Tema dual (DESIGN §3): claro por defecto, oscuro opcional. */
function Apariencia() {
  const [tema, cambiarTema] = useTema();

  return (
    <section className="rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-fog-100">Tema</p>
          <p className="mt-0.5 text-xs text-fog-500">Claro por defecto; oscuro para poca luz.</p>
        </div>
        <div role="group" aria-label="Tema de la interfaz" className="flex gap-1">
          {(['claro', 'oscuro'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tema === t}
              aria-label={t === 'claro' ? 'Tema claro' : 'Tema oscuro'}
              title={t === 'claro' ? 'Tema claro' : 'Tema oscuro'}
              onClick={() => cambiarTema(t)}
              className={`btn-lift flex size-11 shrink-0 items-center justify-center rounded-md border transition-colors ${
                tema === t ? 'border-signal bg-signal text-ink-950' : 'border-ink-600 text-fog-300 hover:bg-ink-800 hover:text-fog-100'
              }`}
            >
              <Icon name={t === 'claro' ? 'sun' : 'moon'} />
            </button>
          ))}
        </div>
      </div>
    </section>
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
          <span className="font-mono text-2xs uppercase tracking-wider text-fog-500">email</span>
          <input
            type="email"
            value={sesion.email}
            disabled
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-fog-500"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-2xs uppercase tracking-wider text-fog-500">username</span>
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
          className="btn-lift mt-1 self-start rounded-md border border-ink-600 px-3 py-1.5 text-sm font-medium text-fog-100 transition-colors hover:border-ink-500 disabled:opacity-50"
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