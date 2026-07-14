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
  created_at  timestamptz not null default now()
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

-- ---- Indexes --------------------------------------------------------------
create index if not exists idx_barbers_shop      on barbers(barbershop_id);
create index if not exists idx_services_shop     on services(barbershop_id);
create index if not exists idx_clients_shop      on clients(barbershop_id);
create index if not exists idx_appts_shop_time   on appointments(barbershop_id, starts_at);
create index if not exists idx_appts_barber_time on appointments(barber_id, starts_at);
create index if not exists idx_memberships_user  on memberships(user_id);
