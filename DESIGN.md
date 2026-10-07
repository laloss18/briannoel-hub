# DESIGN.md — Lineamientos de diseño «Brian Noel Hub»

> **Fuente única de verdad visual del proyecto.** ANTES de diseñar, rediseñar o
> añadir cualquier UI, léete este documento y gárbalo con el context del trabajo.
> PRD.md manda sobre alcance/features; DESIGN.md manda sobre cómo se ve y se
> siente. Ambos son de lectura obligatoria; este define qué hace el producto,
> el otro define su cara.
>
> Bases: skills instalados en `.agents/skills/` — `ui-ux-pro-max` (guías de
> UI/UX, paletas, tipografía, icons y búsqueda local) y `ui-walkthrough`
> (recorrido de pantallas para revisión). Los tokens reales viven en
> `apps/web/src/index.css` (Tailwind v4 `@theme`): **edítalos allí, nunca
> dupliques valores en componentes.**

---

## 1. Lectura de diseño (design read)

> Regla de proceso: declarar la lectura en UNA línea antes de diseñar, y
> volver a ella al revisar.

**Lectura:** _Producto móvil-primero (PWA), herramienta de operación en campo
para una distribuidora venezolana — bimoneda USD/BS, cobranza, rutas, sin
conexión. Estrato visual: «instrumento de operación nocturno» — tinta profunda +
ámbar de señal + mono para datos de instrumento, NO estética de landing ni
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

## 3. Tokens de color (tinta + ámbar de señal)

Paleta AUDITORA: un solo acento (ámbar), neutros azul-tinta, un verde de éxito
y un rojo de error — ambos desaturados y ceñidos a su semántica. **Nunca** se
añade otro acento de color; el acento se usa en TODA la página de forma
coherente (regla `color-consistency-lock`).

| Token         | Hex       | Uso                                                                              |
| ------------- | --------- | -------------------------------------------------------------------------------- |
| `ink-950`     | `#0b1220` | Fondo base (app completa).                                                       |
| `ink-900`     | `#101a2e` | Superficie de tarjetas/inputs (elevación 1).                                     |
| `ink-800`     | `#16233b` | Superficie elevada / hover de inputs.                                            |
| `ink-700`     | `#223351` | Bordes (hairline estándar).                                                      |
| `ink-600`     | `#2f405f` | Borde hover más visible.                                                         |
| `signal`      | `#e8b54a` | **ÚNICO acento**: CTA primario, foco, hit del reloj. Evoca el nodo bimoneda/BCV. |
| `signal-soft` | `#c99a36` | Hover de CTA primario.                                                           |
| `fog-100`     | `#e7eaf0` | Texto primario.                                                                  |
| `fog-300`     | `#c2cad8` | Texto secundario.                                                                |
| `fog-500`     | `#8b94a8` | Texto terciario/labels.                                                          |
| `fog-600`     | `#7f88a0` | Meta texto/micro-labels (mono): 5.3:1 sobre `ink-950`, 4.9:1 sobre `ink-900`.      |
| `fog-700`     | `#5b6479` | **Sólo decorativo/bordes**: 3.2:1 NO cumple AA → nunca para texto legible.         |
| `danger`      | `#e26d6d` | Errores, destructive.                                                            |
| `ok`          | `#4cbf8f` | Éxito, conectado.                                                                |

Reglas:

1. **Contraste WCAG AA** en todo texto interactivo (≥4.5:1 cuerpo, ≥3:1 para
   ≥18px). `signal` solo con texto `ink-950` encima; los fondos de tarjetas
   (`ink-900`) siempre llevan texto `fog-100`.
2. **Sin `#000000` ni `#ffffff` puros** (regla `no-pure-black`).
3. **Un solo familia de acento.** Destructive=rojo, éxito=verde: NO se usa
   rojo para "urgencia decorativa" ni verde fuera de estado confirmado.
4. Sombra/reflejo teñidos al fondo (nunca negro puro). Preferir bordes
   `ink-700` antes que sombras (regla `hairlines-over-shadows`).

## 4. Tipografía

