-- ============================================================================
-- Navaja · Row Level Security (RLS) + funciones seguras
-- Aplica DESPUÉS de schema.sql.
--
-- Modelo de confianza:
--   • Dueños/staff (rol `authenticated`): acceso TOTAL pero SOLO a su barbería,
--     determinado por la tabla `memberships`. Cero acceso cruzado entre tenants.
--   • Clientes (rol `anon`): NO tocan tablas directamente. Solo pueden:
--       - leer datos públicos (barberías, servicios y barberos activos),
--       - ver horarios ocupados (sin PII) por la vista `busy_slots`,
--       - reservar llamando a la función `book_appointment` (SECURITY DEFINER).
--   • La llave `service_role` (solo backend) salta RLS — trátala como secreto.
-- ============================================================================

-- ---- Helper: ¿el usuario actual es miembro de esta barbería? ---------------
-- SECURITY DEFINER para poder leer `memberships` sin recursión de RLS.
create or replace function app_is_member(shop uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from memberships m
    where m.barbershop_id = shop and m.user_id = auth.uid()
  );
$$;

-- ---- Activar RLS en todo (deny-by-default) --------------------------------
alter table barbershops    enable row level security;
alter table memberships    enable row level security;
alter table barbers        enable row level security;
alter table services       enable row level security;
alter table barber_services enable row level security;
alter table clients        enable row level security;
alter table appointments   enable row level security;
alter table domains        enable row level security;
alter table invitations    enable row level security;
alter table subscriptions  enable row level security;
alter table notifications_log enable row level security;

-- ---- barbershops ----------------------------------------------------------
create policy barbershops_public_read on barbershops
  for select using (true);                            -- directorio público
create policy barbershops_member_write on barbershops
  for update using (app_is_member(id)) with check (app_is_member(id));

-- ---- memberships ----------------------------------------------------------
create policy memberships_self_read on memberships
  for select using (user_id = auth.uid() or app_is_member(barbershop_id));
-- alta/baja de staff: gestionar con service_role o un panel de owner dedicado.

-- ---- barbers (lectura pública de activos; escritura solo miembros) ---------
create policy barbers_public_read on barbers
  for select using (active or app_is_member(barbershop_id));
create policy barbers_member_write on barbers
  for all using (app_is_member(barbershop_id)) with check (app_is_member(barbershop_id));

-- ---- services -------------------------------------------------------------
create policy services_public_read on services
  for select using (active or app_is_member(barbershop_id));
create policy services_member_write on services
  for all using (app_is_member(barbershop_id)) with check (app_is_member(barbershop_id));

-- ---- barber_services (mapeo no sensible; lectura pública) ------------------
create policy barber_services_public_read on barber_services
  for select using (true);
create policy barber_services_member_write on barber_services
  for all using (
    exists (select 1 from barbers b where b.id = barber_id and app_is_member(b.barbershop_id))
  ) with check (
    exists (select 1 from barbers b where b.id = barber_id and app_is_member(b.barbershop_id))
  );

-- ---- clients (PII — SOLO miembros; anon NUNCA) ----------------------------
create policy clients_member_all on clients
  for all using (app_is_member(barbershop_id)) with check (app_is_member(barbershop_id));

-- ---- appointments (SOLO miembros; anon reserva vía RPC) --------------------
create policy appointments_member_all on appointments
  for all using (app_is_member(barbershop_id)) with check (app_is_member(barbershop_id));

-- ---- domains (gestión solo miembros; el proxy resuelve con service_role) ---
-- Lectura pública de dominios ACTIVOS: el edge/proxy puede cachear el mapa
-- host→tenant sin exponer los que aún no verifican.
create policy domains_public_read_active on domains
  for select using (status = 'activo' or app_is_member(barbershop_id));
create policy domains_member_write on domains
  for all using (app_is_member(barbershop_id)) with check (app_is_member(barbershop_id));

-- ---- invitations (solo miembros del shop; el token viaja por email) ---------
create policy invitations_member_all on invitations
  for all using (app_is_member(barbershop_id)) with check (app_is_member(barbershop_id));

-- ---- subscriptions (lectura miembros; cambios de plan via backend/billing) --
create policy subscriptions_member_read on subscriptions
  for select using (app_is_member(barbershop_id));
-- upgrades/downgrades pasan por el webhook de billing con service_role.

-- ---- notifications_log (contiene teléfonos/emails — SOLO miembros) ---------
create policy notifications_member_all on notifications_log
  for all using (app_is_member(barbershop_id)) with check (app_is_member(barbershop_id));

-- Defensa en profundidad: revoca privilegios de tabla a anon en datos sensibles.
revoke all on clients       from anon;
revoke all on appointments  from anon;
revoke all on invitations   from anon;
revoke all on subscriptions from anon;
revoke all on notifications_log from anon;

-- ---- Vista pública de horarios ocupados (sin PII) -------------------------
-- Expone SOLO barbero + rango horario para que el cliente calcule disponibilidad.
-- No revela cliente, servicio ni precio. `security_invoker=off` => salta RLS de
-- appointments a propósito, pero limitado a columnas no sensibles.
create or replace view busy_slots with (security_invoker = off) as
  select barbershop_id, barber_id, starts_at, ends_at
  from appointments
  where status in ('pendiente','confirmada','completada');
