import { useEffect } from 'react';

export type ModuleId =
  | 'config'
  | 'clientes'
  | 'zonas'
  | 'ventas'
  | 'cobranza'
  | 'pagos'
  | 'rutas'
  | 'reportes';

export interface ModuleDef {
  id: ModuleId;
  name: string;
  phase: number;
  status: 'listo' | 'siguiente' | 'pendiente';
}

interface ModuleMenuProps {
  open: boolean;
  modules: readonly ModuleDef[];
  onClose: () => void;
  onSelect: (id: ModuleId) => void;
}

/**
 * Menú de módulos (drawer): panel desde la barra superior con el índice del MVP.
 * Solo los módulos `listo` navegan; el resto queda marcado con su fase. Semántica
 * `<button>` para acciones, Escape/fondo cierra (DESIGN §9, §10.10).
 */
export default function ModuleMenu({ open, modules, onClose, onSelect }: ModuleMenuProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-ink-950/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Menú de módulos"
    >
      <div className="slide-in-right flex h-dvh w-full max-w-xs flex-col border-r border-ink-700 bg-ink-900 p-4 text-fog-100">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-fog-500">Módulos</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="rounded-md px-2 py-1 font-mono text-[11px] text-fog-500 transition-colors hover:text-fog-300"
          >
            cerrar
          </button>
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Módulos del MVP">
          {modules.map((m) => (
            <button
              key={m.id}
              type="button"
              disabled={m.status !== 'listo'}
              onClick={() => onSelect(m.id)}
              className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-[background-color,border-color] ${
                m.status === 'listo'
                  ? 'border-ink-700 hover:border-ink-600 hover:bg-ink-800'
                  : 'border-ink-700/40'
              } ${m.status === 'listo' ? 'cursor-pointer' : 'cursor-default'}`}
              aria-disabled={m.status !== 'listo'}
            >
              <span
                className={`text-[13px] font-medium ${
                  m.status === 'listo' ? 'text-fog-100' : 'text-fog-700'
                }`}
              >
                {m.name}
              </span>
              <span
                className={`shrink-0 font-mono text-[10px] uppercase tracking-wider ${
                  m.status === 'listo' ? 'text-ok' : 'text-fog-700'
                }`}
              >
                fase {m.phase} · {m.status}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}