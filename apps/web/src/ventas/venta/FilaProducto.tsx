import type { Item } from '@brian/shared';
import { usd } from '../../lib/moneda';

export interface FilaProductoProps {
  idx: number;
  linea: { itemId: string; cantidad: string };
  items: Item[];
  condicion: 'credito' | 'contado';
  precioDe: (item: Item) => number;
  quitarVisible: boolean;
  onItem: (idx: number, itemId: string) => void;
  onCantidad: (idx: number, cantidad: string) => void;
  onSumar: (idx: number, delta: number) => void;
  onQuitar: (idx: number) => void;
}

/** Una línea del despacho: selector de ítem + precio unitario + cantidad. */
export function FilaProducto({
  idx,
  linea,
  items,
  condicion,
  precioDe,
  quitarVisible,
  onItem,
  onCantidad,
  onSumar,
  onQuitar,
}: FilaProductoProps) {
  const item = items.find((i) => i.id === linea.itemId);
  const otro = condicion === 'credito' ? 'contado' : 'credito';
  const otroPrecio = item
    ? { tipo: otro, valor: otro === 'credito' ? item.precio_credito : item.precio_contado }
    : null;

  return (
    <div className="rounded-lg border border-ink-700 bg-ink-950 p-3">
      <div className="flex items-start gap-2">
        <select
          value={linea.itemId}
          onChange={(e) => onItem(idx, e.target.value)}
          aria-label={`Ítem del producto ${idx + 1}`}
          className="min-w-0 flex-1 cursor-pointer bg-ink-950 text-base font-semibold leading-snug text-fog-100 outline-none"
        >
          <option value="">Elegir ítem</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre}
            </option>
          ))}
        </select>
        {quitarVisible && (
          <button
            type="button"
            onClick={() => onQuitar(idx)}
            className="shrink-0 rounded-lg px-2 py-0.5 font-mono text-xs text-danger transition-colors hover:text-danger-soft"
            aria-label="Quitar producto"
          >
            ×
          </button>
        )}
      </div>
      {item ? (
        <p className="mt-1 font-mono text-2xs uppercase tracking-wider text-fog-500">
          unitario <span className="tabular-nums text-signal-strong">{usd(precioDe(item))}</span> ·{' '}
          {condicion}
          {otroPrecio && (
            <>
              {' '}
              ·{' '}
              <span className="text-fog-600">
                {otroPrecio.tipo} {usd(otroPrecio.valor)}
              </span>
            </>
          )}
        </p>
      ) : (
        <p className="mt-1 text-2xs text-fog-600">Elige el ítem del producto.</p>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-ink-800 pt-2">
        <span className="font-mono text-2xs uppercase tracking-wider text-fog-600">cantidad</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSumar(idx, -1)}
            className="size-11 shrink-0 rounded-lg border border-ink-700 text-fog-300 transition-colors hover:border-ink-600 hover:text-fog-100"
            aria-label="Quitar una unidad"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            step={1}
            value={linea.cantidad}
            onChange={(e) => onCantidad(idx, e.target.value)}
            aria-label={`Cantidad de ${item?.nombre ?? 'el producto'}`}
            className="w-16 shrink-0 rounded-lg border border-ink-700 bg-ink-950 px-2 py-1 text-center text-sm tabular-nums text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600"
          />
          <button
            type="button"
            onClick={() => onSumar(idx, 1)}
            className="size-11 shrink-0 rounded-lg border border-ink-700 text-fog-300 transition-colors hover:border-ink-600 hover:text-fog-100"
            aria-label="Añadir una unidad"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
