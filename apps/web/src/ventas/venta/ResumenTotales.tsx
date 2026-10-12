import { usd } from '../../lib/moneda';

export type ModoMonto = 'pct' | 'monto';

/** Bloque de totales del wizard de venta (subtotal → descuento → mora → IVA → total). */
export interface Totales {
  subtotal: number;
  descuento: { activo: boolean; ok: boolean; modo: ModoMonto; etiqueta: string; monto: number };
  mora: { activo: boolean; ok: boolean; modo: ModoMonto; etiqueta: string; monto: number };
  iva: { usado: number; monto: number };
  total: number;
}

export function ResumenTotales({ totales }: { totales: Totales }) {
  const { subtotal, descuento, mora, iva, total } = totales;
  return (
    <div className="rounded-lg border border-ink-700/60 p-2.5 font-mono text-2xs text-fog-500">
      <div className="flex justify-between">
        <span>subtotal</span>
        <span className="tabular-nums text-fog-100">{usd(subtotal)}</span>
      </div>
      {descuento.activo && !descuento.ok && (
        <div className="flex justify-between text-danger">
          <span>descuento</span>
          <span>{descuento.modo === 'pct' ? 'máx 100%' : `máx ${usd(subtotal)}`}</span>
        </div>
      )}
      {descuento.activo && descuento.ok && (
        <div className="flex justify-between">
          <span>descuento · {descuento.etiqueta}</span>
          <span className="tabular-nums text-signal-strong">−{usd(descuento.monto)}</span>
        </div>
      )}
      {mora.activo && !mora.ok && (
        <div className="flex justify-between text-danger">
          <span>recargo por mora</span>
          <span>{mora.modo === 'pct' ? 'máx 100%' : `máx ${usd(subtotal)}`}</span>
        </div>
      )}
      {mora.ok && (
        <div className="flex justify-between">
          <span>recargo por mora · {mora.etiqueta}</span>
          <span className="tabular-nums text-signal-strong">+{usd(mora.monto)}</span>
        </div>
      )}
      {iva.usado > 0 && (
        <div className="flex justify-between">
          <span>IVA {iva.usado}%</span>
          <span className="tabular-nums text-signal-strong">+{usd(iva.monto)}</span>
        </div>
      )}
      <div className="mt-0.5 flex justify-between border-t border-ink-800 pt-1 text-xs">
        <span className="uppercase tracking-wider">total</span>
        <span className="tabular-nums text-signal-strong">{usd(total)}</span>
      </div>
    </div>
  );
}
