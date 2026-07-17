# Pagos — Plan de implementación

> **Estado: EN CURSO.** Decidido el 2026-07-16; ese mismo día se aplicó el
> **paso 1** (A0 parte de código + A1 completo): migración en la DB real,
> tipos TS, badges de UI, env vars y SDK instalados. Falta de A0 lo externo:
> cuenta MP de Navaja + aplicación OAuth en el panel de developers y registro
> de las URLs (bloqueado por el dominio navaja.app).

## Decisiones tomadas

| Decisión | Valor |
|---|---|
| Pagos de reservas (cliente final → barbería) | **Mercado Pago** (Checkout Pro + OAuth) |
| Comisión de Navaja por reserva | **$0 — el cobro es 100% de la barbería** (sin `marketplace_fee`) |
| Suscripciones del SaaS (barbería → Navaja) | **Stripe Billing**, cuenta única, sin Connect |
| Modo de cobro por barbería | Configurable: `off` \| `anticipo_fijo` \| `porcentaje` \| `total` |
| Datos de tarjeta | Nunca los tocamos: redirect a checkout hospedado (cero alcance PCI) |
| Gating por plan (pregunta 1, decidida 2026-07-16) | Cobros en reservas **solo Pro/Estudio** (`Plan.payments` en `plans.ts`) |
| Citas creadas por el dueño (pregunta 4, confirmada 2026-07-16) | **Siempre sin pago** — el hold solo aplica al wizard público |

Los dos flujos son independientes y no comparten dinero ni credenciales;
solo comparten patrones (webhook firmado e idempotente, tabla local
sincronizada, secretos en env validados por `src/lib/security/env.ts`).

```
Cliente final ──paga anticipo──► Cuenta MP de la barbería   (Track A)
Barbería ──paga plan mensual──► Cuenta Stripe de Navaja     (Track B)
```

---

## Track A — Anticipos de reserva con Mercado Pago

### Flujo objetivo

1. El dueño conecta su cuenta MP (OAuth) y elige modo de cobro y monto.
2. El cliente completa el wizard; la cita nace `pendiente_pago` con un
   **hold de 15 min** que bloquea el slot.
3. Redirect al Checkout Pro de MP (con el token del vendedor, sin fee).
4. El webhook confirma el pago → cita `confirmada` + notificaciones.
5. Si el hold expira sin pago, `pg_cron` libera el slot.

### A0 — Preparación externa (sin código)

