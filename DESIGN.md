# DESIGN.md — Lineamientos de diseño «Brian Noel Hub»

> **Fuente única de verdad visual del proyecto.** ANTES de diseñar, rediseñar o
> añadir cualquier UI, léete este documento y gárbalo con el context del trabajo.
> PRD.md manda sobre alcance/features; DESIGN.md manda sobre cómo se ve y se
> siente. Ambos son de lectura obligatoria; este define qué hace el producto,
> el otro define su cara.
>
> Bases: skill instalado en `.agents/skills/` — `ui-ux-pro-max` (guías de
> UI/UX, paletas, tipografía, icons y búsqueda local; el recorrido de
> pantallas para revisión lo cubren `ui-ux-pro-max` + el harness smoke de
> Playwright y el checklist §12). Los tokens reales viven en
> `apps/web/src/index.css` (Tailwind v4 `@theme`): **edítalos allí, nunca
> dupliques valores en componentes.**
>
> Unified con `genesis-DESIGN.md` (2026-10-08, absorbido/archivado): se
> adoptan sus **disciplinas de elevación e interacción** — superficies planas
> con hairline, sombra solo en hover/foco/overlays, glow teñido solo en el
> CTA, botones que suben 1px, grid de 4px, acento reservado a lo interactivo,
> un solo primario por sección. Lo que NO se adopta (productos distintos):
> paleta indigo/verde, General Sans/DM Sans, fondo claro `#FAFAFA`, 72px de
> display, ni estética de galería — la voz sigue siendo «instrumento de
> operación nocturno» (§1).

---

## 1. Lectura de diseño (design read)

> Regla de proceso: declarar la lectura en UNA línea antes de diseñar, y
> volver a ella al revisar.

**Lectura:** _Producto móvil-primero (PWA), herramienta de operación en campo
para una distribuidora venezolana — bimoneda USD/BS, cobranza, rutas, sin
conexión. Estrato visual: «instrumento de operación nocturno» — tinta profunda +
naranja de señal + mono para datos de instrumento, NO estética de landing ni
`SaaS-card-kit`._

En consecuencia:

- **Es una herramienta de trabajo, no un escaparate.** Cada píxel sirve a una
  acción (cobrar, despachar, verificar PIN, sincronizar). Densidad media-alta,
  foco en una sola tarea por pantalla.
- **Móvil-primero con respeto por el desktop.** Layouts en columna única en
  <768px; el contenido nunca se "cae" por ancho faltante.
- **Offline-first es un valor visual, no solo técnico.** El estado de sync, el
  reloj del dispositivo y la tasa BCV se muestran con intención: son los datos
  de instrumento del repartidor.

## 2. Dials (calibración global)

