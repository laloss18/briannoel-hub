# 📘 PRD COMPLETO — ERP Modular Brian Noel Hub (v1.0 · revisado y mejorado)

---

## 1. Contexto del negocio y empresa

| Campo | Valor |
|---|---|
| **Nombre** | Brian Noel Hub |
| **Sector** | Distribución y comercialización |
| **Tamaño** | ~20 empleados |
| **Ubicación** | Venezuela (operación actual: Carabobo y Aragua) |
| **Situación actual** | Procesos mixtos: papel + WhatsApp + AppSheet |
| **Dolor principal** | Información dispersa, rutas de cobro manuales, estadísticas a mano |

**Objetivos:**
- Centralizar información.
- Dar trazabilidad completa.
- Automatizar procesos.
- Eliminar papel.
- Tomar decisiones con datos en tiempo real.
- Reducir tiempo en generación de rutas y cálculo de estadísticas.

**Restricciones:**
- Proyecto interno, sin presupuesto inicial (arranque con free tier).
- Disponibilidad de pago ($25/mes Supabase Pro + tokens IA) una vez desplegado.
- Cumplir con normativa venezolana (facturación electrónica futura, IVA, bimoneda USD/BsD, inmutabilidad fiscal).
- Un solo desarrollador (tú), ~20 hrs/semana.
- Supabase Free no incluye backups automáticos garantizados → se implementa **backup semanal propio** (`pg_dump` vía GitHub Actions).
- Límites free tier de Storage (~1 GB) condicionan la **política de fotos** (compresión + no guardar PDFs).
- **Protección de datos personales** (Ley de Datos Personales VE) dado el uso de BYOD y captura de fotos.

---

## 2. Procesos y módulos prioritarios

### 2.1. Procesos actuales
- Ventas en ruta · Clientes · Crédito y cobranza · Caja · Reportes · Nómina · RRHH.

### 2.2. Flujo comercial
- **Tipo:** Mayor y detal (principalmente detal).
- **Pago:** Crédito (plazo típico 15 días, flexible) y contado.
- **Flujo:** Promotor toma pedido → Supervisor entrega → Supervisor o cobrador cobra.
- **Formas de pago:** Efectivo Bs, Pago Móvil, Zelle, efectivo USD.
- **Precios:** Varían por condición (crédito/contado) y canal (mayor/detal).
- **Descuentos:** Sí, a discreción (con aprobación en 2 pasos para supervisores).
- **UX Promotor (no ve saldos §3.2):** al tomar pedidos a crédito necesita un indicador de **"crédito bloqueado"** sin mostrar montos.

### 2.3. Inventario
No se maneja actualmente → **fuera del MVP**.

### 2.4. Compras y proveedores
No se manejan aún → **fuera del MVP**.

### 2.5. Clientes y cobranzas
- **Volumen:** +4.000 clientes activos.
- **Crédito:** Límite por defecto = 1 bolsa/pack. Vencimiento 15 días (flexible).
- **Scoring:** Automático (puntualidad + frecuencia + monto + antigüedad). Override manual por supervisor/admin. Uso referencial.
- **Pagos parciales:** Sí. Aplicación **FIFO multi-cuenta** (pago abona primero la cuenta más antigua; remanente a la siguiente).

### 2.6. Documentos a emitir
- Nota de entrega / despacho.
- Recibo de pago (PDF / WhatsApp).
- Estado de cuenta por cliente.
- Nota de crédito / débito.
- **Modelado preparado para facturación electrónica** (RIF, Nº control, tasa BCV, IVA, totales BsD/USD, sello digital).
- **Inmutabilidad:** documentos emitidos no se editan; solo se revierten con nota de crédito.
- **PDFs generados al vuelo en cliente** (recibos y estados de cuenta) → **no se almacenan en Supabase Storage** (protege el presupuesto del free tier).

### 2.7. Reportes y KPIs

**Reportes:** ventas por día/vendedor, cobranza (diaria/semanal/período), captados/reactivados, saldos por zona/vendedor, cobrado vs pendiente por auxiliar/supervisor, estadísticas de cobro por ruta.

**KPIs:**
- Efectividad de cobro (%)
- Aging CxC (0–15, 16–30, 31–60, +60)
- Morosidad por zona y por período
- Tasa de recuperación por cobrador/ruta
- Ticket promedio (cliente / promotor)
- % clientes activos vs inactivos (30/60/90 días)
- Ranking de cobradores y supervisores
- Proyección de flujo de caja por vencimientos
- Concentración de cartera
- Índice de renovación de crédito
- Cumplimiento de ruta