| Rol                  | Familia                                     | Uso                                                                               |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| Display UI           | **Archivo Variable** (`--font-sans`)        | Todo texto de interfaz; display en pesos 600/700 con `tracking-tight`.            |
| Datos de instrumento | **JetBrains Mono Variable** (`--font-mono`) | Cifras (montos, tasas), reloj, timestamps, labels de campo, códigos, teclado PIN. |

Reglas (combinan `ui-ux-pro-max` + directrices Vercel):

1. **Una sola sans + una sola mono.** No se importan familias nuevas sin pasar
   por este documento. Fuentes autohospedadas vía `@fontsource` (PWA offline;
   nunca `<link>` a Google Fonts).
2. **Cifras siempre `tabular-nums`** y, si representan dinero/medición, en
   `font-mono` (`tabular-nums` en números de columnas comparables — regla Vercel).
3. **Headings: `text-balance`** (evita viudas); párrafos `text-pretty`.
4. **Labels de campo**: mono, 10-11px, `uppercase tracking-wider` → **máximo 1
   eyebrow por cada 3 secciones** (regla `eyebrow-restraint`); los labels de
   formulario están exentos porque son funcionales, no decorativos.
5. **Emphasis en display**: negrita/cursiva de la MISMA familia; nunca mezclar
   serif en una headline sans (regla `emphasis-rule`).
6. **Nada de "all-caps accionado"** en botones; botones en sentence case
   ("Entrar", "Guardar PIN"). Los textos mono en mayúsculas diminutas son
   solos labels de campo.
7. Longitud de línea < 80 caracteres (`max-w-[65ch]` en párrafos largos).

## 5. Layout y composición

1. **Contenedor**: `mx-auto max-w-2xl` en móvil/tablet; en desktop `.agent` y
   dashboards pueden usar **CSS Grid** (`grid-cols-1 md:grid-cols-N`), NUNCA
   matematiquería con `w-[calc()]` ni flex percentages (regla `grid-over-flex`).
   **Shell autenticado:** en `md+` el layout usa ese grid con sidebar colapsable
   (`w-56` ↔ `w-14`) + columna de contenido a ancho completo; `max-w-2xl` aplica a la
   columna en móvil/tablet.
2. **Header:** marca a la izquierda; a la derecha el botón de menú (esquina superior derecha)
   con el de sincronización justo a su izquierda. En `md+` el menú colapsa/expande el sidebar;
   en móvil abre el drawer.
3. **Altura completa**: `min-h-dvh` (NUNCA `h-screen` — regla `viewport-stability`).
4. **Safe areas**: fondos full-bleed usan `env(safe-area-inset-*)` para notch.
5. **Radios**: una sola escala — botones/interactivos `rounded-md` (6px),
   tarjetas `rounded-xl` (12px), inputs `rounded-md`. **Se mantiene en TODA la
   app** (regla `shape-consistency-lock`).
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

## 6. Interacción, motion y feedback

1. **Feedback táctil**: `:active` con `scale-[0.98]` o `brightness-90` en
   botones; hover explícito en todo interactivo y con mayor contraste que el
   estado reposo (directriz Vercel).
2. **Motion mínimo y motivado**: ÚNICO patrón de entrada: `rise-in` (CSS en
   `index.css`) en el arranque del bloc/card. Transiciones solo sobre
   `transform` y `opacity`; **nunca `transition: all`** (listar propiedades).
3. **Reduced motion**: TODO se desactiva bajo `prefers-reduced-motion: reduce`
   — definido por defecto en `index.css`, no lo repitas mal.
4. **Focus visible**: `:focus-visible` global en `index.css` (outline ámbar)
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

## 7. Estados de pantalla auth (referencia concreta)

Flujo actual ya construido en `apps/web/src/auth/AuthFlow.tsx` — es el **canon**
para todas las pantallas de auth:

- `loading`: Brand (monograma ámbar) + "leyendo dispositivo…" + `StatusStrip`.
- `login`: título "Entrar a tu operación", correo + contraseña, CTA ámbar
  "Entrar". Error inline `role="alert"`.
