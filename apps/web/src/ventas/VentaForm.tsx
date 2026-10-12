import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { AppUser, Cliente, Despacho, Item, Personal, Role, Zona } from '@brian/shared';
import { hasPermission } from '@brian/shared';
import type { EditarVentaRepoInput, NuevaVentaRepoInput } from './ventasRepo';
import { crearClienteLocal, matchZona } from '../clientes/clientesRepo';
import { NuevaZonaDialog } from '../clientes/NuevaZonaDialog';
import { AbrirMapa, GeoBoton } from '../ui/geo';
import { CrearZonaBoton } from '../ui/zonas';
import { PersonaSelect, type PersonaOpcion } from '../ui/personal';
import { compressImage } from '../lib/photo';
import { MiniFoto } from '../ui/fotos';
import { obtenerCoords } from '../lib/geo';
import { normaliza } from '../lib/texto';
import { usd } from '../lib/moneda';
import { FieldError, FormErrorSummary } from '../ui/form';
import { fieldAria, useFormErrors, type FieldErrors } from '../ui/formErrors';

export type VentaFormInput = Omit<NuevaVentaRepoInput, 'vendedor' | 'editor_role'>;
export type EditarVentaFormInput = Omit<EditarVentaRepoInput, 'vendedor' | 'editor_role'>;

interface VentaFormProps {
  roles: readonly Role[];
  clientes: Cliente[];
  items: Item[];
  zonas: Zona[];
  /** Roster de personal: fuente secundaria de promotor/supervisor (legacy). */
  personal: Personal[];
  /** Usuarios registrados (`app_users`): identidades visibles (username) para
   *  elegir promotor y supervisor del pedido (PRD §3.4). */
  usuarios: AppUser[];
  /** Email del usuario de la sesión activa para auditoría (§3.1). */
  email: string;
  /** Despacho en `pedido` que se está editando (propietario o admin) o null en alta. */
  editing?: Despacho | null;
  onSubmit: (form: VentaFormInput) => Promise<void>;
  onEdit?: (form: EditarVentaFormInput) => Promise<void>;
  /** Se dispara tras guardar (la página navega al listado o al detalle). */
  onSuccess: () => void;
}

const STEPS = ['cliente', 'condición', 'personal', 'productos', 'revisión'] as const;
type Step = (typeof STEPS)[number];

/**
 * Registro de venta / despacho (PRD §2.2, flujo promotor→supervisor) como
 * onboarding guiado: 1. cliente, 2. condición (crédito/contado), 3. personal
 * (promotor que captó + supervisor a cargo), 4. productos despachados del
 * catálogo + descuento aprobado, 5. revisión y confirmación. En clientes a
 * crédito se puede añadir un recargo por mora (porcentaje o monto fijo) e IVA,
 * ambos incluidos en el total. Si el usuario autenticado es supervisor, el
 * campo supervisor se completa automáticamente con su identidad (roster o
 * email); si es promotor, se autocompleta el promotor. La tasa BCV NO participa
 * del cierre (PRD §2.6). Con `editing` el formulario precarga y entrega a
 * `onEdit`.
 */