| Dial                                   | Valor   | Por qué                                                                                                                                           |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DESIGN_VARIANCE` (simetría→caos)      | **3–4** | Operación de confianza: layouts a la izquierda/centrados, puntas ortogonales. La variación se reserva a estados (login=reposo, QR/DTA=presencia). |
| `MOTION_INTENSITY` (quieto→cinemático) | **2–3** | Solo entrada única (rise-in) y feedback táctil. Nada de parallax, marquees ni reveal por scroll en una herramienta.                               |
| `VISUAL_DENSITY` (galería→cockpit)     | **6–7** | Datos legibles de un vistazo; mono para cifras; sin tarjetas redundantes. Listas y tablas densas pero con aire en los hit targets.                |

> Regla §1.B: para una herramienta de operación no se inventan animaciones
> "porque sí". Si el dial es 3 y algo se anima, la animación DEBE comunicar
> jerarquía, retroalimentación o cambio de estado. Si no responde a esa
> pregunta, se elimina.

## 3. Tokens de color (tinta + naranja de señal, paleta DUAL)

Paleta AUDITORA: un solo acento (naranja), neutros azul-tinta, un verde de éxito
y un rojo de error — ambos desaturados y ceñidos a su semántica. **Nunca** se
añade otro acento de color; el acento se usa en TODA la página de forma
coherente (regla `color-consistency-lock`).

> **Paleta dual (la verdad vive en `index.css`):** la app es **claro por
> defecto** (`:root`) y **oscuro** vía `[data-theme='dark']` (ver
> `app/tema.ts`). Los nombres son **semánticos por escala**, no por valor:
> `ink-*` = superficie (950 página → 900 tarjeta → 800 hover/elevación 2 → 700
> filete → 600 borde de control); `fog-*` = texto (100 primario → 300 secundario
> → 500 label → 600 meta/mono → 700 SOLO decorativo). En claro los `ink`
> aclaran y los `fog` oscurecen; en oscuro, al revés. Toda superficie/texto
> nuevo se define en **las dos columnas** de `@theme` y se audita en **ambos
> temas** (regla 7). El override oscuro vive FUERA de `@layer` (después de
> `@theme`); no se mueve a una capa (cascada).

| Token          | Oscuro (`data-theme='dark'`) | Claro (defecto) | Uso                                                                           |
| -------------- | ---------------------------- | --------------- | ----------------------------------------------------------------------------- |
| `ink-950`      | `#0b1220`                    | `#f4f5f7`       | Fondo de página.                                                              |
| `ink-900`      | `#101a2e`                    | `#ffffff`       | Superficie de tarjetas/inputs (elevación 1).                                  |
| `ink-800`      | `#16233b`                    | `#eceef2`       | Superficie elevada / hover de inputs (elevación 2).                           |
| `ink-700`      | `#223351`                    | `#d0d5dd`       | Bordes (hairline estándar).                                                   |
| `ink-600`      | `#6b789a`                    | `#838a98`       | Borde de control — identifica controles (4.26:1 oscuro / 3.18:1 claro sobre página). |
| `signal`       | `#fb923c`                    | `#c2410c`       | **ÚNICO acento**: CTA primario, foco, hit del reloj. Naranja del sector (distribución/energía); 4.75:1 sobre página claro. |
| `signal-soft`  | `#f97316`                    | `#9a3412`       | Hover de CTA primario.                                                        |
| `fog-100`      | `#e7eaf0`                    | `#141a24`       | Texto primario (16:1 en ambos temas).                                         |
| `fog-300`      | `#c2cad8`                    | `#3d4553`       | Texto secundario.                                                             |
| `fog-500`      | `#8b94a8`                    | `#575f6d`       | Texto terciario/labels (≥5.7:1).                                              |
| `fog-600`      | `#7f88a0`                    | `#656d7c`       | Meta-texto/micro-labels (mono): 5.3:1 oscuro / 4.77:1 claro sobre página.     |
| `fog-700`      | `#5b6479`                    | `#98a0ae`       | **Solo decorativo/bordes**: NO cumple AA → nunca para texto legible.           |
| `danger`       | `#e26d6d`                    | `#b3261e`       | Errores, destructive.                                                         |
| `ok`           | `#4cbf8f`                    | `#157347`       | Éxito, conectado.                                                             |

Reglas:

1. **Contraste WCAG AA** en todo texto interactivo (≥4.5:1 cuerpo, ≥3:1 para
   ≥18px), **en ambos temas**. `signal` solo con texto `ink-950` encima; los
   fondos de tarjetas (`ink-900`) siempre llevan texto `fog-100`.
2. **Sin `#000000` ni `#ffffff` puros** (regla `no-pure-black`).
3. **Un solo familia de acento.** Destructive=rojo, éxito=verde: NO se usa
   rojo para "urgencia decorativa" ni verde fuera de estado confirmado.
4. Sombra/reflejo teñidos al fondo (nunca negro puro). Preferir bordes
   `ink-700` antes que sombras (regla `hairlines-over-shadows`).
5. **El acento solo marca lo interactivo o el nodo de estado** (CTA, foco,
   hit del reloj, chip activo). Nunca texto estático decorativo rellenado de
   naranja, ni bordes naranja sin significado (regla `accent-interactive-only`,
   de `genesis-DESIGN.md`).
6. **Un solo CTA primario por sección** (botón sólido naranja). El resto de
   acciones en esa sección son `default`/`ghost`/`danger` — dos primarios
   compitiendo diluyen la jerarquía (regla `one-primary-per-section`).
