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

### B0 — Preparación externa

- Cuenta Stripe (modo test ya; **activar live requiere RFC/datos fiscales**
  → depende de la cita del SAT, no bloquea el desarrollo).
- Products/Prices para Esencial/Pro/Estudio en MXN (espejo de
  `src/lib/data/plans.ts`), creados por script de seed idempotente.
- Env vars: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_ESENCIAL|PRO|ESTUDIO`. SDK: `npm install stripe`.

### B1 — Modelo de datos

- `barbershops.stripe_customer_id`.
- `subscriptions` (ya existe, hoy mock): agregar `stripe_subscription_id`,
  `current_period_end`; mapear estados de Stripe → `activa`|`prueba`|
  `cancelada` (+ decidir cómo mostrar `past_due`: gracia con banner).
- Facturas: NO almacenar; leerlas de la API de Stripe al vuelo para la
  lista del `PlanPanel` (menos sincronización que mantener).

### B2 — Checkout y portal

- `PlanPanel`: "Mejorar plan" → server action que crea Checkout Session
  (`mode: subscription`, con trial si aplica) y redirige.
- "Administrar suscripción" → sesión del **Customer Portal** de Stripe
  (cambio de plan, tarjeta, cancelación) — no construimos esa UI.

### B3 — Webhook `POST /api/webhooks/stripe`

- Verificación con `stripe.webhooks.constructEvent` + idempotencia por
  `event.id`. ⚠️ Necesita el body CRUDO (`await req.text()`, nunca
  `req.json()` antes de verificar) — el bug clásico de este webhook.
- Eventos: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid`,
  `invoice.payment_failed` → sincronizan `subscriptions`.

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
| 5 | B0–B3 (Billing completo) | M |
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
5. ¿Trial del SaaS con tarjeta por delante o sin tarjeta? (afecta B2;
   recomendación: sin tarjeta — trial app-side con el estado `prueba` que ya
   existe en `subscriptions`, Checkout solo al convertir). — antes del paso 5.