*Excluido: DSO.*

### 2.8. MVP (v1.0)

**Módulos del MVP:**
1. Auth + Configuración + Bimoneda/BCV
2. Clientes (+ geolocalización + scoring)
3. Zonas (zona → municipio → estado)
4. Ventas / Despachos (+ nota de entrega)
5. Cobranza / CxC (+ aging)
6. Pagos (+ motor FIFO multi-cuenta)
7. Rutas / Entregas (+ optimizador por zona + Plus Code)
8. Reportes / Dashboard

**Componentes transversales del MVP:**
- Sincronización offline-first (con normalización de reloj).
- Auditoría e inmutabilidad (retención 3 meses con purga automática).
- Alertas y notificaciones: canales definidos → **en-app + deep link WhatsApp** (manual, sin servicios push de pago).
- Backups semanales automáticos (DR).
- Política de storage para fotos (compresión + solo subir al conectar).
- Entornos separados dev/test/prod.
- Migración de datos históricos.
- Envío PDF / WhatsApp.

**Fuera del MVP:** Caja/Tesorería, RRHH, Nómina, Contabilidad, Compras, Inventario, Facturación electrónica real.

---

## 3. Usuarios, roles y permisos

### 3.1. Usuarios
- ~20 personas.
- Móviles en calle + móviles/PC en oficina.

### 3.2. Roles

| Rol | Ve zonas | Ve saldos | Autoriza crédito | Edita cliente | Cierra ruta |
|---|---|---|---|---|---|
| Administrador | Todas | Sí | ✔ (1 paso) | ✔ | ✔ |
| Supervisor | Todas | Sí | ✔ (2 pasos) | ✔ | ✔ |
| Promotor | Todas | **No** | ✖ | ✖ | ✖ |
| Cobrador / Auxiliar | Todas | Sí | ✖ | ✖ | ✔ |

- Un usuario puede tener **múltiples roles**.
- No existe rol "Cajero".
- **UX (registrada):** Promotor sin acceso a montos de saldo pero con indicador **"crédito bloqueado"** al tomar pedidos a crédito (ver §2.2).

### 3.3. Permisos clave
- **Autorizar crédito sobre límite:** Admin (1 paso) · Supervisor (2 pasos).
- **Editar cliente:** Admin, Supervisor.
- **Eliminar despacho no entregado:** Admin, Supervisor, Promotor.
- **Despacho entregado:** inmutable; se revierte con nota de crédito.
- **Reasignación de zona:** automática al editar dirección del cliente.
- **Descuentos:** Admin (1 paso) · Supervisor (2 pasos).
- **Ver KPIs globales:** Admin, Supervisor.

### 3.4. Autenticación
- Login: usuario + contraseña.
- PIN en móvil tras primer login.
- Sin biometría.
- Recuperación por admin.
- **Sesión cacheada offline** (indispensable).
- Expiración por inactividad: **5 días**.
- **PIN:** bloqueo tras N intentos fallidos; admin puede desbloquear (BYOD, §3.5).

### 3.5. Dispositivos y protección de datos
- BYOD (dispositivos personales).
- Multi-dispositivo permitido.
- **Consentimiento informado** registrado al crear cliente y antes de capturar fotos.
- **Foto de documento de identidad: opcional** (solo con aviso explícito). Foto de casa y de cliente: recomendadas.
- **Limpieza remota:** el Admin puede revocar sesión y solicitar purga de datos locales de un dispositivo (robo/pérdida).
- Política documentada de datos personales en dispositivos BYOD (Ley VE de Datos Personales).

### 3.6. Auditoría
- Se registra: **quién creó, quién editó, quién eliminó, cuándo**.
- Solo el evento (sin before/after).
- Panel de auditoría + exportación a Excel (para análisis con IA).
- Retención: **3 meses** (con job de purga automático en el arranque de la app).

---

## 4. Stack técnico y arquitectura