7. **Dual obligatorio**: un color nuevo se añade a `@theme` con sus dos
   columnas y se verifica AA en claro y oscuro (script de contraste, "§3
   verificación"). Nunca un hex descuelgado en un componente.

## 4. Tipografía

| Rol                  | Familia                                     | Uso                                                                               |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| Display UI           | **Archivo Variable** (`--font-sans`)        | Todo texto de interfaz; display en pesos 600/700 con `tracking-tight`.            |
| Datos de instrumento | **JetBrains Mono Variable** (`--font-mono`) | Cifras (montos, tasas), reloj, timestamps, labels de campo, códigos, teclado PIN. |

Escala numérica (rampa real de `@theme` en `index.css`; `rem` sobre raíz 16px):

| Token    | px  | Rol                                                                               |
| -------- | --- | --------------------------------------------------------------------------------- |
| `text-2xs` | 11  | Micro-mono: labels de campo, timestamps, chips, eyebrow (`uppercase tracking-wider`, máx. 1 por cada 3 secciones, §4.4). |
| `text-xs`   | 13  | Labels funcionales de formulario, meta.                                           |
| `text-sm`   | 14  | UI estándar: botones, campos, filas de lista (cuerpo de trabajo del cliente).     |
| `text-base` | 16  | Cuerpo de lectura en detalles/estados de vacío.                                   |
| `text-lg`→`2xl` | 18/21/24 | Headings de tarjeta y de página (Archivo 600, `tracking-tight`).               |
| `text-3xl`→`4xl` | 30/36 | Display de página (solo encabezados, `text-balance`).                          |

Los targets de 44px = `2.75rem` se apoyan en la raíz de 16px y no se mueven al
re-escalar la rampa.

Reglas (combinan `ui-ux-pro-max` + directrices Vercel):

1. **Una sola sans + una sola mono.** No se importan familias nuevas sin pasar
   por este documento. Fuentes autohospedadas vía `@fontsource` (PWA offline;
   nunca `<link>` a Google Fonts).
2. **Cifras siempre `tabular-nums`** y, si representan dinero/medición, en
   `font-mono` (`tabular-nums` en números de columnas comparables — regla Vercel).
3. **Headings: `text-balance`** (evita viudas); párrafos `text-pretty`.
4. **Labels de campo**: mono 11px (`text-2xs`), `uppercase tracking-wider` → **máximo 1
   eyebrow por cada 3 secciones** (regla `eyebrow-restraint`); los labels de
   formulario están exentos porque son funcionales, no decorativos.
5. **Emphasis en display**: negrita/cursiva de la MISMA familia; nunca mezclar
   serif en una headline sans (regla `emphasis-rule`).
6. **Nada de "all-caps accionado"** en botones; botones en sentence case
   ("Entrar", "Guardar PIN"). Los textos mono en mayúsculas diminutas son
   solos labels de campo.
7. Longitud de línea < 80 caracteres (`max-w-[65ch]` en párrafos largos).

## 5. Layout y composición

0. **Grid de espaciado de 4px** (de `genesis-DESIGN.md`): escala 4, 8, 12,
   16, 20, 24, 32, 40, 48, 64, 80, 96. Todo padding/margin/gap se elige de esa
   escala; separación de secciones: 32px móvil, 48px tablet, 64px desktop
   (aquí, `gap-5`/`py-5` = 20px es la unidad de trabajo en móvil; no bajar de
   16px entre secciones).

1. **Contenedor**: `mx-auto max-w-2xl` en móvil/tablet; en desktop `.agent` y
   dashboards pueden usar **CSS Grid** (`grid-cols-1 md:grid-cols-N`), NUNCA
   matematiquería con `w-[calc()]` ni flex percentages (regla `grid-over-flex`).
   **Shell autenticado:** en `md+` el layout usa ese grid con sidebar colapsable
   (`w-56` ↔ `w-14`) + columna de contenido a ancho completo; `max-w-2xl` aplica a la
   columna en móvil/tablet.
2. **Header:** marca a la izquierda; a la derecha el botón de sincronización y,
   solo en móvil, el botón que abre el drawer (en `md+` ese botón se oculta).
   El control de colapsar/expandir el sidebar vive **dentro del sidebar**, en su
   pie (junto a «Salir»). La elevación del header se consigue con
   **`backdrop-blur` + hairline inferior**, nunca con sombra (regla
   `blur-over-shadow`).
3. **Altura completa**: `min-h-dvh` (NUNCA `h-screen` — regla `viewport-stability`).
4. **Safe areas**: fondos full-bleed usan `env(safe-area-inset-*)` para notch.
5. **Radios**: una sola escala — botones/interactivos `rounded-md` (6px),
   tarjetas `rounded-xl` (12px), inputs `rounded-md`. **Se mantiene en TODA la
   app** (regla `shape-consistency-lock`). En línea, `rounded` de 4px solo para
   `<code>`/badges mono.
6. **Tarjetas solo cuando hay jerarquía real** que comunicar; en listas densas
   preferir `divide-y` de `ink-700` o aire negativo. Se permite la tarjeta
   estándar `border-ink-700 bg-ink-900 rounded-xl p-4` para tarjetas de
   dato/estado (BimonedaCard, SyncPanel).
7. **Estados de vacío / carga / error siempre presentes** (regla
   `full-state-cycle`): skeletons del mismo shape del contenido, error inline
   bajo el campo, vacío con instrucción de cómo llenarlo.
8. **Formularios son PÁGINAS, no modales**: alta y edición viven en su ruta
   (`#/ventas/nueva`, `#/clientes/:id/editar`, …) dentro de `PageShell`
   (título + volver). El único diálogo permitido es `NuevaZonaDialog`, creación
   rápida anidada dentro de un formulario donde navegar perdería el estado.
9. **Detalles de documento**: las acciones de estado (entregar/editar/
   deshacer/eliminar) viven junto al id del documento, en la parte superior,
   dentro de un `role="group"` — nunca en una barra intermedia ni pegajosa.
   Orden de las secciones del detalle de venta, de lo esencial a lo accesorio:
   **resumen → detalles → cliente → metadata** (el operador ve primero cuánto
   es y cuánto falta; la auditoría queda al final).
   El equivalente en Bs de un saldo pendiente se referencia con la **tasa
   BCV vigente de hoy** (no con el snapshot de registro); el snapshot solo
   aparece como dato histórico en el seguimiento. El seguimiento es una línea
   de tiempo (`<ol>` con etiqueta mono + fecha + autor) **derivada** de los
   campos del registro (`created_at`, `updated_at`, `entregado_at`), sin
   escrituras adicionales al documento.
10. **Elevación (doctrina de `genesis-DESIGN.md`, §5/§7 de este doc)**:
    - Superficies en reposo = **planas**: 1px `border-ink-700`, sin sombra.
      La sombra es un recurso de ESTADO, no de reposo (regla
      `shadow-only-on-hover`).
    - Hover de superficie interactiva: `card-lift` (sube 2px + sombra sutil
      `--shadow-card-hover`) en tarjetas que enlazan o abre acción.
    - Botones: `btn-lift` (suben **1px** al hacer hover) + `cta-glow`
      (glow teñido de naranja `--shadow-cta-hover`) SOLO en el CTA primario.
    - Overlays/diálogos: `shadow-popover` (`--shadow-popover`) — la sombra
      fuerte se reserva a lo que flota sobre la página.
    - Elevación de chrome (header, barras sticky): **blur + hairline**, no
      sombra (regla `blur-over-shadow`).

## 6. Componentes y estados (inventario)

Todo componente vive en `apps/web/src/ui/*` o `apps/web/src/app/*` y se audita
en **ambos temas** (§3.7). No se crea un componente nuevo si existe un
equivalente; variantes y estados se deciden aquí, no dentro de los componentes.

| Componente | Ubicación | Anatomía y reglas                                                                     |
| ---------- | --------- | ------------------------------------------------------------------------------------- |
| `ActionButton` | `ui/actions.tsx` | Texto + icono opcional; en móvil queda solo el icono (`hidden sm:inline`). Bordeado, `rounded-md`, `btn-lift` (sube 1px al hover). Variantes: `default` (borde `ink-600`), `ok`, `danger`, `primary` (sólido naranja, texto `ink-950`, `+cta-glow`). Estados: reposo / hover / focus (outline naranja) / `disabled` (`opacity-50`). |
| `PrimaryButton` | `ui/actions.tsx` | CTA sólido naranja (`bg-signal`, texto `ink-950`, `+cta-glow`), `rounded-md`, `btn-lift`; tamaños `md`/`sm`. CTA estándar de los formularios-página («Guardar», «Continuar»). |
| `SecondaryButton` | `ui/actions.tsx` | Contorno neutro (`border-ink-600`), `rounded-md`, `btn-lift`; «Cancelar»/«Volver». |
| `Chip` | `ui/chips.tsx` | Chip genérico por `tono` (neutral/ok/danger/signal); base mono 11 `uppercase`. `ChipEstado` lo especializa para la condición de despacho. |
| `IconAction` | `ui/actions.tsx` | Icon-only 44px circular (`rounded-full`) **sin borde** — el glifo vive libre; fondo suave solo en hover/active. Variantes `default`/`ok`/`danger`; acepta `to` (Link) para navegación. Uso: acciones de fila y CRUD del detalle junto al id (§5.9). **Todo** icon-only del proyecto es así: **nunca bordearlo**. `aria-label`+`title` siempre (§10 "Bots icon-only"). |
| `CloseButton` | `ui/actions.tsx` | X 44px, borde transparente que se revela al hover (cierre de diálogos/overlays). |
| `ChipEstado` | `ui/chips.tsx` | Chip de condición de despacho (pendiente/crédito/pagado/entregado/…); mono 11 `uppercase`, tinte por semántica, naranja cuando es filtro activo. |
| `PageShell` | `app/PageShell.tsx` | Página con título + volver (44px) + `acciones` (icon-group SIN borde, `role="group"` junto al id) y opción `accion.soloIcono` ("+" circular naranja). **Es el largo de toda alta/edición/detalle** (§5.8). Grupo de acciones del detalle: ≤4 iconos. **Convención de alta:** todos los CTA de creación de sección (venta, cliente, catálogo, zona, personal, usuarios) usan `accion.soloIcono` con el mismo "+" circular; el nombre va en `aria-label`/`title`. |
| `NuevaZonaDialog` | `clientes/NuevaZonaDialog.tsx` | **Único diálogo permitido** (creación rápida anidada, §5.8). Overlay con `shadow-popover`; `aria-labelledby`. |
| `MiniFoto` | `ui/fotos.tsx` | Captura de foto (cámara/galería) con preview 40px + compresión en el device (`lib/photo.ts`). Label-envolvente = target (el `input[type=file]` va `sr-only`). Compartido por alta de cliente y wizard de venta; el texto de error de compresión es `text-danger`. |
| Inputs / labels | común `inputCls` | Campo Archivo 14, borde `ink-600`, `rounded-md`, `min-block-size:44px` (regla global); label visible con `htmlFor`, nunca placeholder-como-label (§10 Formularios). Estados: reposo / focus (`caret-signal` + outline) / error (`role="alert"` inline bajo el campo) / `disabled`. |

Reglas de inventario:

1. **Un primario por sección** (§3.6): el resto en `default`/`ok`/`danger`.
2. **Iconos libres del contenedor**: no bordear los icon-only; si la fila pide
   contenedor, usar `ActionButton`.
3. **Ciclo de estados completo por vista** («full-state-cycle», §5.7): vacío
   (con instrucción de cómo llenarlo), carga (skeleton del shape del contenido),
   error (inline con siguiente paso, §9.3) — comprobado en ambos temas.
4. **Contraste por componente**: CTA naranja siempre texto `ink-950`; `ok`/
   `danger` legibles sobre sus fondos y sobre `ink-800` (hover) en los dos temas.

## 7. Interacción, motion y feedback

1. **Feedback táctil**: `:active` con `scale-[0.98]` o `brightness-90` en
   botones; hover explícito en todo interactivo y con mayor contraste que el
   estado reposo (directriz Vercel).
2. **Motion mínimo y motivado**: ÚNICO patrón de entrada: `rise-in` (CSS en
   `index.css`) en el arranque del bloc/card. Transiciones SOLO sobre
   `translate`/`opacity`/`box-shadow`/colores — **nunca `transition: all`**
   (listar propiedades). Elección de hover «silenciosa y plana» (de
   `genesis-DESIGN.md`): botones suben **1px** (`btn-lift`), superficies
   clickeables **2px** (`card-lift`), y el CTA primario gana un glow teñido
   naranja (`cta-glow`) — este es el único glow permitido. Las utilidades
   viven FUERA de `@layer` en `index.css` y solo aplican bajo
   `@media (hover: hover) and (pointer: fine)` (nada de hover fantasma en
   táctil) con neutralización total en `prefers-reduced-motion: reduce`.
3. **Reduced motion**: TODO se desactiva bajo `prefers-reduced-motion: reduce`
   — definido por defecto en `index.css`, no lo repitas mal.
4. **Focus visible**: `:focus-visible` global en `index.css` (outline naranja)
   -2px offset. **La regla vive FUERA de `@layer`** a propósito: `.outline-none`
   es una utilidad de Tailwind v4 (`@layer utilities`) y ganaría si estuviera en
   `@layer base`. Nunca volver a meterla en una capa. En campos de formulario
   usar además `caret-signal`.
5. **touch**: `touch-action: manipulation` en botones; `-webkit-tap-highlight-color`
   explícito; `overscroll-behavior: contain` en sheets/modales/Drawer.
   **Target mínimo 44px** en `button`/`select`/`input` (regla global en
   `index.css`, fuera de capa); los icon-only cuadrados usan `size-11`.
   Checkboxes/radios quedan excluidos: su `<label>` envolvente es el target.
6. **AutoFocus**: solo en desktop y sobre UN input primario (regla Vercel) —
   el login móvil NO usa `autoFocus`.

## 8. Estados de pantalla auth (referencia concreta)

Flujo actual ya construido en `apps/web/src/auth/AuthFlow.tsx` — es el **canon**
para todas las pantallas de auth:

- `loading`: Brand (monograma naranja) + "leyendo dispositivo…" + `StatusStrip`.
- `login`: título "Entrar a tu operación", correo + contraseña, CTA naranja
  "Entrar". Error inline `role="alert"`.
- `setup-pin`: "Crea tu PIN" (4-8 dígitos), dos campos, CTA "Guardar PIN".
- `unlock`: "Desbloquear hub", un solo campo, contador de intentos, botón
  "salir y borrar datos locales".
- `StatusStrip` (base de todas): punto verde + "reloj del dispositivo" +
  reloj mono en vivo (solo segundos en naranja). Refuerza clockSync: el reloj es
  fuente de verdad.

Los PIN inputs: `type="password"`, `inputMode="numeric"`, filtro `\D`,
`spellCheck={false}`, autoComplete coherente. Nunca keypad custom: el teclado
nativo del móvil es superior y accesible.

## 9. Copy (voz de la UI)

Adaptado de `frontend-design` (Anthropic, skill retirado 2026-10-07) + las
directrices de Vercel, a español venezolano sobrio:

1. **Voz activa y directa** ("Entrar", "Guardar PIN", "Sincronizar") — el
   botón dice exactamente lo que hace; misma palabra en CTA y en confirmación.
2. **Segunda persona**; evitar voz pasiva. Cero ingeniería en la copia:
   "Sesión cifrada y guardada en este dispositivo." no "El sistema procederá a…".
3. **Errores incluyen el siguiente paso**, no solo el problema: "Revisa tu
   correo y contraseña." + `role="alert"`.
4. **Omisión de "…"**: "Cargando…", "Verificando…", "Sincronizando…" — con el
   caráctere correcto `…` (nunca tres puntos). Curly quotes `" "` no rectas.
5. Cifras con numerales ("quedan 3 intentos", no "tres").
6. Moneda **siempre** con `Intl.NumberFormat('es-VE', {style:'currency'})` o
   `'es-VE'` formateo manual al estándar BS/USD del negocio; nunca hardcodear.
7. `translate="no"` en marcas/códigos ("Brian Noel", "stellar-drive", IDs) para
   evitar traducción automática corrupta.
8. Mantener **un solo registro**: operativo, sobrio, sin emojis en la UI (los
   indicadores usan puntos/íconos de sistema).
9. La UI habla de **secciones**, nunca de "módulo": la palabra "módulo" no aparece en copy
   visible (títulos, labels, estados de carga).

## 10. Accesibilidad (reglas Vercel imprescindibles)

| Área               | Regla                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bots icon-only     | SIEMPRE `aria-label`                                                                                                                                      |
| Formularios        | `<label htmlFor>` visible y clickeable; `name` + `autocomplete` significativos; `type` correcto (`email`, `tel`, `number`); labels NUNCA como placeholder |
| Semántica          | `<button>` para acciones, `<a>` para navegación; nunca `<div onClick>`; HTML semántico antes que ARIA                                                     |
| Iconos decorativos | `aria-hidden="true"`                                                                                                                                      |
| Async              | updates/toasts con `aria-live="polite"`                                                                                                                   |
| Headings           | jerarquía `<h1>–<h6>` real; skip-link si hay secciones repetitivas                                                                                        |
| Contraste botones  | texto legible sobre fondo; audit CA de cada CTA (AA)                                                                                                      |
| Truncado           | texto largo: `truncate`/`line-clamp` + `min-w-0` en flex; nombres de usuario muy largos no rompen layout                                                  |
| Imágenes           | `width`+`height` explícitos (CLS=0), `loading="lazy"` bajo el fold                                                                                        |
| Zoom               | NUNCA `maximum-scale=1` ni `user-scalable=no`                                                                                                             |
| Paste              | nunca bloquear `onPaste` en inputs (regla UX del PIN: se permite pegar)                                                                                   |
| Targets táctiles   | ≥44px en `button`/`select`/`input` (regla global de `index.css`); icon-only circular `rounded-full` `size-11` (sin borde); gap ≥8px entre targets adyacentes |

## 11. Anti-patrones (AI tells a evitar)

De los skills de diseño (retirados 2026-10-07), prohibido por defecto:

1. **Inter + slate-900** como stack por defecto (ya no: Archivo + JetBrains Mono + tinta).
2. **Gradientes púrpura/AI** y "buttons con glow". CTA = naranja sólido, sin brillo.
3. **Cream/beige + terracota/serif display** (paleta premium-banned).
4. **SaaS-card-kit**: mismas tarjetas redondeadas con la misma sombra gris en
   todo. Preferir estructura con líneas.
5. **Eyebrow en cada sección**, meta "A · B · C", etiquetas `WORD — fragmento`,
   flechas `→` en botones genéricos.
6. **Tres bloques iguales / hero centrado default**: reservar para cuando el
   contenido lo amerite.
7. **Micro-animaciones en loop** en cada tarjeta. Motion = entrada única +
   feedback.
8. **Serif de "premium"** y `Fraunces`/`Instrument Serif`. Archivo es la voz.
9. **Números falsamente precisos** ("92% de tus rutas") sin fuente real.
10. **Barras de navegación de 2 líneas** en desktop; nav en una línea.
11. **Sombra en superficies estáticas** o «elevación por caja» en reposo:
    tarjetas planas + hairline; la sombra es de estado (hover/foco) o de
    overlay (diálogo). Regla `shadow-only-on-hover`.
12. **Más de un CTA primario (sólido naranja) por sección** — jerarquía dividida.
13. **Acento en texto estático decorativo**: el naranja marca lo interactivo o el
    nodo de estado (reloj, BCV, chip activo), nunca rellena leyendas.

**Anti-patrón específico del proyecto**: añadir NUEVAS fuentes o un segundo
acento de color sin justificarlo en este documento → revisión requerida.

## 12. Checklist agentico (pre-flight antes de dar un diseño por terminado)

Mecánico y cortable con herramientas (rg/grep). Cada tarea de UI debe pasar
esto:

```text
[ ] TYPE  — Archivo (sans) y JetBrains Mono (datos) únicamente; sin <link> a fuentes remotas.
[ ] COLOR — Símbolos present en @theme de index.css; sin hexes literales para tinta/naranja; light check AA en el acento primario.
[ ] THEME — Recorrido del diff en CLARO (defecto) y OSCURO (`data-theme='dark'`); sin valores descuelgados del `@theme`; contraste AA en ambos (regla §3.7).
[ ] MOTION— Solo rise-in (entrada) y :active/:hover; sin transition: all; prefers-reduced-motion cubierto.
[ ] ELEV  — Reposo plano (sin shadow-card al estar); sombra solo hover/foco/overlay; blur+hairline en chrome; un CTA primario por sección; acento solo interactivo.
[ ] FORMS — label visible + htmlFor + name + autocomplete; type/inputmode correctos; error inline role="alert" bajo el campo; sin placeholder-como-label; mutación con confirmación o undo.
[ ] A11Y  — botones aria-label si icon-only; div onClick⇒<button>; aria-hidden en iconos decorativos; focus-visible en todo interactivo; sin outline-none.
[ ] TOUCH — botones/selects/inputs ≥44px (regla global index.css intacta y FUERA de @layer); icon-only cuadrado size-11; sin controles fijos por debajo de 44.
[ ] DATA  — cifras con tabular-nums/mono; Intl para fecha/moneda; nombres largos truncados con min-w-0; imágenes con dimensiones.
[ ] STATES— Vacío/carga/error reales por vista (regla §5.7), comprobados en ambos temas.
[ ] LAYOUT — min-h-dvh; grid antes que calc(); un solo radio (md/xl); tarjetas solo con jerarquía real; estado vacío/carga/error definidos.
[ ] COPY  — voz activa, 2ª persona, "…" correcto, sin emojis, error con siguiente paso.
[ ] DIALS — variance ≤4, motion ≤3, densidad 6-7; sin parallax/marquee/scroll-reveal.
[ ] HEUR  — Pasada de las 10 heurísticas de Nielsen (visibilidad de estado; match con el mundo real; control/undo; consistencia; error-prevention; reconocer ante recordar; error claro con salida).
[ ] CONTRAST — CTA naranja con texto ink-950; texto secundario ≥4.5:1 (ambos temas).
[ ] VERIFY — build + lint + tests en verde; revisar con el skill ui-ux-pro-max incluida esta checklist.
```

> Invocación: al terminar una tarea de UI, correr la checklist (con
> `ui-ux-pro-max` para guías/contraste y recorrido light/dark de las pantallas
> en el navegador) y reportar en el resumen qué ítems se chequearon. Las 10
> heurísticas de Nielsen (nngroup.com/articles/ten-usability-heuristics)
> son el backbone de la revisión HEUR.

---

## Referencias rápidas

- Tokens reales: `apps/web/src/index.css` (`@theme`).
- Catálogo de componentes y estados: §6 — código en `apps/web/src/ui/*` y `apps/web/src/app/PageShell.tsx`.
- Backbone de revisión UX: 10 heurísticas de Nielsen (nngroup.com/articles/ten-usability-heuristics).
- Canon auth: `apps/web/src/auth/AuthFlow.tsx`, `apps/web/src/auth/useAuth.ts`.
- Skills fuente: `.agents/skills/{ui-ux-pro-max,playwright-best-practices}/SKILL.md`.
- Elevación/interacción: doctrina absorbida de `genesis-DESIGN.md` (archivado);
  tokens `shadow-card-hover` / `shadow-cta-hover` / `shadow-popover` y clases
  `btn-lift` / `card-lift` / `cta-glow` en `index.css`.
- Normas de producto: `PRD.md`; normas de repo/proceso: `AGENTS.md`.
