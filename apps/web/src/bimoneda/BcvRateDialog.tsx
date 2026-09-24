import { useEffect, useRef, useState } from 'react';
import { fetchBcvRate } from './api';
import { ensureAppConfig, getAppConfig, saveBcvRate } from './appConfig';
import { hasPermission, type Role } from '@brian/shared';

export interface BcvRateDialogProps {
  open: boolean;
  onClose: () => void;
  roles: readonly Role[];
}

/**
 * Diálogo de configuración de la tasa BCV (PRD §7.4): desde la API oficial o
 * captura manual cuando no hay red. Solo admin/supervisor editan (permisos
 * §3.3 vía hasPermission); el resto ve la tasa en solo lectura.
 */
export default function BcvRateDialog({ open, onClose, roles }: BcvRateDialogProps) {
  const [rate, setRate] = useState<string | null>(null);
  const [manualRate, setManualRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const canEdit = hasPermission('view_kpis', roles);

  useEffect(() => {
    if (!open) return;
    setRate(null);
    setManualRate('');
    setMessage(null);
    (async () => {
      const cfg = await getAppConfig();
      if (cfg && cfg.bcv_rate !== undefined) setRate(cfg.bcv_rate.toFixed(2));
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open && canEdit && !busy) inputRef.current?.focus();
  }, [open, canEdit, busy]);

  if (!open) return null;

  const onClickRefresh = async () => {
    setBusy(true);
    setMessage(null);
    const fetched = await fetchBcvRate();
    if (fetched === null) {
      setMessage({ kind: 'error', text: 'Sin red para BCV: usa la captura manual.' });
    } else {
      await saveBcvRate(fetched, 'BCV_API');
      await ensureAppConfig(fetched);
      setRate(fetched.toFixed(2));
      setMessage({ kind: 'ok', text: `Tasa BCV actualizada: ${fetched.toFixed(2)} Bs/USD` });
    }
    setBusy(false);
  };

  const onClickManual = async () => {
    const value = Number(manualRate);
    if (!Number.isFinite(value) || value <= 0) {
      setMessage({ kind: 'error', text: 'Tasa inválida.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    await saveBcvRate(value, 'manual');
    await ensureAppConfig(value);
    setRate(value.toFixed(2));
    setBusy(false);
    setMessage({ kind: 'ok', text: `Tasa manual guardada: ${value.toFixed(2)} Bs/USD` });
    setManualRate('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="bcv-dialog-title"
    >
      <div className="w-full max-w-sm rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between gap-4">
          <p
            id="bcv-dialog-title"
            className="font-mono text-[11px] uppercase tracking-wider text-fog-500"
          >
            Configurar tasa BCV
          </p>
          <button
            onClick={onClose}
            aria-label="Cerrar diálogo"
            className="rounded-md px-2 py-1 font-mono text-[11px] text-fog-500 transition-colors hover:text-fog-300"
          >
            cerrar
          </button>
        </div>

        <p className="mt-3 text-sm text-fog-100">
          Tasa actual:{' '}
          <span className="font-mono tabular-nums text-signal">
            {rate ?? 'Sin tasa configurada'}
          </span>{' '}
          Bs/USD
        </p>

        {canEdit && (
          <div className="mt-4 flex flex-col gap-3">
            <button
              onClick={onClickRefresh}
              disabled={busy}
              className="rounded-md bg-signal px-3 py-1.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft disabled:opacity-50"
            >
              {busy ? 'Cargando…' : 'Actualizar desde BCV'}
            </button>

            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-fog-700">o</span>
              <div className="h-px flex-1 bg-ink-700" aria-hidden="true" />
            </div>

            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="number"
                step="0.01"
                min="0"
                placeholder="Tasa manual (Bs/USD)"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600"
              />
              <button
                onClick={onClickManual}
                disabled={busy}
                className="rounded-md bg-ink-700 px-3 py-1.5 text-sm font-medium text-fog-100 transition-colors hover:bg-ink-600 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        )}

        <p
          role="alert"
          className={`mt-3 text-xs ${message?.kind === 'error' ? 'text-danger' : 'text-ok'}`}
        >
          {message?.text ?? ''}
        </p>
      </div>
    </div>
  );
}