| Capa | Tecnología |
|---|---|
| Frontend | PWA React + Vite + TypeScript |
| UI | TailwindCSS + shadcn/ui |
| Estado local | TanStack Query + Dexie (IndexedDB) |
| Sync engine | **Motor propio** (ref: `stellar-drive`) |
| Backend / DB | Supabase Cloud (PostgreSQL + Auth + Storage + Realtime) |
| Auth offline | PIN local + credenciales hasheadas (ref: `pin-auth`) |
| Hosting | Vercel o Cloudflare Pages |
| PDF | pdfmake / jsPDF (cliente) |
| WhatsApp | Deep link `wa.me/` (manual) |
| Tasa BCV | API BCV oficial + fallback manual |
| Plus Code | `open-location-code` (Google) |
| Mapas | Leaflet + OpenStreetMap |
| CI/CD | GitHub Actions |
| Testing | Vitest + Playwright + MSW |
| IA desarrollo | OpenCode + modelos free (escalable a pago) |

**Decisiones de plataforma (mejoras integradas):**

| Área | Decisión |
|---|---|
| Región Supabase | `sa-east-1` (São Paulo) si está disponible; fallback `us-east-1` (menor latencia Venezuela) |
| Entornos | **dev / test / prod** separados; los datos nunca se mezclan; integración y E2E usan el proyecto *test* con seeds propias |
| Backups / DR | `pg_dump` **semanal** vía GitHub Actions → almacenamiento externo (cubre riesgo #4) |
| Storage fotos | Compresión en cliente: máx. ~800px, JPEG q70 (~100–150 KB); solo se sube al conectar (§5.10); PDFs NO se guardan en Storage; presupuesto: ~150 KB × 2–3 fotos × 8 k clientes ≈ 2.4–3.6 GB solo si se llena → decidir 1 foto/cliente o pasar a Pro |
| Relojes (LWW) | El motor normaliza el reloj del dispositivo contra el tiempo del servidor en cada sync (`clockSync`) para evitar desviaciones de reloj BYOD |
| Notificaciones | En-app + deep link WhatsApp (manual); **sin push de terceros** (sin coste) |
| Docker | **Descartado en MVP**: integración vía proyecto Cloud *test* + MSW; Docker queda como reserva si el sync de pagos se vuelve inestable (Fase 4) |

**Volumen estimado:** 1–200 operaciones/usuario/día · 800–1.000 ops pico diarias.

---

## 5. Sincronización offline-online

### 5.1. Estrategia de conflictos
- **Híbrido (Opción C).**
- Entidades críticas (pagos, notas de crédito, despachos): prioridad por rol + reglas específicas.
- Entidades no críticas (datos de cliente): **LWW por timestamp + tie-break determinístico por `id`**.
- **LWW con normalización de reloj:** en cada sync se calcula el offset del reloj del dispositivo vs. el servidor y se corrigen los timestamps emitidos (mitiga skew de relojes BYOD).

### 5.2. Cola (outbox)
- 1–200 ops/día/usuario.
- Sync automático al detectar conexión + botón manual.
- Indicador visual de pendientes y sincronizados.

### 5.3. Fallos
- Se marca como **fallida** y se notifica al usuario para revisión manual.
- Cada fallo se registra en auditoría.

### 5.4. Idempotencia
- IDs únicos generados en cliente (UUID/ULID).
- Operaciones duplicadas se detectan y no se aplican dos veces (server `ON CONFLICT DO NOTHING`).

### 5.5. Sync inicial
- **Bajo demanda** (se descarga lo que se consulta o necesita).

### 5.6. Sync delta
- Solo cambios desde última sync (`updated_at` / `sync_cursor`).

### 5.7. Realtime
- Cambios en vivo para administradores en oficina.

### 5.8. Reglas de conflicto específicas
| Escenario | Regla |
|---|---|
| Pago duplicado | Se verifica existencia; si ya está acreditado, no se agrega |
| Crédito autorizado offline por supervisor | Requiere 2do paso; el admin nunca está offline |
| Despacho eliminado offline vs. marcado entregado | Prevalece la acción del supervisor |

### 5.9. Purga
- Operaciones sincronizadas (outbox) se purgan tras **7 días**.
- Registros de auditoría y `sync_events` se purgan tras **3 meses** (retención §3.6). Jobs automáticos al arrancar la app.

### 5.10. Archivos
- Solo fotos se suben a Supabase Storage **cuando haya conexión**.
- Compresión previa en cliente: máx. ~800px, JPEG q70 (~100–150 KB).
- **Foto de documento de identidad: opcional** (con consentimiento). PDFs y estados de cuenta no se almacenan.

### 5.11. Panel de monitoreo
- Ops pendientes · últimas syncs · errores · tiempo desde último sync · **offset de reloj del dispositivo** (debug visual).
- Registro en auditoría de cada sync.

### 5.12. Multi-dispositivo
- Sync bajo demanda en PC.
- Realtime solo para vistas críticas de administrador.

---

## 6. Testing y quality gates

### 6.1. Filosofía
> Proteger lo que no se puede perder (dinero, datos, confianza), no perseguir cobertura por vanidad.

| Prioridad | Áreas | Cobertura | Bloquea merge |
|---|---|---|---|
| 🔴 Crítico | Pagos, FIFO, sync, idempotencia, inmutabilidad, scoring | 90–95% | Sí |
| 🟡 Importante | Clientes, ventas, rutas, CxC/aging | 75–85% | Sí |
| 🟢 Secundario | UI, reportes, formularios | 50–60% | No (alerta) |

### 6.2. Tipos de test
- **Unitarios** (Vitest): cada commit.
- **Integración** (Vitest + **proyecto Supabase Cloud test dedicado** con seeds aplicadas vía `supabase db push`; sin Docker en MVP): cada PR.
- **E2E** (Playwright Chromium + WebKit): antes de merge a `main`.
- **Sync** (Vitest + Playwright + mock de red/MSW): antes de merge.
- **Manual en dispositivo real** (Android gama media + iPhone): antes de cada release de fase.

### 6.3. Cobertura mínima por módulo
| Módulo | Cobertura |
|---|---|
| Sync engine | 90% |
| FIFO pagos | 95% |
| Idempotencia | 95% |
| Inmutabilidad | 90% |
| Scoring | 85% |
| CxC / Aging | 85% |
| Auth | 85% |
| Clientes | 80% |
| Ventas / Despachos | 80% |
| Rutas | 75% |
| Reportes | 70% |
| UI general | 50% |

### 6.4. Quality gate por fase (bloqueante)
1. Cobertura mínima alcanzada.
2. 0 tests fallando.
3. Test de sync del módulo pasando.
4. Test de conflicto del módulo pasando (incluye **skew de reloj**: reloj desviado ±5 min → gana el correcto tras normalización).
5. Prueba manual en Android real (iPhone si aplica).
6. Documentación actualizada.
7. Demo funcional aceptada por ti.

**Si algo falla → no se avanza.**

### 6.5. CI/CD
- **Bloqueante en PR a `main`:** lint + unit + integración + E2E del módulo.
- **Nightly:** suite completa + E2E de todos los módulos.
- **Regla dura:** `main` siempre verde.

### 6.6. Herramientas
| Propósito | Herramienta |
|---|---|
| Unit + integración | Vitest |
| E2E | Playwright |
| Datos de integración | Supabase Cloud (proyecto *test* + seeds) · Docker opcional como reserva |
| CI | GitHub Actions |
| Cobertura | Vitest coverage (v8) |
| Mock de red | MSW |
| Generación de tests con IA | OpenCode |

### 6.7. Datos de prueba
- 100 clientes con zonas, saldos y scoring variados.
- Escenarios de sync: 2 dispositivos, cortes de red, concurrencia.
- Escenarios de conflicto: pago offline vs. edición en PC.
- Escenario de volumen: 200 ops en cola → sync completo.
- Escenario de **skew de reloj**: dispositivo con reloj desviado → LWW normalizado.

---

## 7. Fases de desarrollo y entregables

### 7.1. Roadmap

| Fase | Módulo | Duración |
|---|---|---|
| 0 | Fundaciones (repo, CI, Dexie, Supabase, sync base, backups, entornos) | 3–4 sem |
| 1 | Auth (login + PIN offline + roles) | 2 sem |
| 2 | Clientes + Zonas | 4 sem |
| 3 | Ventas / Despachos | 5 sem |
| 4 | Pagos + CxC | 5 sem |
| 5 | Rutas / Entregas | 4 sem |
| 6 | Reportes / Dashboard | 4 sem |
| 7 | Optimización + auditoría + alertas | 3 sem |
| 8 | Release MVP + migración de datos | 2 sem |

**Total:** ~32–34 semanas (~8 meses).

### 7.2. Entregable por fase
- Módulo funcional en local y/o accesible en red/internet.
- Demo funcional aceptada por ti.

### 7.3. Migración
- Al final (Fase 8).
- Clientes: prioritaria. Ventas históricas: nice-to-have.

### 7.4. Fuera del MVP
Caja/Tesorería · RRHH/Asistencia · Nómina · Contabilidad · Compras/Proveedores · Inventario · Facturación electrónica real.

### 7.5. Versionado
- **v1.0** = MVP completo.
- v1.1+ = resto de módulos por prioridad.

### 7.6. Releases
- **Semanales.**

### 7.7. Rollback
- Opción A: tú validas primero, luego despliegas a los 20 usuarios.

### 7.8. Documentación por fase
- Nivel medio: README + modelos + endpoints + guía de uso.

### 7.9. UAT
- Solo tú validas.

### 7.10. Métricas de adopción
1. % pedidos en sistema vs. WhatsApp.
2. % pagos en sistema vs. papel.
3. Tiempo ahorrado en generación de rutas.

---

## 8. Riesgos, métricas y criterios de aceptación

### 8.1. Criterios de aceptación del MVP
- ✅ Funciona offline en operaciones críticas.
- ✅ Sincroniza sin pérdida de datos al reconectar.
- ✅ Funciona en móvil (Android + iPhone) y PC.
- ✅ Cada módulo con tests y gate aprobados.
- ✅ Roles y permisos correctos.
- ✅ Documentación técnica y de usuario.
- ✅ Migración de clientes históricos exitosa.
- ✅ Backups semanales operativos y respaldo restaurable.

### 8.2. Métricas de éxito

| Categoría | Métrica | Meta |
|---|---|---|
| Adopción | % pedidos en sistema | >80% (3 meses) |
| Adopción | % pagos en sistema | >90% (3 meses) |
| Adopción | Tiempo generación de rutas | -70% |
| Técnica | Uptime sync | >99% |
| Técnica | Tiempo sync (50 ops) | <5s |
| Técnica | Conflictos no resueltos | 0/mes |
| Técnica | Pérdida de datos | 0 |
| Negocio | Reducción cuentas vencidas | -20% (6 meses) |
| Negocio | Mejora efectividad de cobro | +15% (6 meses) |
| Negocio | Tiempo de consulta | horas → minutos |

### 8.3. Riesgos consolidados

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| 1 | Conflictos sync en pagos | Media | Alto | Reglas + tests + log |
| 2 | Free tier Supabase agotado (DB / Storage fotos) | Media | Medio | Política de compresión, sin PDFs en Storage, 1 foto/cliente si aplica, pasar a Pro ($25/mes) |
| 3 | iOS limita background sync | Alta | Medio | Sync al abrir + indicador |
| 4 | Pérdida datos por bug sync | Media | Alto | Tests + auditoría + **backup semanal `pg_dump`** |
| 5 | Baja adopción | Media | Alto | Involucrar temprano + demo |
| 6 | Desviación cronograma | Alta | Medio | Releases semanales + IA |
| 7 | Modelo IA free degradado | Media | Bajo | Escalar a pago |
| 8 | Cambio legal (fact. electrónica) | Media | Alto | Modelado desde día 1 |
| 9 | Bug crítico sin rollback | Baja | Alto | Despliegue gradual |
| 10 | Dependencia de una sola persona | Alta | Alto | Documentación + IA copiloto |
| 11 | Desviación de reloj BYOD rompe LWW | Media | Medio | `clockSync` (normalización por offset) + tests dedicados |
| 12 | Fugas de datos personales en BYOD (fotos de identidad) | Media | Alto | Consentimiento, cédula opcional, limpieza remota, política documentada |

### 8.4. Fuera de alcance
- Facturación electrónica real (modelada, no emitida).
- Integraciones bancarias.
- Multi-empresa / multi-moneda completa.
- BI avanzado / analítica predictiva.
- App nativa.
- Compras, Inventario, Contabilidad, RRHH, Nómina, Caja.

### 8.5. Glosario

| Término | Definición |
|---|---|
| **Promotor** | Vendedor que toma pedidos en calle. |
| **Supervisor** | Autoriza créditos, entrega pedidos, puede cobrar. |
| **Cobrador / Auxiliar de ruta** | Encargado de cobrar y entregar. |
| **Despacho** | Pedido entregado a un cliente. |
| **Nota de entrega** | Documento que certifica la entrega. |
| **Recibo de pago** | Documento que certifica un pago (PDF/WhatsApp). |
| **Nota de crédito / débito** | Ajuste sobre un documento emitido. |
| **FIFO (aplicación)** | Pago abona primero a la cuenta más antigua. |
| **Aging** | Clasificación de saldos por antigüedad (0–15, 16–30, 31–60, +60). |
| **Scoring** | Calificación automática del cliente por historial. |
| **Zona** | Unidad geográfica (barrio, sector, urbanización). |
| **Municipio** | Agrupación de zonas. |
| **Estado** | Agrupación de municipios (Carabobo, Aragua). |
| **Ruta** | Conjunto de clientes de una zona para despacho y/o cobro. |
| **Plus Code** | Código geográfico corto de Google (`open-location-code`). |
| **Outbox** | Cola local de operaciones pendientes de sincronizar. |
| **Sync delta** | Sincronización solo de cambios desde última sync. |
| **LWW** | Last-Write-Wins: gana el último cambio por timestamp. |
| **Clock sync / offset** | Normalización del reloj del dispositivo contra el tiempo del servidor. |
| **Idempotencia** | Operación duplicada no se aplica dos veces. |
| **Realtime** | Push de cambios vía WebSocket (Supabase). |
| **Entornos** | Dev / test / prod: proyectos Supabase aislados que nunca mezclan datos. |
| **BCV** | Banco Central de Venezuela (tasa oficial). |
| **BsD** | Bolívares digitales. |
| **IVA** | Impuesto al Valor Agregado. |

### 8.6. Definición de "Done" por módulo
> Código + tests pasando + gate aprobado + desplegado + documentado + aceptado por ti.

### 8.7. Después del MVP (propuesta, ajustable)
1. Facturación electrónica (requisito legal <12 meses).
2. Caja / Tesorería.
3. RRHH / Nómina / Asistencia.
4. Contabilidad básica.
5. Compras / Proveedores.
6. Inventario.

### 8.8. Presupuesto
- Supabase Free → Pro ($25/mes) cuando escale.
- Tokens IA (pago variable si se supera free tier).
- Otros: dominio + email transaccional (a definir).
- El MVP no incurre en coste adicional de Storage gracias a la política de fotos (compresión + sin PDFs almacenados) y al backup propio (sin plan de backups de Supabase).

### 8.9. Mantenimiento
- Absorbido en las 20 hrs/semana.

### 8.10. Aprobación
- Firmado por: **Brian Noel Hub** (tú como único validador).

---

# 📄 VERSIÓN RESUMIDA EJECUTIVA

## ERP Modular Brian Noel Hub — Resumen ejecutivo

**Qué es:** ERP modular offline-first para distribución y comercialización, móvil-first, que sincroniza al reconectar y funciona en PC.

**Empresa:** Brian Noel Hub · ~20 empleados · Venezuela (Carabobo y Aragua).

**Problema:** Información dispersa (papel + WhatsApp + AppSheet), rutas de cobro manuales, estadísticas a mano.

**Objetivo:** Centralizar, automatizar, eliminar papel, tomar decisiones con datos.

**MVP (v1.0):** Auth · Clientes · Zonas · Ventas/Despachos · Pagos · CxC · Rutas/Entregas · Reportes, más sincronización, auditoría, alertas, backups y migración.

**Stack:**
- PWA React + Vite + TS, Dexie, Tailwind.
- Supabase Cloud (3 entornos: dev/test/prod) + motor de sync propio.
- PDF en cliente, WhatsApp manual, Plus Code, Leaflet.
- GitHub Actions (CI + nightly + backup semanal) + Vitest + Playwright + OpenCode (IA).

**Diferencial:**
- Funciona 100% offline.
- Aplicación FIFO de pagos multi-cuenta.
- Scoring automático.
- Optimización de rutas por zona + Plus Code exportable a Spoke/Optiroute.
- Inmutabilidad de documentos.
- Bimoneda USD/BsD con tasa BCV.
- Normalización de reloj en sincronización (LWW robusto en BYOD).
- Política de storage para operar en free tier sin sobresaltos.

**Roadmap:** 8 fases, ~32–34 semanas a 20 hrs/sem, releases semanales.

**Calidad:** Tests obligatorios por módulo, cobertura 75–95% en lo crítico, gate bloqueante antes de avanzar.

**Costo:** Arranque en free tier · $25/mes Supabase Pro al escalar · tokens IA si aplica.

**Métricas de éxito:** >80% pedidos en sistema, >90% pagos en sistema, -70% tiempo de rutas, 0 pérdida de datos.

**Firmado por:** Brian Noel Hub.