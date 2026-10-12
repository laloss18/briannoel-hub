import type { ChangeEvent } from 'react';

/** Manejador de captura de foto: comprime y entrega el data URL al setter. */
type FotoChangeHandler = (
  e: ChangeEvent<HTMLInputElement>,
  set: (data: string) => void,
) => Promise<void>;

/** Botón de captura de foto (cámara/galería del dispositivo) con preview y
 *  compresión en el device; el label abre el selector sin estado adicional.
 *  Compartido por el alta de cliente y el wizard de venta. */
export function MiniFoto({
  titulo,
  foto,
  onChange,
  onError,
}: {
  titulo: string;
  foto: string;
  onChange: (data: string) => void;
  onError: FotoChangeHandler;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-ink-700 p-2 transition-colors hover:border-ink-600">
      {foto ? (
        <img src={foto} alt="Vista previa" className="size-10 shrink-0 rounded object-cover" />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-ink-600 font-mono text-2xs text-fog-600">
          foto
        </span>
      )}
      <span className="flex-1 text-2xs text-fog-100">{titulo}</span>
      <span className="font-mono text-2xs uppercase tracking-wider text-fog-500">añadir</span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void onError(e, onChange)}
      />
    </label>
  );
}