grant select on busy_slots to anon, authenticated;

-- ---- Reserva segura (única vía de escritura para anon) --------------------
-- Valida todo del lado servidor, hace upsert del cliente y crea la cita. La
-- restricción de exclusión (schema.sql) es el seguro final contra doble reserva.
create or replace function book_appointment(
  p_shop    uuid,
  p_service uuid,
  p_barber  uuid,            -- null => "cualquiera disponible"
  p_start   timestamptz,
  p_name    text,
  p_phone   text,
  p_email   text default null,
  p_notes   text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_dur int; v_price int; v_end timestamptz; v_barber uuid; v_client uuid; v_appt uuid;
  v_shop record; v_svc_name text; v_barber_name text; v_when text;
begin
  -- 0) Saneo básico (el app valida también; esto es belt-and-suspenders).
  if char_length(coalesce(p_name,'')) not between 2 and 80 then
    raise exception 'Nombre inválido'; end if;
  if char_length(coalesce(p_phone,'')) not between 8 and 20 then
    raise exception 'Teléfono inválido'; end if;
  if p_start <= now() then raise exception 'El horario ya pasó'; end if;

  -- 1) Servicio válido y de esta barbería.
  select duration_min, price_cents, name into v_dur, v_price, v_svc_name
  from services where id = p_service and barbershop_id = p_shop and active;
  if v_dur is null then raise exception 'Servicio inválido'; end if;
  v_end := p_start + make_interval(mins => v_dur);

  select * into v_shop from barbershops where id = p_shop;
  if not found then raise exception 'Barbería inválida'; end if;

  -- 2) Elegir barbero (el indicado, o el primero libre que haga el servicio).
  if p_barber is not null then
    if not exists (
      select 1 from barber_services bs join barbers b on b.id = bs.barber_id
      where bs.barber_id = p_barber and bs.service_id = p_service
        and b.active and b.barbershop_id = p_shop
    ) then raise exception 'Barbero inválido'; end if;
    v_barber := p_barber;
  else
    select b.id into v_barber
    from barbers b join barber_services bs on bs.barber_id = b.id
    where b.barbershop_id = p_shop and b.active and bs.service_id = p_service
      and not exists (
        select 1 from appointments a
        where a.barber_id = b.id
          and a.status in ('pendiente','confirmada','completada')
          and tstzrange(a.starts_at, a.ends_at) && tstzrange(p_start, v_end)
      )
    order by random() limit 1;
    if v_barber is null then raise exception 'Sin disponibilidad'; end if;
  end if;

  -- 3) Upsert del cliente por (barbería, teléfono).
  insert into clients (barbershop_id, name, phone, email, notes)
  values (p_shop, p_name, p_phone, nullif(p_email,''), nullif(p_notes,''))
  on conflict (barbershop_id, phone) do update set name = excluded.name
  returning id into v_client;

  -- 4) Crear la cita (la exclusion constraint bloquea el doble booking en carrera).
  --    auto_confirm (regla de reserva del dueño) decide el estado inicial.
  insert into appointments
    (barbershop_id, barber_id, service_id, client_id, starts_at, ends_at, status, price_cents, notes)
  values
    (p_shop, v_barber, p_service, v_client, p_start, v_end,
     case when v_shop.auto_confirm then 'confirmada'::appointment_status
          else 'pendiente'::appointment_status end,
     v_price, nullif(p_notes,''))
  returning id into v_appt;

  -- 5) Registrar notificaciones salientes (mismo commit que la cita).
  select name into v_barber_name from barbers where id = v_barber;
  v_when := to_char(p_start at time zone v_shop.timezone, 'DD/MM/YYYY HH24:MI');

  if v_shop.notif_owner_new_booking and coalesce(v_shop.notif_owner_phone,'') <> '' then
    insert into notifications_log
      (barbershop_id, appointment_id, channel, audience, recipient, subject, body)
    values
      (p_shop, v_appt, 'whatsapp', 'dueno', v_shop.notif_owner_phone,
       'Nueva reserva: ' || p_name,
       p_name || ' reservó ' || v_svc_name || ' con ' || v_barber_name ||
       ' el ' || v_when || '. Tel: ' || p_phone);
  end if;

  if v_shop.notif_confirmation_email and coalesce(p_email,'') <> '' then
    insert into notifications_log
      (barbershop_id, appointment_id, channel, audience, recipient, subject, body)
    values
      (p_shop, v_appt, 'email', 'cliente', p_email,
       'Tu reserva en ' || v_shop.name,
       'Hola ' || p_name || ', tu cita de ' || v_svc_name || ' con ' || v_barber_name ||
       ' quedó agendada para el ' || v_when || '.');
  end if;

  return v_appt;
exception
  when exclusion_violation then raise exception 'Ese horario acaba de ocuparse';
end $$;

-- Solo exponer la RPC (no las tablas) a clientes anónimos.
revoke all on function book_appointment(uuid,uuid,uuid,timestamptz,text,text,text,text) from public;
grant execute on function book_appointment(uuid,uuid,uuid,timestamptz,text,text,text,text)
  to anon, authenticated;
