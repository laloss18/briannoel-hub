/** Catálogo único de iconos (lucide-style, 24px, stroke 2). Un solo lugar para
 *  añadir glifos: evita duplicados inline y mantiene el mismo grosor en toda la
 *  app (DESIGN §1). Los glifos son decorativos: el que los usa pone el
 *  `aria-label`/`title` en el control. */
const PATHS = {
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['M20 6 9 17 4 12'],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M10 11v6',
    'M14 11v6',
  ],
  pencil: ['M17 3a2.83 2.83 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5Z', 'm15 5 4 4'],
  clear: ['M18 6 6 18', 'm6 6 12 12'],
  eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z'],
  list: ['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  /** Menú (hamburguesa): colapsa/expande el sidebar en desktop, abre el drawer
   *  en móvil. Es el control de la esquina superior derecha (DESIGN §5.2). */
  menu: ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  /** Panel izquierdo cerrado: usar cuando el sidebar está expandido. */
  panelLeftClose: ['M4 5h16', 'M4 12h10', 'M4 19h16', 'M21 5v14'],
  /** Panel izquierdo abierto: usar cuando el sidebar está colapsado. */
  panelLeftOpen: ['M4 5h16', 'M4 12h10', 'M4 19h16', 'M15 5v14'],
  chevronLeft: ['m15 18-6-6 6-6'],
  chevronRight: ['m9 18 6-6-6-6'],
  arrowLeft: ['M19 12H5', 'm12 19-7-7 7-7'],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z'],
  userPlus: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
    'M19 8v6',
    'M22 11h-6',
  ],
  package: [
    'm7.5 4.27 9 5.15',
    'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
    'm3.3 7 8.7 5 8.7-5',
    'M12 22V12',
  ],
  map: [
    'M14.1 6.3a2 2 0 0 0-1.7-.3l-5.4 1.2a2 2 0 0 1-1.7-.3l-2.6-1.6a1 1 0 0 0-1.2.2l-.4.4a1 1 0 0 0 0 1.4l.4.4a2 2 0 0 1 .7 1.2v6.2a2 2 0 0 1-.7 1.2l-.4.4a1 1 0 0 0 0 1.4l.4.4a1 1 0 0 0 1.2.2l2.6-1.6a2 2 0 0 1 1.7-.3l5.4 1.2a2 2 0 0 0 1.7.3l2.6 1.6a1 1 0 0 0 1.2-.2l.4-.4a1 1 0 0 0 0-1.4l-.4-.4a2 2 0 0 1-.7-1.2V8a2 2 0 0 1 .7-1.2l.4-.4a1 1 0 0 0 0-1.4l-.4-.4a1 1 0 0 0-1.2-.2Z',
    'M12 12v.01',
  ],
  mapPin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  home: ['m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  cart: [
    'M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
    'M19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
    'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12',
  ],
  settings: [
    'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z',
    'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  ],
  refresh: [
    'M3 12a9 9 0 0 1 15-6.7L21 8',
    'M21 3v5h-5',
    'M21 12a9 9 0 0 1-15 6.7L3 16',
    'M3 21v-5h5',
  ],
  logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  clock: ['M12 6v6l4 2', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z'],
  coins: [
    'M12 8a7 3 0 1 0 0-6 7 3 0 0 0 0 6Z',
    'M19 5v3',
    'M5 5v14a7 3 0 0 0 14 0',
    'M12 15a7 3 0 1 0 0 6 7 3 0 0 0 0-6Z',
  ],
  chart: ['M3 3v16a2 2 0 0 0 2 2h16', 'M7 16v-5', 'M12 16V8', 'M17 16v-3'],
  layers: ['m12 2 9 5-9 5-9-5Z', 'm3 12 9 5 9-5', 'm3 17 9 5 9-5'],
  fileText: [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v5h5',
    'M9 13h6',
    'M9 17h6',
  ],
  info: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 16v-4', 'M12 8h.01'],
  pin: [
    'M12 21s-7-5.6-7-11a7 7 0 1 1 14 0c0 5.4-7 11-7 11Z',
    'M12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  ],
  send: ['m22 2-7 20-4-9-9-4Z', 'M22 2 11 13'],
  save: [
    'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z',
    'M17 21v-8H7v8',
    'M7 3v5h8',
  ],
  wallet: [
    'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5',
    'M16 12h.01',
  ],
  /** Sol (tema claro): los rayos; el disco va en SHAPES. */
  sun: [
    'M12 1v2',
    'M12 21v2',
    'M4.22 4.22l1.42 1.42',
    'M18.36 18.36l1.42 1.42',
    'M1 12h2',
    'M21 12h2',
    'M4.22 19.78l1.42-1.42',
    'M18.36 5.64l1.42-1.42',
  ],
  /** Luna (tema oscuro). */
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'],
  /** Teléfono: acción "llamar" desde la lista de clientes. */
  phone: [
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  ],
  /** Deshacer: corrige una entrega marcada por error (desde la lista). */
  undo: ['M9 14 4 9l5-5', 'M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5 5.5 5.5 0 0 1-5.5 5.5H11'],
  /** Camión de reparto: entregar desde la lista. Las ruedas van en SHAPES. */
  truck: [
    'M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2',
    'M15 18H9',
    'M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14',
  ],
  /** Lupa: búsqueda de la barra de filtros. El disco va en SHAPES. */
  search: ['m21 21-4.35-4.35'],
  /** Embudo: filtros (por si se necesita un disparador compacto). */
  filter: ['M22 3H2l8 9.46V19l4 2v-8.54Z'],
  /** Chevron abajo: indica que el panel de filtros se despliega. */
  chevronDown: ['m6 9 6 6 6-6'],
} as const;

export type IconName = keyof typeof PATHS;

/** Formas que no son `<path>` (círculos) para no romper la geometría del glifo. */
const SHAPES: Partial<Record<IconName, ReadonlyArray<{ cx: number; cy: number; r: number }>>> = {
  search: [{ cx: 11, cy: 11, r: 8 }],
  eye: [{ cx: 12, cy: 12, r: 3 }],
  coins: [{ cx: 12, cy: 5, r: 3 }],
  sun: [{ cx: 12, cy: 12, r: 4 }],
  truck: [
    { cx: 17, cy: 18, r: 2 },
    { cx: 7, cy: 18, r: 2 },
  ],
};

interface IconProps {
  name: IconName;
  className?: string;
}

/** Glifo del catálogo. `aria-hidden` por defecto: es decorativo y el control
 *  que lo contiene aporta el nombre accesible. */
export function Icon({ name, className = 'size-4' }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
      {SHAPES[name]?.map((c) => (
        <circle key={`${c.cx}-${c.cy}`} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
    </svg>
  );
}
