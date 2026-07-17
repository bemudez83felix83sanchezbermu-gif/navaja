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
alter table payment_accounts enable row level security;
alter table payments        enable row level security;

-- ---- barbershops ----------------------------------------------------------
create policy barbershops_public_read on barbershops
  for select using (true);                            -- directorio público
create policy barbershops_member_write on barbershops
  for update using (app_is_member(id)) with check (app_is_member(id));
-- RLS filtra FILAS, no columnas: la política pública expondría también los
-- datos personales del dueño (owner_name, owner_email, notif_owner_phone).
-- Privilegios de columna: anon/authenticated solo ven directorio público +
-- reglas de reserva; owner_* y notif_* se leen únicamente con service_role.
revoke select on barbershops from anon, authenticated;
grant select (
  id, slug, name, tagline, address, phone, timezone,
  open_days, open_hour, close_hour,
  slot_step_min, min_notice_min, max_advance_days,
  auto_confirm, cancel_window_hours, allow_barber_choice, require_email,
  payment_mode, payment_deposit_cents, payment_percent,
  rating, reviews, created_at
) on barbershops to anon, authenticated;

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

-- ---- payment_accounts (tokens MP cifrados — lo MÁS sensible del esquema) ----
-- Lectura: miembros, y SOLO columnas de estado (nunca *_enc; privilegios de
-- columna, mismo patrón que barbershops). Escrituras: únicamente service_role
-- (callback OAuth y renovación de tokens) — sin política de escritura a
-- propósito. anon: cero acceso.
create policy payment_accounts_member_read on payment_accounts
  for select using (app_is_member(barbershop_id));
revoke all on payment_accounts from anon, authenticated;
grant select (id, barbershop_id, mp_user_id, token_expires_at, live_mode,
              status, created_at, updated_at)
  on payment_accounts to authenticated;

-- ---- payments (auditoría de cobros — lectura solo miembros) -----------------
-- Inserta el webhook de MP vía RPC/service_role; nadie más escribe.
create policy payments_member_read on payments
  for select using (app_is_member(barbershop_id));

-- Defensa en profundidad: revoca privilegios de tabla a anon en datos sensibles.
revoke all on clients       from anon;
revoke all on appointments  from anon;
revoke all on invitations   from anon;
revoke all on subscriptions from anon;
revoke all on notifications_log from anon;
revoke all on payments      from anon;

-- ---- Vista pública de horarios ocupados (sin PII) -------------------------
-- Expone SOLO barbero + rango horario para que el cliente calcule disponibilidad.
-- No revela cliente, servicio ni precio. `security_invoker=off` => salta RLS de
-- appointments a propósito, pero limitado a columnas no sensibles.
create or replace view busy_slots with (security_invoker = off) as
  select barbershop_id, barber_id, starts_at, ends_at
  from appointments
  -- 'pendiente_pago' ocupa el slot mientras dura el hold de pago (sigue sin PII).
  where status in ('pendiente','confirmada','completada','pendiente_pago');
grant select on busy_slots to anon, authenticated;

