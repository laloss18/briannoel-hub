import { useState } from 'react';
import { hasPermission, type Role } from '@brian/shared';
import PageShell from './PageShell';
import { useTasaGate } from './RequireBcvRateGate';
import { Icon } from '../ui/icons';

/**
 * Pantalla de tasa BCV obligatoria: sin ella el hub no entra (PRD §2.6). Solo
 * admin/supervisor (`view_kpis`) pueden actualizarla (API oficial o manual).
 */
export default function TasaRequerida({ roles }: { roles: readonly Role[] }) {
  const { tasa, refrescando, refrescar, guardarManual } = useTasaGate();
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const canEdit = hasPermission('view_kpis', roles);
  const hayTasa = tasa !== null && tasa > 0;

  const onRefrescar = async () => {
    setError(null);
    setAviso(null);
    const fetched = await refrescar();
    if (fetched === null) {
      setError('Sin conexión con la BCV: usa la captura manual.');
    } else {
      setAviso(`Tasa oficial aplicada: ${fetched.toFixed(2)} Bs/USD`);
    }
  };

  const onGuardar = async () => {
    const valor = Number(manual);
    if (!Number.isFinite(valor) || valor <= 0) {
      setError('Escribe una tasa válida (Bs por dólar).');
      return;
    }
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      await guardarManual(valor);
      setManual('');
      setAviso(`Tasa manual guardada: ${valor.toFixed(2)} Bs/USD`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <PageShell titulo="Configurar tasa BCV" icono="coins">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-fog-600">
            Para operar necesitas la tasa BCV
          </p>
          <p className="mt-2 font-mono text-3xl tabular-nums text-fog-100">
            {hayTasa ? tasa.toFixed(2) : '—'}
            <span className="ml-1 text-sm text-fog-500">Bs/USD</span>
          </p>
          {!hayTasa && (
            <p className="mt-1 text-xs text-fog-500">
              Sin tasa no se puede calcular el precio en Bs de una venta. Configúrala para continuar.
            </p>
          )}
        </div>

        {canEdit ? (
          <>
            <button
              type="button"
              onClick={() => void onRefrescar()}
              disabled={refrescando}
              className="flex w-full max-w-[72px] items-center justify-center gap-1 rounded-md bg-signal px-1.5 py-1 text-xs font-semibold text-ink-950 transition-colors hover:bg-signal-soft active:scale-[0.98] disabled:opacity-60 sm:w-auto sm:max-w-none sm:px-2 sm:py-1 sm:text-xs"
            >
              <Icon name="refresh" className={refrescando ? 'animate-spin' : ''} />
              <span className="hidden sm:inline truncate">{refrescando ? 'Consultando…' : 'API'}</span>
              <span className="sm:hidden truncate">{refrescando ? '…' : 'API'}</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-fog-600">o</span>
              <div className="h-px flex-1 bg-ink-700" aria-hidden="true" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="bcv-manual" className="text-[11px] text-fog-500">
                Captura manual (Bs/USD)
              </label>
              <div className="flex gap-2">
                <input
                  id="bcv-manual"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600"
                />
                <button
                  type="button"
                  onClick={() => void onGuardar()}
                  disabled={guardando}
                  className="shrink-0 rounded-md border border-ink-600 px-3 py-2 text-sm font-medium text-fog-100 transition-colors hover:border-ink-500 disabled:opacity-50"
                >
                  Guardar
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-fog-500">
            Tu rol consulta la tasa pero no la configura. Pide a un administrador o supervisor que
            la actualice para continuar.
          </p>
        )}

        {error && (
          <p role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
        {aviso && <p className="text-xs text-ok">{aviso}</p>}
      </div>
    </PageShell>
  );
}