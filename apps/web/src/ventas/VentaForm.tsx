import { useEffect, useRef, useState } from 'react';
import type { Cliente, Item, Role } from '@brian/shared';
import { hasPermission } from '@brian/shared';
import type { NuevaVentaRepoInput } from './ventasRepo';

export type VentaFormInput = Omit<NuevaVentaRepoInput, 'vendedor' | 'editor_role'>;

export interface VentaFormProps {
  open: boolean;
  onClose: () => void;
  roles: readonly Role[];
  clientes: Cliente[];
  items: Item[];
  /** Email del usuario de la sesión activa para auditoría (§3.1). */
  email: string;
  onSubmit: (form: VentaFormInput) => Promise<void>;
}

/**
 * Registro de venta / despacho (PRD §2.2, flujo promotor→supervisor): cliente,
 * condición (crédito/contado) y canal (mayor/detal), líneas del catálogo con
 * precio según condición×canal y snapshot de la tasa BCV. El descuento exige
 * aprobación (§3.3): admin 1 paso, supervisor 2 — la UI solo lo ofrece a quien
 * pueda aprobarlo (`discount`).
 */
export function VentaForm({ open, onClose, roles, clientes, items, email, onSubmit }: VentaFormProps) {
  const [clienteId, setClienteId] = useState('');
  const [condicion, setCondicion] = useState<'credito' | 'contado'>('contado');
  const [canal, setCanal] = useState<'mayor' | 'detal'>('mayor');
  const [lineas, setLineas] = useState<{ itemId: string; cantidad: string }[]>([
    { itemId: '', cantidad: '1' },
  ]);
  const [tasaBcv, setTasaBcv] = useState('');
  const [descuentoPct, setDescuentoPct] = useState('0');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const firstRef = useRef<HTMLSelectElement>(null);

  const canDiscount = hasPermission('discount', roles);

  useEffect(() => {
    if (!open) return;
    setClienteId('');
    setCondicion('contado');
    setCanal('mayor');
    setLineas([{ itemId: '', cantidad: '1' }]);
    setTasaBcv('');
    setDescuentoPct('0');
    setMessage(null);
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
    if (open) firstRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  const precioDe = (item: Item) =>
    condicion === 'credito' ? (canal === 'mayor' ? item.precio_credito_mayor : item.precio_credito_detal) : canal === 'mayor' ? item.precio_contado_mayor : item.precio_contado_detal;

  const subtotal = lineas.reduce((acc, l) => {
    const item = items.find((i) => i.id === l.itemId);
    const cant = Number(l.cantidad);
    return item && Number.isFinite(cant) ? acc + cant * precioDe(item) : acc;
  }, 0);
  const total = subtotal - subtotal * (Math.min(100, Number(descuentoPct) || 0) / 100);

  const updateLinea = (idx: number, patch: Partial<{ itemId: string; cantidad: string }>) => {
    setLineas((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const onClickGuardar = async () => {
    if (!cliente) {
      setMessage({ kind: 'error', text: 'Selecciona un cliente.' });
      return;
    }
    const prepared = lineas.map((l) => {
      const item = items.find((i) => i.id === l.itemId);
      return item ? { item, cantidad: Number(l.cantidad) } : null;
    });
    if (prepared.some((p) => p === null || !Number.isInteger(p.cantidad) || p.cantidad <= 0)) {
      setMessage({ kind: 'error', text: 'Cada línea requiere un ítem y una cantidad entera positiva.' });
      return;
    }
    const tasa = Number(tasaBcv);
    if (!Number.isFinite(tasa) || tasa <= 0) {
      setMessage({ kind: 'error', text: 'La tasa BCV es obligatoria (snapshot, §2.6).' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await onSubmit({
        cliente,
        condicion,
        canal,
        lineas: prepared as { item: Item; cantidad: number }[],
        tasa_bcv: tasa,
        descuento:
          Number(descuentoPct) > 0
            ? { pct: Number(descuentoPct), aprobado_por: email, pasos: roles.includes('admin') ? 1 : 2 }
            : undefined,
      });
      setBusy(false);
      setMessage({ kind: 'ok', text: 'Venta registrada y encolada para sync.' });
      onClose();
    } catch (err) {
      setBusy(false);
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  };

  const inputCls =
    'w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="venta-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-ink-700 bg-ink-900 p-4 text-fog-100 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between gap-4">
          <p id="venta-dialog-title" className="font-mono text-[11px] uppercase tracking-wider text-fog-500">
            Registrar venta
          </p>
          <button
            onClick={onClose}
            aria-label="Cerrar diálogo"
            className="rounded-md px-2 py-1 font-mono text-[11px] text-fog-500 transition-colors hover:text-fog-300"
          >
            cerrar
          </button>
        </div>

        <div className="mt-4 flex max-h-[70dvh] flex-col gap-2.5 overflow-y-auto pr-1">
          <select ref={firstRef} value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={inputCls}>
            <option value="">Cliente *</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={condicion}
              onChange={(e) => setCondicion(e.target.value as 'credito' | 'contado')}
              className={inputCls}
            >
              <option value="contado">Contado</option>
              <option value="credito">Crédito</option>
            </select>
            <select value={canal} onChange={(e) => setCanal(e.target.value as 'mayor' | 'detal')} className={inputCls}>
              <option value="mayor">Mayor</option>
              <option value="detal">Detal</option>
            </select>
          </div>

          <p className="font-mono text-[10px] uppercase tracking-wider text-fog-700">líneas del despacho</p>
          {lineas.map((l, idx) => {
            const item = items.find((i) => i.id === l.itemId);
            return (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={l.itemId}
                  onChange={(e) => updateLinea(idx, { itemId: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Ítem *</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} · {precioDe(i).toFixed(2)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={l.cantidad}
                  onChange={(e) => updateLinea(idx, { cantidad: e.target.value })}
                  className={`${inputCls} w-20 shrink-0`}
                  aria-label={`Cantidad de ${item?.nombre ?? 'la línea'}`}
                />
                {lineas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLineas((ls) => ls.filter((_, i) => i !== idx))}
                    className="shrink-0 rounded-md px-1.5 py-1 font-mono text-[11px] text-danger transition-colors hover:text-danger-soft"
                    aria-label="Quitar línea"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setLineas((ls) => [...ls, { itemId: '', cantidad: '1' }])}
            className="self-start rounded-md border border-ink-700 px-2.5 py-1 font-mono text-[11px] text-fog-100 transition-colors hover:border-ink-600"
          >
            + añadir línea
          </button>

          <input
            type="number"
            step="any"
            placeholder="Tasa BCV * (snapshot)"
            value={tasaBcv}
            onChange={(e) => setTasaBcv(e.target.value)}
            className={inputCls}
          />

          {canDiscount && (
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs text-fog-500">Descuento % (aprobado)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={descuentoPct}
                onChange={(e) => setDescuentoPct(e.target.value)}
                className={`${inputCls} w-24 shrink-0 text-right`}
              />
            </div>
          )}

          <div className="rounded-md border border-ink-700/60 p-2.5 font-mono text-[11px] text-fog-500">
            <div className="flex justify-between">
              <span>subtotal</span>
              <span className="tabular-nums text-fog-100">{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>total</span>
              <span className="tabular-nums text-signal">{total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={onClickGuardar}
            disabled={busy}
            className="mt-1 rounded-md bg-signal px-3 py-1.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft disabled:opacity-50"
          >
            {busy ? 'Guardando…' : 'Registrar venta'}
          </button>
        </div>

        <p role="alert" className={`mt-3 text-xs ${message?.kind === 'error' ? 'text-danger' : 'text-ok'}`}>
          {message?.text ?? ''}
        </p>
      </div>
    </div>
  );
}