-- ---- Reserva segura (única vía de escritura para anon) --------------------
-- Valida todo del lado servidor, hace upsert del cliente y crea la cita. La
-- restricción de exclusión (schema.sql) es el seguro final contra doble reserva.
--
-- v2 (Track A de PAGOS.md): si la barbería tiene payment_mode <> 'off' Y una
-- cuenta MP activa, la cita nace en 'pendiente_pago' con hold de 15 min y las
-- notificaciones se retrasan hasta que el webhook confirme el pago. El monto a
-- cobrar se calcula server-side (no viene del cliente).
--
-- ⚠️ El tipo de retorno cambió (uuid → jsonb), por eso `drop function` primero:
-- `create or replace` NO permite cambiar el retorno. Sin re-aplicar el
-- revoke/grant, el wizard público falla en silencio.
drop function if exists book_appointment(uuid,uuid,uuid,timestamptz,text,text,text,text);
create function book_appointment(
  p_shop    uuid,
  p_service uuid,
  p_barber  uuid,            -- null => "cualquiera disponible"
  p_start   timestamptz,
  p_name    text,
  p_phone   text,
  p_email   text default null,
  p_notes   text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_dur int; v_price int; v_end timestamptz; v_barber uuid; v_client uuid; v_appt uuid;
  v_shop record; v_svc_name text; v_barber_name text; v_when text;
  v_has_mp_account boolean := false;
  v_pay_due int; v_pay_expires timestamptz;
  v_appt_status appointment_status;
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

  -- 2) ¿Se cobra anticipo? Solo con modo <> 'off' Y cuenta MP activa. Sin
  --    cuenta conectada, `payment_mode` de la barbería NO surte efecto
  --    (default seguro: la cita nace como siempre).
  select exists (
    select 1 from payment_accounts
    where barbershop_id = p_shop and status = 'activa'
  ) into v_has_mp_account;

  if v_shop.payment_mode <> 'off' and v_has_mp_account then
    v_pay_due := case v_shop.payment_mode
      when 'anticipo_fijo' then v_shop.payment_deposit_cents
      when 'porcentaje'    then greatest(1, round(v_price * v_shop.payment_percent / 100.0)::int)
      when 'total'         then v_price
      else 0
    end;
    v_pay_expires := now() + interval '15 minutes';
    v_appt_status := 'pendiente_pago';
  else
    -- Sin pago: auto_confirm decide (comportamiento original).
    v_appt_status := case when v_shop.auto_confirm then 'confirmada'::appointment_status
                          else 'pendiente'::appointment_status end;
  end if;

  -- 3) Elegir barbero (el indicado, o el primero libre que haga el servicio).
  --    'pendiente_pago' cuenta como slot ocupado — el hold bloquea igual.
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
          and a.status in ('pendiente','confirmada','completada','pendiente_pago')
          and tstzrange(a.starts_at, a.ends_at) && tstzrange(p_start, v_end)
      )
    order by random() limit 1;
    if v_barber is null then raise exception 'Sin disponibilidad'; end if;
  end if;

  -- 4) Upsert del cliente por (barbería, teléfono).
  insert into clients (barbershop_id, name, phone, email, notes)
  values (p_shop, p_name, p_phone, nullif(p_email,''), nullif(p_notes,''))
  on conflict (barbershop_id, phone) do update set name = excluded.name
  returning id into v_client;

  -- 5) Crear la cita (la exclusion constraint bloquea el doble booking en carrera).
  insert into appointments
    (barbershop_id, barber_id, service_id, client_id, starts_at, ends_at,
     status, price_cents, notes, payment_expires_at)
  values
    (p_shop, v_barber, p_service, v_client, p_start, v_end,
     v_appt_status, v_price, nullif(p_notes,''),
     case when v_appt_status = 'pendiente_pago' then v_pay_expires else null end)
  returning id into v_appt;

  -- 6) Notificaciones: SOLO si la cita ya quedó firme. Con hold de pago las
  --    manda confirm_paid_appointment cuando el webhook confirme (evita
  --    avisar de citas que van a expirar sin pago).
  if v_appt_status <> 'pendiente_pago' then
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
  end if;

  -- Payload compacto: sin pago → id + payment_due null. Con pago → monto,
  -- expiración y nombre del servicio (para el título de la preferencia MP —
  -- se calcula acá y no en el action para evitar otra query).
  return jsonb_build_object(
    'id', v_appt,
    'payment_due_cents',   case when v_appt_status = 'pendiente_pago' then v_pay_due end,
    'payment_expires_at',  case when v_appt_status = 'pendiente_pago' then v_pay_expires end,
    'service_name',        case when v_appt_status = 'pendiente_pago' then v_svc_name end
  );
exception
  when exclusion_violation then raise exception 'Ese horario acaba de ocuparse';
end $$;

-- Solo exponer la RPC (no las tablas) a clientes anónimos.
revoke all on function book_appointment(uuid,uuid,uuid,timestamptz,text,text,text,text) from public;
grant execute on function book_appointment(uuid,uuid,uuid,timestamptz,text,text,text,text)
  to anon, authenticated;