export function VentaForm({
  roles,
  clientes,
  items,
  zonas,
  personal,
  usuarios,
  email,
  editing,
  onSubmit,
  onEdit,
  onSuccess,
}: VentaFormProps) {
  const [step, setStep] = useState<Step>('cliente');
  const [clienteId, setClienteId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoDocumento, setNuevoDocumento] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevoTelefono2, setNuevoTelefono2] = useState('');
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [nuevasNotas, setNuevasNotas] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [geoBusy, setGeoBusy] = useState(false);
  const [zonaId, setZonaId] = useState('');
  const [zonaDialogOpen, setZonaDialogOpen] = useState(false);
  const [fotoFachada, setFotoFachada] = useState('');
  const [fotoCliente, setFotoCliente] = useState('');
  const [fotoCedula, setFotoCedula] = useState('');
  const [fotoError, setFotoError] = useState('');
  const [condicion, setCondicion] = useState<'credito' | 'contado'>('contado');
  const [lineas, setLineas] = useState<{ itemId: string; cantidad: string }[]>(() => {
    const unico = items.length === 1 ? (items[0]?.id ?? '') : '';
    return [{ itemId: unico, cantidad: '1' }];
  });
  const [descuentoModo, setDescuentoModo] = useState<'pct' | 'monto'>('pct');
  const [descuentoValor, setDescuentoValor] = useState('0');
  const [moraModo, setMoraModo] = useState<'pct' | 'monto'>('pct');
  const [moraValor, setMoraValor] = useState('0');
  const [ivaPct, setIvaPct] = useState('');
  const [promotor, setPromotor] = useState('');
  const [supervisor, setSupervisor] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const { errors, fail, clear, summaryRef, setErrors } = useFormErrors();

  const canDiscount = hasPermission('discount', roles);
  /** Identidad operativa del usuario autenticado: username del perfil si está
   *  registrado, si no `name`/email, si no el roster, si no el email (para
   *  autocompletar supervisor/promotor según el rol). */
  const miPerfil = usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase());
  const identidad =
    miPerfil?.username ??
    miPerfil?.name ??
    personal.find((p) => p.email === email)?.nombre ??
    email;
  const userEsPromotor = roles.includes('promotor');
  const userEsSupervisor = roles.includes('supervisor');

  /** Candidatos para un slot de personal: usuarios registrados del rol + roster.
   *  El `value` guardado en el despacho es el username/nombre (identidad visible). */
  const candidatos = (rolesOk: readonly Role[]): PersonaOpcion[] => {
    const permitidos = new Set(rolesOk);
    const deApp = usuarios
      .filter((u) => u.active && u.roles.some((r) => permitidos.has(r)))
      .map((u) => ({ value: u.username ?? u.name ?? u.email, detalle: u.roles[0] }))
      .filter((o) => o.value.trim() !== '');
    const deRoster = personal
      .filter((p) => permitidos.has(p.rol))
      .map((p) => ({ value: p.nombre, detalle: p.rol }));
    const unicos = new Map<string, PersonaOpcion>();
    for (const o of [...deApp, ...deRoster]) unicos.set(o.value, o);
    return [...unicos.values()].sort((a, b) => a.value.localeCompare(b.value));
  };

  useEffect(() => {
    setStep('cliente');
    setClienteId(editing?.cliente_id ?? '');
    setBusqueda('');
    setNuevoNombre('');
    setNuevoDocumento('');
    setNuevoTelefono('');
    setNuevoTelefono2('');
    setNuevaDireccion('');
    setNuevasNotas('');
    setLat('');
    setLng('');
    setZonaId('');
    setFotoFachada('');
    setFotoCliente('');
    setFotoCedula('');
    setFotoError('');
    setCondicion(editing?.condicion ?? 'contado');
    setLineas(
      editing
        ? editing.lineas.map((l) => ({
            itemId: items.find((i) => i.id === l.item_id)?.id ?? '',
            cantidad: String(l.cantidad),
          }))
        : [{ itemId: items.length === 1 ? (items[0]?.id ?? '') : '', cantidad: '1' }],
    );
    setMoraModo(editing?.mora_monto_usd ? 'monto' : 'pct');
    setMoraValor(
      editing
        ? String(editing.mora_pct > 0 ? editing.mora_pct : (editing.mora_monto_usd ?? 0))
        : '0',
    );
    setIvaPct(editing?.iva_pct && editing.iva_pct > 0 ? String(editing.iva_pct) : '');
    setPromotor(editing?.promotor ?? '');
    setSupervisor(editing?.supervisor ?? '');
    // Autocompletado por rol (§3.3): si el usuario autenticado ES el supervisor,
    // queda asignado como supervisor a cargo; si es promotor, como promotor.
    if (!editing) {
      if (userEsSupervisor) setSupervisor(identidad);
      if (userEsPromotor) setPromotor(identidad);
    }
    if (editing && editing.descuento_monto_usd && editing.descuento_monto_usd > 0) {
      setDescuentoModo('monto');
      setDescuentoValor(String(editing.descuento_monto_usd));
    } else {
      setDescuentoModo('pct');
      const pct = editing?.descuento_pct ?? 0;
      setDescuentoValor(pct > 0 ? String(pct) : '0');
    }
    setMessage(null);
    // Reset al montar; items/editing se leen en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setErrors({});
    if (step === 'cliente' && window.matchMedia('(pointer: fine)').matches) {
      firstRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;

  const termino = normaliza(busqueda.trim());
  const coincidencias =
    termino === ''
      ? clientes
      : clientes.filter(
          (c) =>
            normaliza(c.nombre).includes(termino) ||
            (c.documento ?? '').toLowerCase().includes(termino),
        );

  const nombreCliente = cliente?.nombre ?? nuevoNombre.trim();

  const zonaMatch = matchZona(
    { lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null },
    zonas,
  );
  const zonaFinal = zonas.find((z) => z.id === (zonaId || zonaMatch?.id || '')) ?? null;

  const validarClienteNuevo = (): FieldErrors => {
    const e: FieldErrors = {};
    if (!nuevoNombre.trim()) e.nuevoNombre = 'Escribe el nombre del cliente nuevo.';
    if (!nuevoDocumento.trim())
      e.nuevoDocumento = 'El documento (cédula) del cliente es obligatorio.';
    if (!nuevoTelefono.trim()) e.nuevoTelefono = 'El teléfono del cliente es obligatorio.';
    if (
      !lat.trim() ||
      !lng.trim() ||
      !Number.isFinite(Number(lat)) ||
      !Number.isFinite(Number(lng))
    ) {
      e.lat =
        'Indica la ubicación del cliente (usa «usar mi ubicación» o escribe latitud y longitud).';
    }
    if (!zonaFinal) {
      e.zona = zonas.length
        ? 'La ubicación no coincide con una zona registrada. Elige o crea la zona del cliente.'
        : 'No hay zonas registradas. Créala con el icono «+» y úsala de inmediato.';
    }
    return e;
  };

  const usarMiUbicacion = async () => {
    setGeoBusy(true);
    const coords = await obtenerCoords();
    setGeoBusy(false);
    if (coords) {
      setLat(String(coords.lat));
      setLng(String(coords.lng));
      setZonaId('');
      clear('lat');
      return;
    }
    // Solo avisa si de verdad NO hay coordenadas: con lat/lng ya cargadas no
    // tiene sentido un error rojo (el usuario ya tiene su ubicación).
    if (!lat.trim() || !lng.trim()) {
      fail({
        lat: 'No se pudo obtener la ubicación. Escríbela manualmente en latitud y longitud.',
      });
    }
  };

  const onFoto = async (e: ChangeEvent<HTMLInputElement>, set: (data: string) => void) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      set(await compressImage(file));
      setFotoError('');
    } catch {
      setFotoError('No se pudo leer la foto elegida. Intenta con otra.');
    }
  };

  const precioDe = (item: Item) =>
    condicion === 'credito' ? item.precio_credito : item.precio_contado;

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const subtotal = lineas.reduce((acc, l) => {
    const item = items.find((i) => i.id === l.itemId);
    const cant = Number(l.cantidad);
    return item && Number.isFinite(cant) ? acc + cant * precioDe(item) : acc;
  }, 0);

  const descuentoValorNum = Number(descuentoValor);
  const descuentoActivo = Number.isFinite(descuentoValorNum) && descuentoValorNum > 0;
  const descuentoOk =
    descuentoActivo &&
    descuentoValorNum >= 0 &&
    (descuentoModo === 'pct' ? descuentoValorNum <= 100 : descuentoValorNum <= subtotal);
  const total = round2(
    descuentoOk
      ? descuentoModo === 'pct'
        ? subtotal - (subtotal * descuentoValorNum) / 100
        : Math.max(0, subtotal - descuentoValorNum)
      : subtotal,
  );
  const descuentoMonto = round2(subtotal - total);
  const descuentoEtiqueta =
    descuentoModo === 'pct' ? `${descuentoValorNum}%` : usd(descuentoValorNum);

  const moraValorNum = Number(moraValor);
  const moraActivo = condicion === 'credito' && Number.isFinite(moraValorNum) && moraValorNum > 0;
  const moraOk =
    moraActivo && (moraModo === 'pct' ? moraValorNum <= 100 : moraValorNum <= subtotal);
  const moraMonto = round2(
    moraOk ? (moraModo === 'pct' ? (subtotal * moraValorNum) / 100 : moraValorNum) : 0,
  );
  const moraEtiqueta = moraModo === 'pct' ? `${moraValorNum}%` : usd(moraValorNum);

  const ivaNum = Number(ivaPct);
  const ivaPctOk =
    ivaPct.trim() === '' || (Number.isFinite(ivaNum) && ivaNum >= 0 && ivaNum <= 100);
  const ivaUsado = ivaPct.trim() !== '' && Number.isFinite(ivaNum) && ivaNum > 0 ? ivaNum : 0;
  const ivaMonto = ivaUsado > 0 ? round2((total + moraMonto) * (ivaUsado / 100)) : 0;
  const totalFinal = round2(total + moraMonto + ivaMonto);

  const lineasValidas = lineas.filter((l) => l.itemId !== '');
  const lineasCompletas =
    lineasValidas.length > 0 &&
    lineasValidas.every((l) => {
      const cant = Number(l.cantidad);
      return Number.isInteger(cant) && cant > 0;
    });

  const updateLinea = (idx: number, patch: Partial<{ itemId: string; cantidad: string }>) => {
    clear('lineas');
    setLineas((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const anadirLinea = () =>
    setLineas((ls) => [
      ...ls,
      { itemId: items.length === 1 ? (items[0]?.id ?? '') : '', cantidad: '1' },
    ]);

  const sumarCantidad = (idx: number, delta: number) =>
    setLineas((ls) =>
      ls.map((l, i) => {
        if (i !== idx) return l;
        const actual = Math.floor(Number(l.cantidad) || 0);
        return { ...l, cantidad: String(Math.max(1, actual + delta)) };
      }),
    );

  const stepNext = (): boolean => {
    if (step === 'cliente') {
      if (cliente) {
        // cliente existente seleccionado: pasa directo
      } else if (nuevoNombre.trim() === '') {
        fail({ nuevoNombre: 'Busca un cliente o escribe los datos de uno nuevo.' });
        return false;
      } else if (!fail(validarClienteNuevo())) {
        return false;
      }
    }
    if (step === 'productos' && !lineasCompletas) {
      fail({ lineas: 'Cada producto necesita un ítem y una cantidad entera positiva.' });
      return false;
    }
    setMessage(null);
    fail({});
    setStep((s) => STEPS[STEPS.indexOf(s) + 1] ?? s);
    return true;
  };

  const onClickGuardar = async () => {
    setBusy(true);
    setMessage(null);
    try {
      let clienteFinal = cliente;
      if (!editing && clienteFinal === null && nuevoNombre.trim() !== '') {
        const errs = validarClienteNuevo();
        if (!fail(errs)) {
          setBusy(false);
          return;
        }
        clienteFinal = await crearClienteLocal(
          {
            nombre: nuevoNombre.trim(),
            documento: nuevoDocumento.trim(),
            telefono: nuevoTelefono.trim(),
            telefono2: nuevoTelefono2.trim() || undefined,
            notas_referencia: nuevasNotas.trim() || undefined,
            direccion: nuevaDireccion.trim() || undefined,
            lat: Number(lat),
            lng: Number(lng),
            foto_fachada: fotoFachada,
            foto_cliente: fotoCliente,
            foto_cedula: fotoCedula,
            consentimiento: {
              fecha: new Date().toISOString(),
              foto_casa: fotoFachada !== '',
              foto_documento: fotoCedula !== '',
              aviso_documento: fotoCedula !== '',
            },
            creado_por: email,
          },
          zonas,
          zonaFinal?.id,
        );
        setClienteId(clienteFinal.id);
      }
      if (!editing && clienteFinal === null) {
        setBusy(false);
        fail({ nuevoNombre: 'Busca un cliente o escribe los datos de uno nuevo.' });
        return;
      }
      if (!lineasCompletas) {
        setBusy(false);
        fail({ lineas: 'Agrega al menos un producto con ítem y cantidad entera.' });
        return;
      }
      if (moraActivo && !moraOk) {
        setBusy(false);
        fail({
          mora: 'Revisa el recargo por mora: porcentaje entre 0 y 100, o monto hasta el subtotal.',
        });
        return;
      }
      if (!ivaPctOk) {
        setBusy(false);
        fail({ iva: 'El porcentaje de IVA debe estar entre 0 y 100.' });
        return;
      }
      if (!editing && promotor.trim() === '') {
        setBusy(false);
        fail({ promotor: 'Indica quién es el promotor que captó al cliente.' });
        return;
      }
      if (!editing && supervisor.trim() === '') {
        setBusy(false);
        fail({ supervisor: 'Indica el supervisor a cargo de la entrega.' });
        return;
      }
      const prepared = lineasValidas.map((l) => {
        const item = items.find((i) => i.id === l.itemId);
        return item ? { item, cantidad: Number(l.cantidad) } : null;
      });
      if (prepared.some((p) => p === null)) {
        setBusy(false);
        fail({ lineas: 'Un producto no corresponde a un ítem del catálogo.' });
        return;
      }
      const lineas: { item: Item; cantidad: number }[] = prepared as {
        item: Item;
        cantidad: number;
      }[];
      const descuento = descuentoOk
        ? {
            ...(descuentoModo === 'pct'
              ? { pct: descuentoValorNum }
              : { monto_usd: descuentoValorNum }),
            aprobado_por: email,
            pasos: roles.includes('admin') ? 1 : 2,
          }
        : undefined;
      const mora = moraOk
        ? moraModo === 'pct'
          ? { pct: moraValorNum }
          : { monto_usd: moraValorNum }
        : undefined;
      const iva_pct = ivaUsado;
      if (editing && onEdit) {
        await onEdit({
          cliente: clienteFinal ?? undefined,
          condicion,
          lineas,
          descuento,
          mora,
          iva_pct,
        });
      } else {
        await onSubmit({
          cliente: clienteFinal as Cliente,
          condicion,
          lineas,
          descuento,
          mora,
          iva_pct,
          promotor: promotor.trim(),
          supervisor: supervisor.trim(),
        });
      }
      setBusy(false);
      setMessage({
        kind: 'ok',
        text: editing
          ? 'Venta actualizada y lista para sincronizar.'
          : 'Venta registrada y lista para sincronizar.',
      });
      onSuccess();
    } catch (err) {
      setBusy(false);
      fail({ general: err instanceof Error ? err.message : String(err) });
    }
  };

  const inputCls =
    'w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600';

  const optionCls = (active: boolean) =>
    `flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-[border-color,background-color] ${
      active ? 'border-signal bg-ink-950' : 'border-ink-700 hover:border-ink-600'
    }`;

  const stepIndex = STEPS.indexOf(step);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 text-fog-100">
      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-wider text-fog-500">
            paso {stepIndex + 1} de {STEPS.length} · {step}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-800" aria-hidden="true">
          <div
            className="h-1.5 rounded-full bg-signal transition-[width]"
            style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <FormErrorSummary errors={errors} summaryRef={summaryRef} />

      <div className="flex flex-col gap-3">
        {step === 'cliente' && (
          <>
            {cliente ? (
              <div className="rounded-md border border-signal/40 p-2.5">
                <p className="truncate text-xs font-medium text-fog-100">{cliente.nombre}</p>
                <p className="truncate font-mono text-2xs text-fog-600">
                  {cliente.documento || 'sin documento'} · {cliente.telefono || 'sin teléfono'}
                  {cliente.telefono2 ? ` · ${cliente.telefono2}` : ''}
                </p>
                <p className="truncate font-mono text-2xs text-fog-600">
                  zona:{' '}
                  {(() => {
                    const z = zonas.find((x) => x.id === cliente.zona_id);
                    return z ? `${z.nombre} · ${z.estado} (${z.municipio})` : 'sin zona';
                  })()}{' '}
                  · score {cliente.score_grado ?? '—'}
                </p>
                {[cliente.foto_fachada, cliente.foto_cliente, cliente.foto_cedula].some(
                  Boolean,
                ) && (
                  <div className="mt-1.5 flex gap-1.5">
                    {[cliente.foto_fachada, cliente.foto_cliente, cliente.foto_cedula].map(
                      (f, i) =>
                        f ? (
                          <img
                            key={i}
                            src={f}
                            alt={`Foto ${['fachada', 'cliente', 'cédula'][i]}`}
                            className="size-9 rounded-md border border-ink-700 object-cover"
                          />
                        ) : null,
                    )}
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-2xs text-fog-600">
                    {cliente.notas_referencia || ''}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    {cliente.lat != null && cliente.lng != null && (
                      <AbrirMapa lat={cliente.lat} lng={cliente.lng} />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setClienteId('');
                        setBusqueda('');
                      }}
                      className="font-mono text-2xs uppercase tracking-wider text-fog-500 transition-colors hover:text-fog-300"
                    >
                      cambiar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <input
                  ref={firstRef}
                  type="text"
                  placeholder="Buscar cliente por nombre o documento"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    setClienteId('');
                  }}
                  className={inputCls}
                />
                {coincidencias.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">
                      coincidencias
                    </p>
                    {coincidencias.slice(0, 6).map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setClienteId(c.id)}
                        className="flex flex-col items-start gap-0.5 rounded-md border border-ink-700 px-3 py-2 text-left transition-[border-color,background-color] hover:border-ink-600"
                      >
                        <span className="w-full truncate text-xs font-medium">{c.nombre}</span>
                        <span className="w-full truncate font-mono text-2xs text-fog-600">
                          {c.documento || 'sin documento'} · {c.telefono || 'sin teléfono'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {busqueda.trim() !== '' && coincidencias.length === 0 && (
                  <p className="text-xs text-fog-600">
                    Sin resultados. Si es un cliente nuevo, completa sus datos abajo.
                  </p>
                )}

                <div className="my-1 flex items-center gap-2 text-fog-600" aria-hidden="true">
                  <span className="h-px flex-1 bg-ink-700" />
                  <span className="font-mono text-2xs uppercase tracking-wider">cliente nuevo</span>
                  <span className="h-px flex-1 bg-ink-700" />
                </div>

                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    placeholder="Nombre del cliente *"
                    aria-label="Nombre del cliente nuevo"
                    value={nuevoNombre}
                    onChange={(e) => {
                      setNuevoNombre(e.target.value);
                      clear('nuevoNombre');
                    }}
                    className={inputCls}
                    {...fieldAria('nuevoNombre', errors)}
                  />
                  <FieldError name="nuevoNombre" error={errors.nuevoNombre} />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Cédula / RIF *"
                      aria-label="Cédula o RIF del cliente nuevo"
                      value={nuevoDocumento}
                      onChange={(e) => {
                        setNuevoDocumento(e.target.value);
                        clear('nuevoDocumento');
                      }}
                      className={inputCls}
                      {...fieldAria('nuevoDocumento', errors)}
                    />
                    <input
                      type="text"
                      placeholder="Teléfono (primario) *"
                      aria-label="Teléfono primario del cliente nuevo"
                      value={nuevoTelefono}
                      onChange={(e) => {
                        setNuevoTelefono(e.target.value);
                        clear('nuevoTelefono');
                      }}
                      className={inputCls}
                      {...fieldAria('nuevoTelefono', errors)}
                    />
                  </div>
                  <FieldError name="nuevoDocumento" error={errors.nuevoDocumento} />
                  <FieldError name="nuevoTelefono" error={errors.nuevoTelefono} />
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Teléfono secundario (opcional)"
                      value={nuevoTelefono2}
                      onChange={(e) => setNuevoTelefono2(e.target.value)}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      placeholder="Dirección (opcional)"
                      value={nuevaDireccion}
                      onChange={(e) => setNuevaDireccion(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Notas de referencia (cómo llegar, señas)"
                    value={nuevasNotas}
                    onChange={(e) => setNuevasNotas(e.target.value)}
                    className={inputCls}
                  />

                  <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">
                    ubicación para la zona
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <div className="grid grid-cols-2 gap-2 sm:contents">
                      <input
                        type="number"
                        step="any"
                        placeholder="Latitud"
                        aria-label="Latitud del cliente nuevo"
                        value={lat}
                        onChange={(e) => {
                          setLat(e.target.value);
                          setZonaId('');
                          clear('lat');
                        }}
                        className={inputCls}
                        {...fieldAria('lat', errors)}
                      />
                      <input
                        type="number"
                        step="any"
                        placeholder="Longitud"
                        aria-label="Longitud del cliente nuevo"
                        value={lng}
                        onChange={(e) => {
                          setLng(e.target.value);
                          setZonaId('');
                          clear('lat');
                        }}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex items-end">
                      <GeoBoton onClick={usarMiUbicacion} busy={geoBusy} />
                    </div>
                  </div>
                  <FieldError name="lat" error={errors.lat} />
                  <div className="flex items-start gap-2">
                    <select
                      value={zonaId || zonaMatch?.id || ''}
                      onChange={(e) => {
                        setZonaId(e.target.value);
                        clear('zona');
                      }}
                      className="min-w-0 flex-1 rounded-md border border-ink-700 bg-ink-950 px-3 py-1.5 text-sm text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600"
                      {...fieldAria('zona', errors)}
                    >
                      <option value="">Zona del cliente *</option>
                      {zonas.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.nombre} · {z.estado} ({z.municipio})
                        </option>
                      ))}
                    </select>
                    <CrearZonaBoton onClick={() => setZonaDialogOpen(true)} />
                  </div>
                  <FieldError name="zona" error={errors.zona} />
                  <p className="text-2xs text-fog-500">
                    Se sugiere la zona por cercanía; estado / municipio:{' '}
                    <span className="text-signal">
                      {zonaFinal
                        ? `${zonaFinal.estado} · ${zonaFinal.municipio}`
                        : 'por elegir zona'}
                    </span>
                  </p>

                  <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">
                    fotos del cliente
                  </p>
                  <MiniFoto
                    titulo="Fachada de la vivienda"
                    foto={fotoFachada}
                    onChange={setFotoFachada}
                    onError={onFoto}
                  />
                  <MiniFoto
                    titulo="Foto del cliente"
                    foto={fotoCliente}
                    onChange={setFotoCliente}
                    onError={onFoto}
                  />
                  <MiniFoto
                    titulo="Cédula de identidad"
                    foto={fotoCedula}
                    onChange={setFotoCedula}
                    onError={onFoto}
                  />
                  {fotoError && <p className="text-xs text-danger">{fotoError}</p>}
                  <p className="text-2xs text-fog-500">
                    Fotos recomendadas (fachada, cliente y cédula): se comprimen en el dispositivo y
                    viajan con el registro.
                  </p>

                  <p className="text-2xs text-fog-500">
                    Al capturar las fotos, el cliente autoriza registrar y usar sus datos y las
                    imágenes que se tomen (consentimiento §3.5).
                  </p>
                </div>
                {clientes.length === 0 && (
                  <p className="text-xs text-fog-600">
                    Completa «cliente nuevo» para darlo de alta al registrar la venta (se guardará
                    junto con la venta).
                  </p>
                )}
              </>
            )}
          </>
        )}

        {step === 'condición' && (
          <>
            <div className="flex flex-col gap-1">
              <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">condición</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCondicion('contado')}
                  className={optionCls(condicion === 'contado')}
                >
                  <span className="text-xs font-medium">Contado</span>
                  <span className="text-2xs text-fog-500">se cobra en el momento</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCondicion('credito')}
                  className={optionCls(condicion === 'credito')}
                >
                  <span className="text-xs font-medium">Crédito</span>
                  <span className="text-2xs text-fog-500">consume el límite del cliente</span>
                </button>
              </div>
            </div>
            <div className="rounded-md border border-ink-700/60 p-2.5 text-2xs text-fog-500">
              La condición define el precio unitario de cada ítem (el catálogo tiene precio contado
              y precio crédito).
            </div>
          </>
        )}

        {step === 'personal' && (
          <>
            <div className="flex flex-col gap-2.5">
              <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">
                personal a cargo
              </p>
              {userEsSupervisor && (
                <p className="text-xs text-fog-500">
                  Tu identidad de {userEsPromotor ? 'promotor y supervisor' : 'supervisor'} se
                  asigna automáticamente ({identidad}).
                </p>
              )}
              <label className="flex flex-col gap-1">
                <span className="font-mono text-2xs uppercase tracking-wider text-fog-500">
                  Promotor que captó al cliente
                </span>
                <PersonaSelect
                  value={promotor}
                  opciones={candidatos(['promotor', 'admin'])}
                  placeholder={userEsPromotor ? identidad : 'Elegir promotor de la lista…'}
                  emptyMessage="Registra promotores en Configuración → Usuarios"
                  onChange={(v) => {
                    setPromotor(v);
                    clear('promotor');
                  }}
                  id="promotor"
                  invalid={Boolean(errors.promotor)}
                  describedBy="promotor-error"
                />
                <FieldError name="promotor" error={errors.promotor} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-2xs uppercase tracking-wider text-fog-500">
                  Supervisor a cargo de la entrega
                </span>
                <PersonaSelect
                  value={supervisor}
                  opciones={candidatos(['supervisor', 'admin'])}
                  placeholder={userEsSupervisor ? identidad : 'Elegir supervisor de la lista…'}
                  emptyMessage="Registra supervisores en Configuración → Usuarios"
                  onChange={(v) => {
                    setSupervisor(v);
                    clear('supervisor');
                  }}
                  id="supervisor"
                  invalid={Boolean(errors.supervisor)}
                  describedBy="supervisor-error"
                />
                <FieldError name="supervisor" error={errors.supervisor} />
              </label>
            </div>
            <div className="rounded-md border border-ink-700/60 p-2.5 text-xs text-fog-500">
              El promotor que toma el pedido y el supervisor responsable se eligen del personal
              registrado: solo ellos (o el admin) podrán gestionar este registro (§3.3).
            </div>
          </>
        )}

        {step === 'productos' && (
          <>
            <p className="font-mono text-2xs uppercase tracking-wider text-fog-600">
              productos despachados
            </p>
            <p className="text-2xs text-fog-500">
              El precio unitario depende de la condición de la venta: {condicion}.
            </p>
            {lineas.map((l, idx) => {
              const item = items.find((i) => i.id === l.itemId);
              const precioDeOtroTipo = () => {
                if (!item) return null;
                const otro = condicion === 'credito' ? 'contado' : 'credito';
                return {
                  tipo: otro,
                  valor: otro === 'credito' ? item.precio_credito : item.precio_contado,
                };
              };
              const otroPrecio = precioDeOtroTipo();
              return (
                <div key={idx} className="rounded-md border border-ink-700 bg-ink-950 p-3">
                  <div className="flex items-start gap-2">
                    <select
                      value={l.itemId}
                      onChange={(e) => updateLinea(idx, { itemId: e.target.value })}
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
                    {lineas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLineas((ls) => ls.filter((_, i) => i !== idx))}
                        className="shrink-0 rounded-md px-2 py-0.5 font-mono text-xs text-danger transition-colors hover:text-danger-soft"
                        aria-label="Quitar producto"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  {item ? (
                    <p className="mt-1 font-mono text-2xs uppercase tracking-wider text-fog-500">
                      unitario{' '}
                      <span className="tabular-nums text-signal">{usd(precioDe(item))}</span> ·{' '}
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
                    <span className="font-mono text-2xs uppercase tracking-wider text-fog-600">
                      cantidad
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => sumarCantidad(idx, -1)}
                        className="size-11 shrink-0 rounded-md border border-ink-700 text-fog-300 transition-colors hover:border-ink-600 hover:text-fog-100"
                        aria-label="Quitar una unidad"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={l.cantidad}
                        onChange={(e) => updateLinea(idx, { cantidad: e.target.value })}
                        aria-label={`Cantidad de ${item?.nombre ?? 'el producto'}`}
                        className="w-16 shrink-0 rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-center text-sm tabular-nums text-fog-100 caret-signal outline-none transition-colors focus:border-ink-600"
                      />
                      <button
                        type="button"
                        onClick={() => sumarCantidad(idx, 1)}
                        className="size-11 shrink-0 rounded-md border border-ink-700 text-fog-300 transition-colors hover:border-ink-600 hover:text-fog-100"
                        aria-label="Añadir una unidad"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <FieldError name="lineas" error={errors.lineas} />
            <button type="button" onClick={anadirLinea} className={optionCls(false)}>
              <span className="text-xs font-medium">+ Añadir producto</span>
              <span className="text-2xs text-fog-500">agrega otro producto al despacho</span>
            </button>
            {canDiscount && (
              <div className="rounded-md border border-ink-700/60 p-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-2xs uppercase tracking-wider text-fog-100">
                    Descuento <span className="text-fog-500">(aprobado)</span>
                  </p>
                  <div
                    className="flex overflow-hidden rounded-md border border-ink-700"
                    role="group"
                    aria-label="Tipo de descuento"
                  >
                    {(['pct', 'monto'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setDescuentoModo(m)}
                        aria-pressed={descuentoModo === m}
                        className={`px-2.5 py-0.5 font-mono text-2xs tabular-nums transition-colors ${
                          descuentoModo === m
                            ? 'bg-signal text-ink-950'
                            : 'text-fog-500 hover:text-fog-300'
                        }`}
                      >
                        {m === 'pct' ? '%' : 'US$'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="min-w-0 flex-1 text-2xs leading-relaxed text-fog-500">
                    {descuentoModo === 'pct'
                      ? `% sobre subtotal (0–100%)`
                      : `US$ fijos · máx ${usd(subtotal)}`}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={descuentoModo === 'pct' ? 100 : subtotal}
                    step={descuentoModo === 'pct' ? 0.5 : 0.01}
                    value={descuentoValor}
                    onChange={(e) => setDescuentoValor(e.target.value)}
                    aria-label={`Descuento en ${descuentoModo === 'pct' ? 'porcentaje' : 'dólares'}`}
                    className={`${inputCls} w-16 shrink-0 text-right tabular-nums`}
                  />
                </div>
              </div>
            )}
            {condicion === 'credito' && (
              <div className="rounded-md border border-ink-700/60 p-2.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-mono text-2xs uppercase tracking-wider text-fog-100">
                    Recargo por mora <span className="text-fog-500">(crédito)</span>
                  </p>
                  <div
                    className="flex overflow-hidden rounded-md border border-ink-700"
                    role="group"
                    aria-label="Tipo de recargo por mora"
                  >
                    {(['pct', 'monto'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMoraModo(m)}
                        aria-pressed={moraModo === m}
                        className={`px-2.5 py-0.5 font-mono text-2xs tabular-nums transition-colors ${
                          moraModo === m
                            ? 'bg-signal text-ink-950'
                            : 'text-fog-500 hover:text-fog-300'
                        }`}
                      >
                        {m === 'pct' ? '%' : 'US$'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <span className="min-w-0 flex-1 text-2xs leading-relaxed text-fog-500">
                    {moraModo === 'pct'
                      ? 'Porcentaje sobre el subtotal (0–100%).'
                      : `Monto fijo · máx ${usd(subtotal)}.`}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={moraModo === 'pct' ? 100 : subtotal}
                    step={moraModo === 'pct' ? 0.5 : 0.01}
                    value={moraValor}
                    onChange={(e) => {
                      setMoraValor(e.target.value);
                      clear('mora');
                    }}
                    aria-label={`Recargo por mora en ${moraModo === 'pct' ? 'porcentaje' : 'dólares'}`}
                    className={`${inputCls} w-16 shrink-0 text-right tabular-nums`}
                    {...fieldAria('mora', errors)}
                  />
                </div>
                <FieldError name="mora" error={errors.mora} />
              </div>
            )}
            <div className="rounded-md border border-ink-700/60 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <span className="font-mono text-2xs uppercase tracking-wider text-fog-100">
                  IVA <span className="text-fog-500">(incluido en el total)</span>
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={ivaPct}
                  onChange={(e) => {
                    setIvaPct(e.target.value);
                    clear('iva');
                  }}
                  aria-label="IVA en porcentaje"
                  className={`${inputCls} w-16 shrink-0 text-right tabular-nums`}
                  {...fieldAria('iva', errors)}
                />
              </div>
              <FieldError name="iva" error={errors.iva} />
            </div>
            <div className="rounded-md border border-ink-700/60 p-2.5 font-mono text-2xs text-fog-500">
              <div className="flex justify-between">
                <span>subtotal</span>
                <span className="tabular-nums text-fog-100">{usd(subtotal)}</span>
              </div>
              {descuentoActivo && !descuentoOk && (
                <div className="flex justify-between text-danger">
                  <span>descuento</span>
                  <span>{descuentoModo === 'pct' ? 'máx 100%' : `máx ${usd(subtotal)}`}</span>
                </div>
              )}
              {descuentoActivo && descuentoOk && (
                <div className="flex justify-between">
                  <span>descuento · {descuentoEtiqueta}</span>
                  <span className="tabular-nums text-signal">−{usd(descuentoMonto)}</span>
                </div>
              )}
              {moraActivo && !moraOk && (
                <div className="flex justify-between text-danger">
                  <span>recargo por mora</span>
                  <span>{moraModo === 'pct' ? 'máx 100%' : `máx ${usd(subtotal)}`}</span>
                </div>
              )}
              {moraOk && (
                <div className="flex justify-between">
                  <span>recargo por mora · {moraEtiqueta}</span>
                  <span className="tabular-nums text-signal">+{usd(moraMonto)}</span>
                </div>
              )}
              {ivaUsado > 0 && (
                <div className="flex justify-between">
                  <span>IVA {ivaUsado}%</span>
                  <span className="tabular-nums text-signal">+{usd(ivaMonto)}</span>
                </div>
              )}
              <div className="mt-0.5 flex justify-between border-t border-ink-800 pt-1 text-xs">
                <span className="uppercase tracking-wider">total</span>
                <span className="tabular-nums text-signal">{usd(totalFinal)}</span>
              </div>
            </div>
            {items.length === 0 && (
              <p className="text-xs text-fog-600">
                El catálogo está vacío. El administrador debe cargar los ítems y sincronizar.
              </p>
            )}
          </>
        )}

        {step === 'revisión' && (
          <div className="flex flex-col gap-2">
            <div className="rounded-md border border-ink-700/60 p-2.5 text-xs text-fog-500">
              <div className="flex justify-between gap-3">
                <span>cliente</span>
                <span className="truncate text-right font-medium text-fog-100">
                  {nombreCliente || '—'}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3">
                <span>tipo</span>
                <span className="text-right text-fog-100">{condicion}</span>
              </div>
              <div className="mt-2 border-t border-ink-800 pt-2">
                {lineasValidas.map((l, idx) => {
                  const item = items.find((i) => i.id === l.itemId);
                  return (
                    <div key={idx} className="flex items-baseline justify-between gap-3 py-0.5">
                      <span className="min-w-0 text-xs font-medium text-fog-100">
                        {item?.nombre ?? 'Ítem'}
                      </span>
                      <span className="shrink-0 font-mono text-2xs text-fog-500">
                        {l.cantidad} × {usd(precioDe(item as Item))}
                      </span>
                    </div>
                  );
                })}
              </div>
              {descuentoOk && (
                <div className="mt-1 flex justify-between gap-3">
                  <span>descuento</span>
                  <span className="text-right text-fog-100">
                    {descuentoEtiqueta} · −{usd(descuentoMonto)}
                  </span>
                </div>
              )}
              {moraOk && (
                <div className="mt-1 flex justify-between gap-3">
                  <span>recargo por mora</span>
                  <span className="text-right text-fog-100">
                    {moraEtiqueta} · +{usd(moraMonto)}
                  </span>
                </div>
              )}
              {ivaUsado > 0 && (
                <div className="mt-1 flex justify-between gap-3">
                  <span>IVA {ivaUsado}%</span>
                  <span className="text-right text-fog-100">+{usd(ivaMonto)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between rounded-md border border-signal/40 p-2.5 font-mono text-2xs">
              <span className="text-fog-500">total</span>
              <span className="tabular-nums text-signal">{usd(totalFinal)}</span>
            </div>
          </div>
        )}
      </div>

      {message?.kind === 'ok' && (
        <p role="status" className="mt-3 text-xs text-ok">
          {message.text}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        {stepIndex > 0 ? (
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setStep(STEPS[Math.max(0, stepIndex - 1)]!);
            }}
            className="rounded-md border border-ink-700 px-3 py-1.5 text-sm font-medium text-fog-100 transition-colors hover:border-ink-600"
          >
            anterior
          </button>
        ) : (
          <span />
        )}
        {step === 'revisión' ? (
          <button
            onClick={onClickGuardar}
            disabled={busy}
            className="btn-lift cta-glow rounded-md bg-signal px-3 py-1.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft disabled:opacity-50"
          >
            {busy ? 'Guardando…' : editing ? 'Guardar cambios' : 'Registrar venta'}
          </button>
        ) : (
          <button
            onClick={stepNext}
            className="btn-lift cta-glow rounded-md bg-signal px-3 py-1.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-signal-soft"
          >
            siguiente
          </button>
        )}
      </div>

      <NuevaZonaDialog
        open={zonaDialogOpen}
        onClose={() => setZonaDialogOpen(false)}
        onCreated={(z) => {
          setZonaId(z.id);
          setZonaDialogOpen(false);
        }}
      />
    </div>
  );
}
