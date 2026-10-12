import { useState } from 'react';
import { hasPermission, type Role } from '@brian/shared';
import PageShell from './PageShell';
import { useTasaGate } from './RequireBcvRateGate';
import { Icon } from '../ui/icons';
import { haceRelativo } from '../ui/tiempo';
import { dosDecimales } from '../lib/moneda';

/**
 * Pantalla de tasa BCV obligatoria: sin ella el hub no entra (PRD §2.6). Solo
 * admin/supervisor (`view_kpis`) pueden actualizarla (API oficial o manual).
 */
export default function TasaRequerida({ roles }: { roles: readonly Role[] }) {
  const { tasa, source, actualizadoEn, refrescando, refrescar, guardarManual } = useTasaGate();
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
      setError('No se pudo consultar la API oficial. Revisa la conexión o usa la captura manual.');
    } else {
      setAviso(`Tasa oficial aplicada: ${dosDecimales(fetched)} Bs/USD`);
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
      setAviso(`Tasa manual guardada: ${dosDecimales(valor)} Bs/USD`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <PageShell titulo="Configurar tasa BCV" icono="coins">
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-ink-700 bg-ink-900 p-4 shadow-card">
          <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">
            Para operar necesitas la tasa BCV
          </p>
          <p className="mt-1 font-mono text-4xl tabular-nums text-fog-100">
            {hayTasa ? dosDecimales(tasa) : '—'}
            <span className="ml-2 font-sans text-sm font-medium text-fog-500">Bs/USD</span>
          </p>
          {hayTasa && (
            <p className="mt-1.5 text-2xs text-fog-500">
              {source === 'BCV_API' ? 'API oficial' : 'captura manual'}
              {actualizadoEn ? ` · actualizada ${haceRelativo(actualizadoEn)}` : ''}
            </p>
          )}
          {!hayTasa && (
            <p className="mt-2 text-sm text-fog-500">
              Sin tasa no se puede calcular el precio en Bs de una venta. Configúrala para
              continuar.
            </p>
          )}
        </div>

        {canEdit ? (
          <>
            <button
              type="button"
              onClick={() => void onRefrescar()}
              disabled={refrescando}
              aria-busy={refrescando}
              className="btn-lift cta-glow inline-flex w-full items-center justify-center gap-2 rounded-md bg-signal px-4 py-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft active:scale-[0.99] disabled:opacity-60"
            >
              <Icon name="refresh" className={`size-4 ${refrescando ? 'animate-spin' : ''}`} />
              {refrescando ? 'Consultando la BCV…' : 'Obtener la tasa oficial'}
            </button>

            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="font-mono text-2xs uppercase tracking-wider text-fog-600">o</span>
              <div className="h-px flex-1 bg-ink-700" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="bcv-manual"
                className="font-mono text-2xs uppercase tracking-wider text-fog-600"
              >
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
                  className="w-full rounded-md border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-signal"
                />
                <button
                  type="button"
                  onClick={() => void onGuardar()}
                  disabled={guardando}
                  className="btn-lift shrink-0 rounded-md border border-ink-600 px-4 text-sm font-medium text-fog-100 transition-colors hover:bg-ink-800 disabled:opacity-50"
                >
                  {guardando ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-ink-700 bg-ink-900 p-4 text-sm text-fog-500">
            Tu rol consulta la tasa pero no la configura. Pide a un administrador o supervisor que
            la actualice para continuar.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
          >
            {error}
          </p>
        )}
        {aviso && (
          <p
            role="status"
            className="rounded-md border border-ok/40 bg-ok/10 px-3 py-2 text-xs text-ok"
          >
            {aviso}
          </p>
        )}
      </div>
    </PageShell>
  );
}