-- ---- Confirmar cita por webhook de pago aprobado (Track A) ------------------
-- Llamada por el webhook de Mercado Pago con service_role, en un solo commit:
--   1) inserta el payment (idempotente por mp_payment_id unique — MP reintenta)
--   2) mueve la cita de 'pendiente_pago' → 'confirmada' de forma condicional
--   3) inserta las notificaciones (dueño + cliente) que book_appointment se
--      saltó por venir con hold de pago
-- La transición condicional evita la carrera cancela-vs-confirma: si el hold
-- ya expiró (pg_cron marcó cancelada) o el dueño canceló, no revivimos la
-- cita — el caller (webhook) detecta 'race_conflict' y dispara un refund.
create or replace function confirm_paid_appointment(
  p_appt_id      uuid,
  p_mp_payment_id text,
  p_amount_cents int,
  p_raw          jsonb default null
) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_shop_id uuid; v_shop_row barbershops%rowtype;
  v_client_name text; v_client_email text; v_client_phone text;
  v_svc_name text; v_barber_name text; v_when text; v_prev appointment_status;
  v_pay_inserted uuid;
begin
  -- 1) Insert idempotente del pago. Si ya existía (webhook reintentado),
  --    salimos sin hacer nada — éxito idempotente.
  insert into payments (barbershop_id, appointment_id, mp_payment_id,
                        amount_cents, status, raw)
  select a.barbershop_id, a.id, p_mp_payment_id, p_amount_cents, 'aprobado', p_raw
  from appointments a where a.id = p_appt_id
  on conflict (mp_payment_id) do nothing
  returning id into v_pay_inserted;

  if v_pay_inserted is null then
    return 'already_processed';
  end if;

  -- 2) Transición atómica. Cero filas = perdimos la carrera (hold expirado o
  --    cancelación manual) → el caller reembolsa; el payment queda registrado
  --    para auditoría y refund posterior.
  update appointments
     set status = 'confirmada', payment_expires_at = null
   where id = p_appt_id and status = 'pendiente_pago'
   returning barbershop_id into v_shop_id;

  if v_shop_id is null then
    select status into v_prev from appointments where id = p_appt_id;
    if v_prev = 'confirmada' then return 'already_confirmed'; end if;
    return 'race_conflict';
  end if;

  -- 3) Notificaciones (equivalente a las que book_appointment omitió).
  select * into v_shop_row from barbershops where id = v_shop_id;
  select c.name, c.email, c.phone
    into v_client_name, v_client_email, v_client_phone
    from appointments a join clients c on c.id = a.client_id
   where a.id = p_appt_id;
  select s.name, b.name into v_svc_name, v_barber_name
    from appointments a
    join services s on s.id = a.service_id
    join barbers  b on b.id = a.barber_id
   where a.id = p_appt_id;
  select to_char(a.starts_at at time zone v_shop_row.timezone, 'DD/MM/YYYY HH24:MI')
    into v_when from appointments a where a.id = p_appt_id;

  if v_shop_row.notif_owner_new_booking and coalesce(v_shop_row.notif_owner_phone,'') <> '' then
    insert into notifications_log
      (barbershop_id, appointment_id, channel, audience, recipient, subject, body)
    values
      (v_shop_id, p_appt_id, 'whatsapp', 'dueno', v_shop_row.notif_owner_phone,
       'Nueva reserva pagada: ' || v_client_name,
       v_client_name || ' pagó ' || v_svc_name || ' con ' || v_barber_name ||
       ' el ' || v_when || '. Tel: ' || v_client_phone ||
       '. Anticipo: $' || trim(to_char(p_amount_cents / 100.0, 'FM999999990.00')) || ' MXN');
  end if;

  if v_shop_row.notif_confirmation_email and coalesce(v_client_email,'') <> '' then
    insert into notifications_log
      (barbershop_id, appointment_id, channel, audience, recipient, subject, body)
    values
      (v_shop_id, p_appt_id, 'email', 'cliente', v_client_email,
       'Tu reserva en ' || v_shop_row.name,
       'Hola ' || v_client_name || ', tu cita de ' || v_svc_name || ' con ' ||
       v_barber_name || ' quedó confirmada para el ' || v_when ||
       '. Anticipo recibido: $' ||
       trim(to_char(p_amount_cents / 100.0, 'FM999999990.00')) || ' MXN.');
  end if;

  return 'confirmed';
end $$;

-- Solo el backend (service_role) llama esta función; no se expone a anon/authenticated.
revoke all on function confirm_paid_appointment(uuid, text, int, jsonb) from public;
