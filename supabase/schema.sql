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
    ('pendiente','confirmada','completada','cancelada','no_show');
exception when duplicate_object then null; end $$;

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
  -- Dueño mostrado en /configuracion/equipo hasta que exista auth real
  owner_name  text,
  owner_email text,
  -- Prueba social mostrada en la página pública
  rating      numeric(2,1) not null default 5.0 check (rating between 0 and 5),
  reviews     int not null default 0 check (reviews >= 0),
  created_at  timestamptz not null default now()
);

-- ---- Suscripción (mock de billing; Stripe/Conekta llegará después) ---------
create table if not exists subscriptions (
  barbershop_id uuid primary key references barbershops(id) on delete cascade,
  plan          plan_id not null default 'esencial',
  status        text not null default 'activa' check (status in ('activa','prueba','cancelada')),
  started_at    timestamptz not null default now(),
  renews_at     timestamptz
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
  created_at     timestamptz not null default now(),
  check (ends_at > starts_at),
  -- DB-level guarantee against double-booking the same barber for overlapping
  -- time ranges (ignores cancelled/no-show). This is the last line of defense
  -- even if app logic has a race condition.
  constraint no_barber_overlap exclude using gist (
    barber_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('pendiente','confirmada','completada'))
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