- `setup-pin`: "Crea tu PIN" (4-8 dígitos), dos campos, CTA "Guardar PIN".
- `unlock`: "Desbloquear hub", un solo campo, contador de intentos, botón
  "salir y borrar datos locales".
- `StatusStrip` (base de todas): punto verde + "reloj del dispositivo" +
  reloj mono en vivo (solo segundos en ámbar). Refuerza clockSync: el reloj es
  fuente de verdad.

Los PIN inputs: `type="password"`, `inputMode="numeric"`, filtro `\D`,
`spellCheck={false}`, autoComplete coherente. Nunca keypad custom: el teclado
nativo del móvil es superior y accesible.

## 8. Copy (voz de la UI)

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

## 9. Accesibilidad (reglas Vercel imprescindibles)

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
| Targets táctiles   | ≥44px en `button`/`select`/`input` (regla global de `index.css`); icon-only cuadrado `size-11`; gap ≥8px entre targets adyacentes                         |

## 10. Anti-patrones (AI tells a evitar)

De los skills de diseño (retirados 2026-10-07), prohibido por defecto:

1. **Inter + slate-900** como stack por defecto (ya no: Archivo + JetBrains Mono + tinta).
2. **Gradientes púrpura/AI** y "buttons con glow". CTA = ámbar sólido, sin brillo.
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

**Anti-patrón específico del proyecto**: añadir NUEVAS fuentes o un segundo
acento de color sin justificarlo en este documento → revisión requerida.

## 11. Checklist agentico (pre-flight antes de dar un diseño por terminado)

Mecánico y cortable con herramientas (rg/grep). Cada tarea de UI debe pasar
esto:

```text
[ ] TYPE  — Archivo (sans) y JetBrains Mono (datos) únicamente; sin <link> a fuentes remotas.
[ ] COLOR — Símbolos present en @theme de index.css; sin hexes literales para tinta/ámbar; light check AA en el acento primario.
[ ] MOTION— Solo rise-in (entrada) y :active/:hover; sin transition: all; prefers-reduced-motion cubierto.
[ ] FORMS — label visible + htmlFor + name + autocomplete; type/inputmode correctos; error inline role="alert" bajo el campo; sin placeholder-como-label; mutación con confirmación o undo.
[ ] A11Y  — botones aria-label si icon-only; div onClick⇒<button>; aria-hidden en iconos decorativos; focus-visible en todo interactivo; sin outline-none.
[ ] TOUCH — botones/selects/inputs ≥44px (regla global index.css intacta y FUERA de @layer); icon-only cuadrado size-11; sin controles fijos por debajo de 44.
[ ] DATA  — cifras con tabular-nums/mono; Intl para fecha/moneda; nombres largos truncados con min-w-0; imágenes con dimensiones.
[ ] LAYOUT — min-h-dvh; grid antes que calc(); un solo radio (md/xl); tarjetas solo con jerarquía real; estado vacío/carga/error definidos.
[ ] COPY  — voz activa, 2ª persona, "…" correcto, sin emojis, error con siguiente paso.
[ ] DIALS — variance ≤4, motion ≤3, densidad 6-7; sin parallax/marquee/scroll-reveal.
[ ] CONTRAST — CTA ámbar con texto ink-950; texto secundario ≥4.5:1.
[ ] VERIFY — build + lint + tests en verde; revisar con el skill ui-ux-pro-max incluida esta checklist.
```

> Invocación: al terminar una tarea de UI, correr la checklist (con
> `ui-ux-pro-max` para guías/contraste y `ui-walkthrough` para recorrer las
> pantallas) y reportar en el resumen qué ítems se chequearon.

---

## Referencias rápidas

- Tokens reales: `apps/web/src/index.css` (`@theme`).
- Canon auth: `apps/web/src/auth/AuthFlow.tsx`, `apps/web/src/auth/useAuth.ts`.
- Skills fuente: `.agents/skills/{ui-ux-pro-max,ui-walkthrough}/SKILL.md`.
- Normas de producto: `PRD.md`; normas de repo/proceso: `AGENTS.md`.