- Cuenta de Mercado Pago México para Navaja + **aplicación** en el
  [panel de developers](https://www.mercadopago.com.mx/developers) con
  OAuth habilitado. Como no cobramos fee, no importa el modo marketplace;
  el OAuth es solo para operar *a nombre de* cada barbería.
- Registrar redirect URL del OAuth y URL de webhooks (HTTPS público; en
  dev: sandbox + túnel `cloudflared` o el simulador del panel).
- Nuevas env vars (agregar a la validación de `src/lib/security/env.ts`):
  `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `MP_WEBHOOK_SECRET`,
  `PAYMENTS_ENCRYPTION_KEY` (AES-256-GCM para tokens en reposo).
- SDK: `npm install mercadopago` (v2).

### A1 — Modelo de datos (`supabase/schema.sql` + `policies.sql`)

- **`appointment_status`**: agregar valor `'pendiente_pago'`
  (`ALTER TYPE ... ADD VALUE`). Tocar TODOS los sitios que filtran por
  estado "ocupa slot":
  - exclusion constraint (`schema.sql` ~L185): incluir `pendiente_pago`
    en el `where (...)` — requiere recrear la constraint.
  - vista `busy_slots` (`policies.sql` ~L127): incluirlo (sigue sin PII).
  - búsqueda de "barbero libre" dentro de `book_appointment`
    (`policies.sql` ~L179).
  - `AppointmentStatus` en `src/lib/data/types.ts` + badges de UI.
- **`appointments`**: columna `payment_expires_at timestamptz` (solo se
  usa con `pendiente_pago`).
- **`payment_accounts`** (cuenta MP conectada por barbería):
  `barbershop_id` (unique), `mp_user_id`, `access_token_enc`,
  `refresh_token_enc`, `token_expires_at`, `live_mode`, `status`
  (`activa`|`error_refresh`|`desconectada`), timestamps.
  RLS: `select` solo miembros (`app_is_member`); escrituras solo service
  role. **Nunca** exponer a `anon`.
- **`payments`**: `id`, `barbershop_id`, `appointment_id`,
  `mp_payment_id` (**unique** → idempotencia del webhook), `amount_cents`,
  `status` (`aprobado`|`rechazado`|`reembolsado`), `raw jsonb` (auditoría),
  `created_at`. RLS igual que `payment_accounts`.
- **`barbershops`** (las reglas de reserva ya viven ahí como columnas
  `auto_confirm`, `notif_*`): agregar `payment_mode text`
  (`off`|`anticipo_fijo`|`porcentaje`|`total`, default `off`),
  `payment_deposit_cents int`, `payment_percent int`.
- **`pg_cron`**: job cada minuto que libera holds vencidos
  (`update appointments set status='cancelada' where status='pendiente_pago'
  and payment_expires_at < now()`).
- Tipos TS espejo en `src/lib/data/types.ts` (`PaymentAccount`, `Payment`,
  campos nuevos en `BookingRules`).

### A2 — Conexión OAuth en el dashboard

- Nueva sección **Configuración → Pagos** (item en `SettingsNav`, panel
  `PagosPanel.tsx` siguiendo el patrón de `DomainsPanel`):
  - Estado de conexión (conectada / sin conectar / error de renovación).
  - Botón "Conectar Mercado Pago" → URL de autorización MP con `state`
    firmado (anti-CSRF, incluye `barbershop_id`).
  - Desconectar (borra tokens, apaga `payment_mode`).
  - Selector de modo de cobro + monto (deshabilitado sin cuenta conectada).
- Route handler `GET /api/mercadopago/callback`: valida `state`,
  intercambia `code` → `access_token` + `refresh_token` + `user_id`,
  cifra y guarda en `payment_accounts`, redirect al panel.
- Server action `savePaymentRules` en `src/app/actions/settings.ts`
  (mismo patrón zod + rate-limit + membership que las demás).
- **Renovación de tokens** (expiran a 180 días, refresh de un solo uso):
  renovación *lazy* al crear cada checkout si `token_expires_at` < 30 días;
  si falla → `status='error_refresh'` + banner en el dashboard pidiendo
  reconectar. Sin cron externo.

### A3 — Checkout en el wizard público

- **RPC `book_appointment`**: si la barbería tiene `payment_mode <> 'off'`
  y cuenta MP activa → la cita nace `pendiente_pago` con
  `payment_expires_at = now() + interval '15 min'`, y **NO** inserta las
  notificaciones (se mueven a la confirmación del pago). Devuelve además
  el monto a cobrar (calculado server-side según modo).
  ⚠️ Cambiar el tipo de retorno exige `drop function` + re-aplicar el
  `revoke`/`grant` a `anon, authenticated` (con `create or replace` no basta;
  y sin el grant el wizard público se rompe en silencio).
- **Server action `book`** (`src/app/actions/book.ts`): si la RPC devolvió
  cita con pago pendiente → crea la *preference* de Checkout Pro con el
  token del vendedor: ítem con el monto, `external_reference` = id de la
  cita, `notification_url`, `back_urls` a `/[shop]/pago/[cita]`,
  `date_of_expiration` alineada al hold. Devuelve `init_point`.
- **`BookingWizard`**: tras "Confirmar cita", si hay pago → paso de resumen
  con desglose (precio del servicio, anticipo a pagar hoy, restante en
  sucursal) y redirect a MP.
- **Página de retorno `/[shop]/pago/[cita]`**: "Estamos confirmando tu
  pago…" con polling (server action rate-limited que devuelve SOLO el
  estado de la cita, sin PII) hasta `confirmada`, rechazo o expiración.
  **Nunca** confiar en los query params del redirect para confirmar.

### A4 — Webhook de Mercado Pago

- `POST /api/webhooks/mercadopago` (runtime Node):
  1. Verificar firma `x-signature` (HMAC con `MP_WEBHOOK_SECRET`); si es
     inválida → 401 sin detalle.
  2. Del body solo tomar el `payment_id`; consultar el pago a la API de MP
     con el token del vendedor correspondiente (resuelto vía
     `external_reference` → cita → barbería).
  3. Idempotencia por `payments.mp_payment_id` unique (MP reintenta).
  4. `approved` → RPC `confirm_paid_appointment` (SECURITY DEFINER, un
     solo commit): cita → `confirmada`, insert en `payments`, insert de
     las notificaciones (WhatsApp dueño + email cliente) que la RPC de
     reserva ya no manda en flujos con pago.
     ⚠️ Update condicional (`... where id = $1 and status = 'pendiente_pago'
     returning id`) y cero filas ⇒ ruta de refund: evita revivir una cita que
     pg_cron o el dueño ya cancelaron (carrera cancela-vs-confirma).
  5. `rejected`/`cancelled` → registrar intento; el hold sigue vivo hasta
     expirar para permitir reintento desde la página de retorno.
  6. Responder 2xx rápido; trabajo pesado fuera del request si hiciera falta.
- **Carrera crítica**: pago aprobado que llega DESPUÉS de que el hold
  expiró (y quizá el slot ya lo tomó otro) → reembolso automático + aviso
  al cliente. Es el único caso de refund automático.

### A5 — Cancelaciones, reembolsos y dashboard

- Cancelar cita pagada dentro de `cancellation_window_hours` → refund vía
  API de MP (`payments.status='reembolsado'`). Fuera de la ventana → sin
  reembolso (el anticipo es el anti no-show; así se comunica en el wizard).
- UI dueño: chip de pago en `AppointmentRow`/`AgendaBoard`, detalle del
  pago + botón de reembolso manual en `AppointmentDrawer`, columna en
  `CitasList`, y monto cobrado en reportes.

### A6 — Pruebas sandbox (checklist de salida)

- Usuarios de prueba MP (vendedor + comprador) y tarjetas test
  (aprobada / rechazada / pendiente).
- Casos: doble booking en carrera con `pendiente_pago`; hold expira y el
  slot reaparece; webhook duplicado (idempotente); firma inválida → 401;
  pago tardío → refund automático; refresh de token vencido; reembolso por
  cancelación; barbería sin cuenta conectada → wizard cobra `off`.

---

## Track B — Suscripciones del SaaS con Stripe Billing

> **Estado (2026-07-16): B0–B3 implementados Y VERIFICADOS end-to-end en test
> mode.** Checkout real con tarjeta 4242 → suscripción Pro activa; webhook
> probado con eventos REALES re-firmados localmente (checkout.session.completed
> → sync pro/activa, duplicado → already_processed, firma inválida → 401,
> subscription.deleted → cancelada); Customer Portal y facturas al vuelo
> funcionando. La cuenta test conserva customer + suscripción cancelada +
> factura pagada como evidencia. Falta: B4 (gating por límites) + B5 (test
> clocks) y registrar el endpoint del webhook cuando exista dominio. Modo live
> sigue bloqueado por el RFC (cita SAT). ⚠️ La `STRIPE_SECRET_KEY` de test
> pasó por el chat — girarla en el dashboard.

### B0 — Preparación externa ✅ (test mode, 2026-07-16)

- Cuenta Stripe (modo test ya; **activar live requiere RFC/datos fiscales**
  → depende de la cita del SAT, no bloquea el desarrollo).
- Products/Prices para Esencial/Pro/Estudio en MXN (espejo de
  `src/lib/data/plans.ts`) — creados vía MCP en la cuenta test
  (`acct_1Tu0Ag1JTHBIvqZj`): `price_1Tu11g…` / `price_1Tu11o…` / `price_1Tu11q…`
  (los IDs completos viven en `.env.example`).
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_ESENCIAL|PRO|ESTUDIO`. SDK: `stripe` v22 instalado.
- Sin env configurada el panel opera en **modo demo** (cambio de plan directo
  en DB, sin cobro) — `main` sigue funcional en dev.

### B1 — Modelo de datos ✅ (migración `stripe_billing_track_b_schema`)

- `barbershops.stripe_customer_id` (unique parcial; customer lazy en el
  primer checkout).
- `subscriptions`: `stripe_subscription_id` (unique parcial) +
  `current_period_end`. Estados de Stripe → locales: `trialing`→`prueba`;
  `active`/`past_due`→`activa` (past_due = gracia, Stripe reintenta);
  `canceled`/`unpaid`/`paused`→`cancelada`; `incomplete*` se ignora (checkout
  abandonado, no pisa la fila local).
- `stripe_events` (id pk) — idempotencia del webhook. RLS sin políticas +
  revoke explícito: solo service_role.
- Facturas: NO se almacenan; se leen de la API al vuelo para la lista del
  `PlanPanel` (`listShopInvoices`, últimas 12, paid|open).

### B2 — Checkout y portal ✅ (`src/lib/payments/stripe.ts`)

- `PlanPanel`: "Cambiar a X" → `startPlanCheckout`: sin suscripción Stripe →
  Checkout Session (`mode: subscription`, sin trial en checkout — el trial es
  app-side, decidido 2026-07-16); ya suscrita → Customer Portal.
- "Administrar suscripción" → `openBillingPortal` (cambio de plan, tarjeta,
  cancelación en la UI hospedada de Stripe) — no construimos esa UI.
- Retorno a `/dashboard/configuracion/plan?checkout=exito|cancelado` con
  banner; la verdad la escribe el webhook, nunca el redirect.

### B3 — Webhook `POST /api/webhooks/stripe` ✅

- Verificación con `stripe.webhooks.constructEvent` + idempotencia por
  `event.id` en `stripe_events` (23505 = ya procesado; si el handler falla,
  se borra la marca para que el retry sí procese). ⚠️ Body CRUDO
  (`await req.text()`, nunca `req.json()` antes de verificar).
- Sincroniza desde `checkout.session.completed` (retrieve de la suscripción)
  y `customer.subscription.updated|deleted`. `invoice.paid` no hace falta
  (cada renovación llega también como subscription.updated con el nuevo
  `current_period_end` — en API Basil vive en el subscription item);
  `invoice.payment_failed` = log + gracia.

### B4 — Gating por plan

- Helper server-side único (`getPlanLimits(shopId)`) usado por las server
  actions: `maxBarbers`, `maxAppointmentsPerMonth`, `customDomain`,
  `whatsapp` — y decidir si "cobros en reservas" (Track A) es exclusivo
  de Pro/Estudio. El gating se aplica en el servidor; la UI solo refleja
  (candados en `PlanPanel`/paneles).

### B5 — Pruebas

- `stripe listen --forward-to` en dev; *test clocks* para simular
  renovaciones, fallos de cobro y fin de trial.

---

## Seguridad (transversal, extiende SECURITY.md)

- Tokens MP cifrados en reposo (AES-256-GCM, clave solo en env del
  servidor); jamás llegan al cliente ni a logs.
- Webhooks: verificación de firma SIEMPRE, idempotencia SIEMPRE, respuesta
  rápida, y el estado real se consulta a la API del proveedor — nunca se
  confía en el body ni en redirects del navegador.
- RLS: `payment_accounts` y `payments` solo legibles por miembros de la
  barbería; sin acceso `anon`; escrituras solo por service role / RPCs
  SECURITY DEFINER.
- Rate-limit en el endpoint de polling y en los webhooks (mismo helper
  `src/lib/security/rate-limit.ts`). ⚠️ En webhooks, MUY generoso: MP/Stripe
  reintentan legítimamente desde IPs variables — ahí la defensa real es la
  firma; un límite agresivo pierde confirmaciones de pago.
- Los montos se calculan SIEMPRE server-side (RPC/preference); el cliente
  nunca manda cantidades.

## Orden de ejecución sugerido

| Paso | Alcance | Tamaño relativo |
|---|---|---|
| 1 | ✅ A0 + A1 (prep + migración de datos) — aplicado 2026-07-16; de A0 solo falta lo externo (cuenta MP + app OAuth + URLs) | M |
| 2 | A2 (OAuth + panel Pagos) + check de plan en `savePaymentRules` (rebanada de B4, por la decisión Pro/Estudio) | M |
| 3 | A3 + A4 (checkout + webhook — el corazón) | L |
| 4 | A5 + A6 (refunds, UI dueño, QA sandbox) | M |
| 5 | ✅ B0–B3 (Billing en test mode) — implementado y verificado end-to-end 2026-07-16 (checkout real 4242 + webhook con eventos re-firmados + portal) | M |
| 6 | B4 + B5 (gating + QA) | S |

Cada paso deja `main` funcional (el modo default es `payment_mode='off'`,
así que nada cambia para barberías sin pagos hasta que conectan su cuenta).

## Preguntas abiertas (decidir antes del paso correspondiente)

1. ~~¿"Cobros en reservas" es feature de todos los planes o solo Pro/Estudio?~~
   **DECIDIDO (2026-07-16): solo Pro/Estudio** — sin fee por transacción, es
   el argumento de venta natural del upgrade. Registrado como `Plan.payments`
   en `plans.ts`; el paso 2 debe aplicar el check server-side en
   `savePaymentRules` (rebanada mínima de B4 adelantada).
2. ¿Pago aprobado ⇒ cita `confirmada` aunque la barbería tenga
   `auto_confirm=false`? (recomendación: sí — ya pagó). — antes del paso 3.
3. ¿Monto mínimo del anticipo fijo? (MP rechaza cobros muy pequeños;
   sugerencia: mínimo $20 MXN validado en zod + RPC). — antes del paso 3.
4. ~~Citas creadas por el dueño desde el dashboard: siempre sin pago.~~
   **CONFIRMADO (2026-07-16)** — el hold solo aplica al wizard público; además
   el dashboard no puede poner `pendiente_pago` a mano (enum del action) y un
   hold solo admite "cancelar" desde el drawer (confirmar es del webhook).
5. ~~¿Trial del SaaS con tarjeta por delante o sin tarjeta?~~
   **DECIDIDO (2026-07-16): sin tarjeta** — trial app-side con el estado
   `prueba` que ya existe en `subscriptions`; Checkout solo al convertir.
   Cero suscripciones `incomplete` en Stripe y menos fricción en el alta.
   Aplicado en B2 (el Checkout no manda `trial_period_days`).
