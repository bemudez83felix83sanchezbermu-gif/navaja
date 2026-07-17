-- ============================================================================
-- Navaja · Esquema de base de datos (Postgres / Supabase)
-- Multi-tenant: todo cuelga de `barbershops`. La seguridad de filas vive en
-- policies.sql (RLS). Aplica este archivo primero, luego policies.sql.
-- ============================================================================

create extension if not exists pgcrypto;      -- gen_random_uuid()
create extension if not exists btree_gist;     -- exclusion constraint (anti-solape)

-- ---- Enums ----------------------------------------------------------------
do $$ begin
  create type appointment_status as enum
    ('pendiente','confirmada','completada','cancelada','no_show','pendiente_pago');
exception when duplicate_object then null; end $$;
-- DBs existentes (el create de arriba no-opea): agrega el valor del hold de
-- pago. ⚠️ Debe correr en su PROPIA transacción — Postgres no permite usar un
-- valor de enum nuevo en la misma transacción que lo agrega, y más abajo este
-- archivo lo usa (exclusion constraint, índice parcial).
alter type appointment_status add value if not exists 'pendiente_pago';

do $$ begin
  create type member_role as enum ('owner','staff');
exception when duplicate_object then null; end $$;

do $$ begin
  create type domain_status as enum ('pendiente_dns','verificando','activo','error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type plan_id as enum ('esencial','pro','estudio');
exception when duplicate_object then null; end $$;

-- ---- Tenants --------------------------------------------------------------
create table if not exists barbershops (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null check (char_length(name) between 2 and 80),
  tagline     text,
  address     text,
  phone       text,
  timezone    text not null default 'America/Mexico_City',
  open_days   int[] not null default '{1,2,3,4,5,6}',
  open_hour   int  not null default 10 check (open_hour between 0 and 23),
  close_hour  int  not null default 20 check (close_hour between 1 and 24),
  -- Reglas de reserva (auto-servicio; ver /dashboard/configuracion/reservas)
  slot_step_min          int not null default 15 check (slot_step_min in (15,20,30,60)),
  min_notice_min         int not null default 60 check (min_notice_min between 0 and 2880),
  max_advance_days       int not null default 30 check (max_advance_days between 1 and 180),
  auto_confirm           boolean not null default false,
  cancel_window_hours    int not null default 3 check (cancel_window_hours between 0 and 72),
  allow_barber_choice    boolean not null default true,
  require_email          boolean not null default false,
  -- Notificaciones (auto-servicio; ver /dashboard/configuracion/notificaciones)
  notif_confirmation_email boolean not null default true,
  notif_reminder_24h       boolean not null default true,
  notif_reminder_2h        boolean not null default false,
  notif_whatsapp           boolean not null default false,
  notif_owner_new_booking  boolean not null default true,
  notif_sender_name        text,
  -- Teléfono (WhatsApp) del dueño al que llegan las reservas nuevas
  notif_owner_phone        text check (notif_owner_phone ~ '^\+?[0-9 ]{8,20}$'),
  -- Cobro de anticipos al reservar (Track A de PAGOS.md). Solo surte efecto
  -- con una cuenta MP conectada en `payment_accounts`; default 'off' = nada
  -- cambia para barberías sin pagos.
  payment_mode          text not null default 'off'
                        check (payment_mode in ('off','anticipo_fijo','porcentaje','total')),
  payment_deposit_cents int not null default 0 check (payment_deposit_cents >= 0),
  payment_percent       int not null default 50 check (payment_percent between 1 and 100),
  -- Cliente de Stripe Billing (Track B de PAGOS.md) — se crea lazy en el
  -- primer checkout de upgrade. NULL = nunca ha pasado por Stripe.
  stripe_customer_id    text,
  -- Dueño mostrado en /configuracion/equipo hasta que exista auth real
  owner_name  text,
  owner_email text,
  -- Prueba social mostrada en la página pública
  rating      numeric(2,1) not null default 5.0 check (rating between 0 and 5),
  reviews     int not null default 0 check (reviews >= 0),
  created_at  timestamptz not null default now()
);

-- ---- Suscripción (sincronizada desde el webhook de Stripe — Track B) --------
-- El estado local es la fuente para el gating por plan; Stripe es la fuente
-- del dinero. `stripe_subscription_id` NULL = trial app-side (estado 'prueba')
-- o billing en modo demo sin Stripe configurado.
create table if not exists subscriptions (
  barbershop_id uuid primary key references barbershops(id) on delete cascade,
  plan          plan_id not null default 'esencial',
  status        text not null default 'activa' check (status in ('activa','prueba','cancelada')),
  started_at    timestamptz not null default now(),
  renews_at     timestamptz,
  stripe_subscription_id text,
  current_period_end     timestamptz
);
create unique index if not exists subscriptions_stripe_sub_uq
  on subscriptions (stripe_subscription_id) where stripe_subscription_id is not null;
create unique index if not exists barbershops_stripe_customer_uq
  on barbershops (stripe_customer_id) where stripe_customer_id is not null;

-- Idempotencia del webhook de Stripe por event.id (Stripe reintenta y duplica).
-- Solo la escribe el webhook con service_role: RLS activa sin políticas +
-- revoke explícito (en policies.sql) = cero acceso para anon/authenticated.
create table if not exists stripe_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

-- ---- Dominios por tenant ---------------------------------------------------
-- Cada barbería llega por su subdominio `{slug}.navaja.app` (implícito, no se
-- guarda aquí) y opcionalmente por dominios propios. El proxy resuelve el Host
-- contra esta tabla; Caddy consulta el endpoint "ask" (on_demand_tls) que
-- responde 200 solo si el dominio existe con status <> 'error'.
create table if not exists domains (
  id             uuid primary key default gen_random_uuid(),
  barbershop_id  uuid not null references barbershops(id) on delete cascade,
  domain         text not null unique
                 check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  is_primary     boolean not null default false,
  status         domain_status not null default 'pendiente_dns',
  error_detail   text,
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);

-- un solo dominio principal por barbería
create unique index if not exists uq_domains_primary
  on domains(barbershop_id) where is_primary;

-- ---- Invitaciones de equipo -------------------------------------------------
-- El dueño invita staff por email; al aceptar (auth.users creado) se convierte
-- en fila de `memberships` y la invitación se borra.
create table if not exists invitations (
  id             uuid primary key default gen_random_uuid(),
  barbershop_id  uuid not null references barbershops(id) on delete cascade,
  email          text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name           text,
  role           member_role not null default 'staff',
  token          uuid not null default gen_random_uuid(),
  expires_at     timestamptz not null default now() + interval '7 days',
  created_at     timestamptz not null default now(),
  unique (barbershop_id, email)
);

-- ---- Membership: maps auth.users -> a shop + role -------------------------
create table if not exists memberships (
  user_id        uuid not null references auth.users(id) on delete cascade,
  barbershop_id  uuid not null references barbershops(id) on delete cascade,
  role           member_role not null default 'staff',
  created_at     timestamptz not null default now(),
  primary key (user_id, barbershop_id)
);

-- ---- Barbers --------------------------------------------------------------
create table if not exists barbers (
  id             uuid primary key default gen_random_uuid(),
  barbershop_id  uuid not null references barbershops(id) on delete cascade,
  name           text not null check (char_length(name) between 2 and 80),
  role           text,
  bio            text,
  specialties    text[] not null default '{}',
  accent         text,
  rating         numeric(2,1) not null default 5.0 check (rating between 0 and 5),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---- Services -------------------------------------------------------------
create table if not exists services (
  id             uuid primary key default gen_random_uuid(),
  barbershop_id  uuid not null references barbershops(id) on delete cascade,
  name           text not null check (char_length(name) between 2 and 80),
  description    text,
  duration_min   int not null check (duration_min between 5 and 600),
  price_cents    int not null check (price_cents >= 0),
  popular        boolean not null default false,
  active         boolean not null default true
);

-- which barbers perform which services
create table if not exists barber_services (
  barber_id   uuid not null references barbers(id) on delete cascade,
  service_id  uuid not null references services(id) on delete cascade,
  primary key (barber_id, service_id)
);

-- ---- Clients (PII — never public) -----------------------------------------
create table if not exists clients (
  id             uuid primary key default gen_random_uuid(),
  barbershop_id  uuid not null references barbershops(id) on delete cascade,
  name           text not null,
  phone          text not null,
  email          text,
  notes          text,
  created_at     timestamptz not null default now(),
  unique (barbershop_id, phone)   -- one record per phone per shop
);

-- ---- Appointments ---------------------------------------------------------
create table if not exists appointments (
  id             uuid primary key default gen_random_uuid(),
  barbershop_id  uuid not null references barbershops(id) on delete cascade,
  barber_id      uuid not null references barbers(id),
  service_id     uuid not null references services(id),
  client_id      uuid not null references clients(id),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  status         appointment_status not null default 'pendiente',
  price_cents    int not null check (price_cents >= 0),
  notes          text,
  -- Solo citas 'pendiente_pago': fin del hold de 15 min que bloquea el slot
  -- mientras el cliente paga en Mercado Pago. pg_cron libera los vencidos.
  payment_expires_at timestamptz,
  created_at     timestamptz not null default now(),
  check (ends_at > starts_at),
  -- DB-level guarantee against double-booking the same barber for overlapping
  -- time ranges (ignores cancelled/no-show). This is the last line of defense
  -- even if app logic has a race condition. 'pendiente_pago' cuenta: el hold
  -- ocupa el slot igual que una cita real.
  constraint no_barber_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pendiente','confirmada','completada','pendiente_pago'))
);

-- ---- Registro de notificaciones salientes ----------------------------------
-- Cada evento que debería avisarse (nueva reserva → WhatsApp del dueño,
-- confirmación → email del cliente) se registra aquí con status
-- 'pendiente_envio'. Un worker/edge function con proveedor real (Twilio /
-- WhatsApp Cloud API / Resend) los consumirá después; la app ya deja el
-- pipeline listo y el dashboard puede listarlos.
create table if not exists notifications_log (
  id             uuid primary key default gen_random_uuid(),
  barbershop_id  uuid not null references barbershops(id) on delete cascade,
  appointment_id uuid references appointments(id) on delete set null,
  channel        text not null check (channel in ('whatsapp','email','sms')),
  audience       text not null check (audience in ('dueno','cliente')),
  recipient      text not null,   -- teléfono o email según canal
  subject        text not null,
  body           text,
  status         text not null default 'pendiente_envio'
                 check (status in ('pendiente_envio','enviado','error')),
  created_at     timestamptz not null default now()
);

-- ---- Pagos (Track A de PAGOS.md): cuenta MP conectada por barbería ----------
-- Tokens SIEMPRE cifrados en reposo (AES-256-GCM con PAYMENTS_ENCRYPTION_KEY,
-- que vive solo en el env del servidor). Nunca llegan al navegador ni a logs.
-- RLS en policies.sql: lectura solo miembros (sin columnas *_enc); escrituras
-- solo service_role (callback OAuth / renovación lazy de tokens).
create table if not exists payment_accounts (
  id                uuid primary key default gen_random_uuid(),
  barbershop_id     uuid not null unique references barbershops(id) on delete cascade,
  mp_user_id        text not null,
  access_token_enc  text not null,
  refresh_token_enc text not null,
  -- MP expira tokens a 180 días (refresh de un solo uso): renovación lazy al
  -- crear cada checkout cuando falten <30 días; si falla → 'error_refresh'.
  token_expires_at  timestamptz not null,
  live_mode         boolean not null default true,
  status            text not null default 'activa'
                    check (status in ('activa','error_refresh','desconectada')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---- Pagos: anticipos cobrados (un registro por pago de MP) -----------------
-- `mp_payment_id` unique = idempotencia del webhook (MP reintenta avisos).
-- `raw` guarda la respuesta de la API de MP para auditoría/disputas.
create table if not exists payments (
  id             uuid primary key default gen_random_uuid(),
  barbershop_id  uuid not null references barbershops(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  mp_payment_id  text not null unique,
  amount_cents   int not null check (amount_cents > 0),
  status         text not null check (status in ('aprobado','rechazado','reembolsado')),
  raw            jsonb,
  created_at     timestamptz not null default now()
);

-- ---- Indexes --------------------------------------------------------------
create index if not exists idx_barbers_shop      on barbers(barbershop_id);
create index if not exists idx_services_shop     on services(barbershop_id);
create index if not exists idx_clients_shop      on clients(barbershop_id);
create index if not exists idx_appts_shop_time   on appointments(barbershop_id, starts_at);
create index if not exists idx_appts_barber_time on appointments(barber_id, starts_at);
create index if not exists idx_memberships_user  on memberships(user_id);
create index if not exists idx_domains_shop      on domains(barbershop_id);
create index if not exists idx_invitations_shop  on invitations(barbershop_id);
create index if not exists idx_notif_shop_time   on notifications_log(barbershop_id, created_at desc);
create index if not exists idx_payments_shop_time on payments(barbershop_id, created_at desc);
create index if not exists idx_payments_appt      on payments(appointment_id);
-- Parcial: solo holds vivos — lo barre el job de pg_cron cada minuto.
create index if not exists idx_appts_payment_hold on appointments(payment_expires_at)
  where status = 'pendiente_pago';

-- ---- pg_cron: libera holds de pago vencidos ---------------------------------
-- Si el cliente no pagó dentro de la ventana, la cita se cancela y el slot
-- reaparece. Un pago aprobado que llegue DESPUÉS se reembolsa automáticamente
-- (ver PAGOS.md A4). `cron.schedule` con nombre es idempotente (reemplaza).
create extension if not exists pg_cron;
select cron.schedule(
  'expire-payment-holds',
  '* * * * *',
  $$update appointments
      set status = 'cancelada'
      where status = 'pendiente_pago' and payment_expires_at < now()$$
);
