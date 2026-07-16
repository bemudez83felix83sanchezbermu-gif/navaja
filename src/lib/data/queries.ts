import { cache } from "react";
import { dbAdmin, dbAnon } from "@/lib/db";
import { requireMembership } from "@/lib/auth";
import { addMinutes, startOfDay, startOfWeek, addDays } from "@/lib/dates";
import { PLANS } from "./plans";
import type {
  Appointment,
  AppointmentDetailed,
  AppointmentStatus,
  Barber,
  Barbershop,
  BookingRules,
  Client,
  Invoice,
  Member,
  NotificationEntry,
  NotificationSettings,
  Plan,
  PlanId,
  Service,
  ShopDomain,
  Subscription,
  UUID,
} from "./types";

/**
 * Capa de datos real (Supabase/Postgres). Mantiene la MISMA superficie que
 * tenía el mock — la UI no sabe que ahora hay una base de datos — pero todo
 * es async y multi-tenant por diseño.
 *
 * Confianza (ver src/lib/db.ts):
 *  - lecturas/escrituras del dashboard → dbAdmin() (service_role, server-only);
 *  - disponibilidad pública → dbAnon() (RLS + vista busy_slots, cero PII).
 *
 * Tenant del dashboard: cuando una función se llama SIN slug explícito, la
 * barbería se resuelve desde la sesión (requireMembership → redirect /login
 * si no hay). Ese es el candado de autorización: ningún dato del panel sale
 * sin membresía. Las rutas públicas ([shop]) siempre pasan slug explícito.
 */

/* ------------------------------------------------------------------ *
 * Filas crudas (snake_case, como en supabase/schema.sql)
 * ------------------------------------------------------------------ */

interface ShopRow {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  timezone: string;
  open_days: number[];
  open_hour: number;
  close_hour: number;
  slot_step_min: number;
  min_notice_min: number;
  max_advance_days: number;
  auto_confirm: boolean;
  cancel_window_hours: number;
  allow_barber_choice: boolean;
  require_email: boolean;
  notif_confirmation_email: boolean;
  notif_reminder_24h: boolean;
  notif_reminder_2h: boolean;
  notif_whatsapp: boolean;
  notif_owner_new_booking: boolean;
  notif_sender_name: string | null;
  notif_owner_phone: string | null;
  owner_name: string | null;
  owner_email: string | null;
  rating: number;
  reviews: number;
  created_at: string;
}

interface BarberRow {
  id: string;
  barbershop_id: string;
  name: string;
  role: string | null;
  bio: string | null;
  specialties: string[];
  accent: string | null;
  rating: number;
  active: boolean;
  barber_services?: { service_id: string }[];
}

interface ServiceRow {
  id: string;
  barbershop_id: string;
  name: string;
  description: string | null;
  duration_min: number;
  price_cents: number;
  popular: boolean;
  active: boolean;
}

interface ClientRow {
  id: string;
  barbershop_id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  created_at: string;
  visits?: number;
  last_visit?: string | null;
}

interface ApptRow {
  id: string;
  barbershop_id: string;
  barber_id: string;
  service_id: string;
  client_id: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  price_cents: number;
  notes: string | null;
  barber?: BarberRow;
  service?: ServiceRow;
  client?: ClientRow;
}

interface DomainRow {
  id: string;
  barbershop_id: string;
  domain: string;
  is_primary: boolean;
  status: ShopDomain["status"];
  error_detail: string | null;
  verified_at: string | null;
}

/* ------------------------------------------------------------------ *
 * Mappers snake_case → dominio
 * ------------------------------------------------------------------ */

const mapShop = (r: ShopRow): Barbershop => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  tagline: r.tagline ?? "",
  address: r.address ?? "",
  phone: r.phone ?? "",
  timezone: r.timezone,
  openDays: r.open_days,
  openHour: r.open_hour,
  closeHour: r.close_hour,
  rating: Number(r.rating),
  reviews: r.reviews,
  ownerName: r.owner_name ?? undefined,
  ownerEmail: r.owner_email ?? undefined,
});

const mapRules = (r: ShopRow): BookingRules => ({
  slotStepMin: r.slot_step_min as BookingRules["slotStepMin"],
  minNoticeMin: r.min_notice_min,
  maxAdvanceDays: r.max_advance_days,
  autoConfirm: r.auto_confirm,
  cancellationWindowHours: r.cancel_window_hours,
  allowBarberChoice: r.allow_barber_choice,
  requireEmail: r.require_email,
});

const mapNotifications = (r: ShopRow): NotificationSettings => ({
  confirmationEmail: r.notif_confirmation_email,
  reminder24h: r.notif_reminder_24h,
  reminder2h: r.notif_reminder_2h,
  whatsappChannel: r.notif_whatsapp,
  ownerNewBookingEmail: r.notif_owner_new_booking,
  senderName: r.notif_sender_name ?? r.name,
  ownerPhone: r.notif_owner_phone ?? "",
});

const mapBarber = (r: BarberRow): Barber => ({
  id: r.id,
  barbershopId: r.barbershop_id,
  name: r.name,
  role: r.role ?? "",
  bio: r.bio ?? "",
  specialties: r.specialties ?? [],
  rating: Number(r.rating),
  serviceIds: (r.barber_services ?? []).map((x) => x.service_id),
  active: r.active,
  accent: r.accent ?? "#a16207",
});

const mapService = (r: ServiceRow): Service => ({
  id: r.id,
  barbershopId: r.barbershop_id,
  name: r.name,
  description: r.description ?? "",
  durationMin: r.duration_min,
  priceCents: r.price_cents,
  popular: r.popular,
  active: r.active,
});

const mapClient = (r: ClientRow): Client => ({
  id: r.id,
  barbershopId: r.barbershop_id,
  name: r.name,
  phone: r.phone,
  email: r.email ?? undefined,
  visits: r.visits ?? 0,
  lastVisit: r.last_visit ?? r.created_at,
  notes: r.notes ?? undefined,
});

const mapAppt = (r: ApptRow): Appointment => ({
  id: r.id,
  barbershopId: r.barbershop_id,
  barberId: r.barber_id,
  serviceId: r.service_id,
  clientId: r.client_id,
  startsAt: r.starts_at,
  endsAt: r.ends_at,
  status: r.status,
  priceCents: r.price_cents,
  notes: r.notes ?? undefined,
});

const mapDetailed = (r: ApptRow): AppointmentDetailed => ({
  ...mapAppt(r),
  barber: mapBarber(r.barber!),
  service: mapService(r.service!),
  client: mapClient(r.client!),
  start: new Date(r.starts_at),
  end: new Date(r.ends_at),
});

/** Lanza si Supabase devolvió error — los mensajes nunca llegan al cliente. */
function must<T>(data: T | null, error: { message: string } | null, ctx: string): T {
  if (error) throw new Error(`[db:${ctx}] ${error.message}`);
  if (data === null) throw new Error(`[db:${ctx}] sin datos`);
  return data;
}

/* ------------------------------------------------------------------ *
 * Barbería (tenant)
 * ------------------------------------------------------------------ */

/** Fila cruda por slug, deduplicada por render con React cache. */
const shopRowBySlug = cache(async (slug: string): Promise<ShopRow | null> => {
  const { data, error } = await dbAdmin()
    .from("barbershops")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`[db:shop] ${error.message}`);
  return data as ShopRow | null;
});

async function mustShopRow(slug?: string): Promise<ShopRow> {
  const s = slug ?? (await requireMembership()).slug;
  const row = await shopRowBySlug(s);
  if (!row) throw new Error(`Barbería "${s}" no existe — ¿corriste el seed?`);
  return row;
}

export async function getShop(): Promise<Barbershop> {
  return mapShop(await mustShopRow());
}

export async function getShopBySlug(slug: string): Promise<Barbershop | null> {
  const row = await shopRowBySlug(slug);
  return row ? mapShop(row) : null;
}

export async function getBookingRules(slug?: string): Promise<BookingRules> {
  return mapRules(await mustShopRow(slug));
}

export async function getNotifications(): Promise<NotificationSettings> {
  return mapNotifications(await mustShopRow());
}

/* ------------------------------------------------------------------ *
 * Catálogo: servicios y barberos
 * ------------------------------------------------------------------ */

export async function getServices(opts?: {
  includeInactive?: boolean;
  slug?: string;
}): Promise<Service[]> {
  const shop = await mustShopRow(opts?.slug);
  let q = dbAdmin()
    .from("services")
    .select("*")
    .eq("barbershop_id", shop.id)
    .order("price_cents", { ascending: true });
  if (!opts?.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  return must(data as ServiceRow[] | null, error, "services").map(mapService);
}

export async function getBarbers(opts?: {
  includeInactive?: boolean;
  slug?: string;
}): Promise<Barber[]> {
  const shop = await mustShopRow(opts?.slug);
  let q = dbAdmin()
    .from("barbers")
    .select("*, barber_services(service_id)")
    .eq("barbershop_id", shop.id)
    .order("created_at", { ascending: true });
  if (!opts?.includeInactive) q = q.eq("active", true);
  const { data, error } = await q;
  return must(data as BarberRow[] | null, error, "barbers").map(mapBarber);
}

/* ------------------------------------------------------------------ *
 * Clientes (con métricas derivadas — vista client_stats)
 * ------------------------------------------------------------------ */

export async function getClients(): Promise<Client[]> {
  const shop = await mustShopRow();
  const { data, error } = await dbAdmin()
    .from("client_stats")
    .select("*")
    .eq("barbershop_id", shop.id)
    .order("visits", { ascending: false });
  return must(data as ClientRow[] | null, error, "clients").map(mapClient);
}

/* ------------------------------------------------------------------ *
 * Citas
 * ------------------------------------------------------------------ */

const DETAIL_SELECT =
  "*, barber:barbers(*, barber_services(service_id)), service:services(*), client:clients(*)";

export async function appointmentsInRange(
  from: Date,
  to: Date,
): Promise<AppointmentDetailed[]> {
  const shop = await mustShopRow();
  const { data, error } = await dbAdmin()
    .from("appointments")
    .select(DETAIL_SELECT)
    .eq("barbershop_id", shop.id)
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString())
    .order("starts_at", { ascending: true });
  return must(data as unknown as ApptRow[] | null, error, "appointments").map(mapDetailed);
}

export async function appointmentsOn(date: Date): Promise<AppointmentDetailed[]> {
  const from = startOfDay(date);
  return appointmentsInRange(from, addDays(from, 1));
}

export async function getAppointment(id: UUID): Promise<AppointmentDetailed | null> {
  const shop = await mustShopRow(); // scoping por tenant: nunca citas ajenas
  const { data, error } = await dbAdmin()
    .from("appointments")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .eq("barbershop_id", shop.id)
    .maybeSingle();
  if (error) throw new Error(`[db:appointment] ${error.message}`);
  return data ? mapDetailed(data as unknown as ApptRow) : null;
}

export async function updateAppointmentStatus(
  id: UUID,
  status: AppointmentStatus,
): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("appointments")
    .update({ status })
    .eq("id", id)
    .eq("barbershop_id", shop.id);
  if (error) {
    // 23P01 = exclusion constraint: reabrir la cita chocaría con otra reserva.
    if (error.code === "23P01") {
      throw new Error("Ese horario ya está ocupado por otra cita del barbero.");
    }
    throw new Error(`[db:appointment.status] ${error.message}`);
  }
}

/* ------------------------------------------------------------------ *
 * KPIs del día (misma matemática que tenía el mock)
 * ------------------------------------------------------------------ */

export interface Kpis {
  todayCount: number;
  upcomingCount: number;
  revenueTodayCents: number;
  occupancyPct: number;
  newClientsWeek: number;
  noShowRatePct: number;
}

export async function kpisForToday(): Promise<Kpis> {
  const shopRow = await mustShopRow();
  const now = new Date();
  const today = startOfDay(now);
  const weekStart = startOfWeek(now);

  const [todays, week, barbers, newClients] = await Promise.all([
    appointmentsOn(today),
    appointmentsInRange(weekStart, addDays(weekStart, 7)),
    getBarbers(),
    dbAdmin()
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("barbershop_id", shopRow.id)
      .gte("created_at", weekStart.toISOString()),
  ]);

  const active = todays.filter((a) => a.status !== "cancelada");
  const revenue = todays
    .filter((a) => a.status === "completada" || a.status === "confirmada")
    .reduce((s, a) => s + a.priceCents, 0);

  const chairMinutes =
    barbers.length * (shopRow.close_hour - shopRow.open_hour) * 60;
  const bookedMinutes = active.reduce(
    (s, a) => s + (a.end.getTime() - a.start.getTime()) / 60000,
    0,
  );

  const noShows = week.filter((a) => a.status === "no_show").length;
  const finished = week.filter(
    (a) => a.status === "completada" || a.status === "no_show",
  ).length;

  return {
    todayCount: active.length,
    upcomingCount: todays.filter(
      (a) => a.start > now && (a.status === "confirmada" || a.status === "pendiente"),
    ).length,
    revenueTodayCents: revenue,
    occupancyPct: chairMinutes
      ? Math.min(100, Math.round((bookedMinutes / chairMinutes) * 100))
      : 0,
    newClientsWeek: newClients.count ?? 0,
    noShowRatePct: finished ? Math.round((noShows / finished) * 100) : 0,
  };
}

/* ------------------------------------------------------------------ *
 * Disponibilidad pública (vía anon + busy_slots — cero PII)
 * ------------------------------------------------------------------ */

export interface Slot {
  iso: string;
  label: string;
  available: boolean;
}

export async function availability(
  shopSlug: string,
  serviceId: string,
  date: Date,
  barberId: string, // "any" => cualquier barbero apto
): Promise<Slot[]> {
  const anon = dbAnon();

  // La página pública puede leer barbershops/services/barbers activos (RLS).
  const { data: shop } = await anon
    .from("barbershops")
    .select("id, open_hour, close_hour, open_days, slot_step_min, min_notice_min")
    .eq("slug", shopSlug)
    .maybeSingle();
  if (!shop) return [];

  const { data: svc } = await anon
    .from("services")
    .select("id, duration_min")
    .eq("id", serviceId)
    .eq("barbershop_id", shop.id)
    .maybeSingle();
  if (!svc) return [];

  const { data: links } = await anon
    .from("barber_services")
    .select("barber_id, barbers!inner(id, active, barbershop_id)")
    .eq("service_id", serviceId);
  const qualified = (links ?? [])
    .filter((l) => {
      const b = l.barbers as unknown as { active: boolean; barbershop_id: string };
      return b.active && b.barbershop_id === shop.id;
    })
    .map((l) => l.barber_id as string);

  const candidates =
    barberId === "any" ? qualified : qualified.filter((id) => id === barberId);
  if (candidates.length === 0) return [];

  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1);
  const { data: busy } = await anon
    .from("busy_slots")
    .select("barber_id, starts_at, ends_at")
    .eq("barbershop_id", shop.id)
    .lt("starts_at", dayEnd.toISOString())
    .gt("ends_at", dayStart.toISOString());

  const busyByBarber = new Map<string, { start: Date; end: Date }[]>();
  for (const b of busy ?? []) {
    const list = busyByBarber.get(b.barber_id) ?? [];
    list.push({ start: new Date(b.starts_at), end: new Date(b.ends_at) });
    busyByBarber.set(b.barber_id, list);
  }

  const step = shop.slot_step_min ?? 15;
  const earliest = addMinutes(new Date(), shop.min_notice_min ?? 0);
  const slots: Slot[] = [];

  for (
    let m = shop.open_hour * 60;
    m + svc.duration_min <= shop.close_hour * 60;
    m += step
  ) {
    const start = addMinutes(dayStart, m);
    const end = addMinutes(start, svc.duration_min);
    const freeBarber = candidates.some((id) => {
      const list = busyByBarber.get(id) ?? [];
      return !list.some((r) => r.start < end && r.end > start);
    });
    slots.push({
      iso: start.toISOString(),
      label: `${String(start.getHours()).padStart(2, "0")}:${String(
        start.getMinutes(),
      ).padStart(2, "0")}`,
      available: freeBarber && start > earliest,
    });
  }
  return slots;
}

/* ------------------------------------------------------------------ *
 * Mutaciones de configuración (Server Actions del dashboard)
 * ------------------------------------------------------------------ */

export async function updateShopProfile(patch: {
  name: string;
  tagline?: string;
  address?: string;
  phone: string;
  timezone: string;
  openDays: number[];
  openHour: number;
  closeHour: number;
}): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("barbershops")
    .update({
      name: patch.name,
      tagline: patch.tagline ?? "",
      address: patch.address ?? "",
      phone: patch.phone,
      timezone: patch.timezone,
      open_days: patch.openDays,
      open_hour: patch.openHour,
      close_hour: patch.closeHour,
    })
    .eq("id", shop.id);
  if (error) throw new Error(`[db:profile] ${error.message}`);
}

export async function updateSlug(slug: string): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("barbershops")
    .update({ slug })
    .eq("id", shop.id);
  if (error) {
    if (error.code === "23505") throw new Error("Ese subdominio ya está ocupado.");
    throw new Error(`[db:slug] ${error.message}`);
  }
}

export async function updateBookingRules(rules: BookingRules): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("barbershops")
    .update({
      slot_step_min: rules.slotStepMin,
      min_notice_min: rules.minNoticeMin,
      max_advance_days: rules.maxAdvanceDays,
      auto_confirm: rules.autoConfirm,
      cancel_window_hours: rules.cancellationWindowHours,
      allow_barber_choice: rules.allowBarberChoice,
      require_email: rules.requireEmail,
    })
    .eq("id", shop.id);
  if (error) throw new Error(`[db:rules] ${error.message}`);
}

export async function updateNotifications(n: NotificationSettings): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("barbershops")
    .update({
      notif_confirmation_email: n.confirmationEmail,
      notif_reminder_24h: n.reminder24h,
      notif_reminder_2h: n.reminder2h,
      notif_whatsapp: n.whatsappChannel,
      notif_owner_new_booking: n.ownerNewBookingEmail,
      notif_sender_name: n.senderName,
      notif_owner_phone: n.ownerPhone || null,
    })
    .eq("id", shop.id);
  if (error) throw new Error(`[db:notifications] ${error.message}`);
}

export async function getRecentNotifications(limit = 12): Promise<NotificationEntry[]> {
  const shop = await mustShopRow();
  const { data, error } = await dbAdmin()
    .from("notifications_log")
    .select("*")
    .eq("barbershop_id", shop.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`[db:notifications_log] ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    barbershopId: r.barbershop_id,
    appointmentId: r.appointment_id ?? undefined,
    channel: r.channel,
    audience: r.audience,
    recipient: r.recipient,
    subject: r.subject,
    body: r.body ?? undefined,
    status: r.status,
    createdAt: r.created_at,
  }));
}

/* ------------------------------------------------------------------ *
 * Dominios
 * ------------------------------------------------------------------ */

const ROOT = () => process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "navaja.app";

/** Id sintético del subdominio administrado (no es fila en la DB). */
export const SUBDOMAIN_ID = "sub";

export async function getDomains(): Promise<ShopDomain[]> {
  const shop = await mustShopRow();
  const { data, error } = await dbAdmin()
    .from("domains")
    .select("*")
    .eq("barbershop_id", shop.id)
    .order("created_at", { ascending: true });
  const rows = must(data as DomainRow[] | null, error, "domains");

  const hasCustomPrimary = rows.some((d) => d.is_primary);
  const managed: ShopDomain = {
    id: SUBDOMAIN_ID,
    barbershopId: shop.id,
    domain: `${shop.slug}.${ROOT()}`,
    kind: "subdominio",
    isPrimary: !hasCustomPrimary,
    status: "activo",
    verifiedAt: shop.created_at,
  };

  return [
    managed,
    ...rows.map(
      (d): ShopDomain => ({
        id: d.id,
        barbershopId: d.barbershop_id,
        domain: d.domain,
        kind: "propio",
        isPrimary: d.is_primary,
        status: d.status,
        verifiedAt: d.verified_at ?? undefined,
        errorDetail: d.error_detail ?? undefined,
      }),
    ),
  ];
}

export async function addCustomDomain(domain: string): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("domains")
    .insert({ barbershop_id: shop.id, domain: domain.toLowerCase() });
  if (error) {
    if (error.code === "23505") throw new Error("Ese dominio ya está agregado.");
    throw new Error(`[db:domain.add] ${error.message}`);
  }
}

/**
 * Verificación simulada (igual que el mock): primera llamada
 * pendiente_dns → verificando, segunda → activo. En producción esto consulta
 * los registros DNS y dispara el certificado de Caddy (on_demand_tls).
 */
export async function verifyDomain(id: string): Promise<ShopDomain["status"] | null> {
  const shop = await mustShopRow();
  const { data } = await dbAdmin()
    .from("domains")
    .select("id, status")
    .eq("id", id)
    .eq("barbershop_id", shop.id)
    .maybeSingle();
  if (!data) return null;

  const next =
    data.status === "pendiente_dns"
      ? "verificando"
      : data.status === "verificando" || data.status === "error"
        ? "activo"
        : data.status;

  const patch: Record<string, unknown> = { status: next, error_detail: null };
  if (next === "activo") patch.verified_at = new Date().toISOString();

  const { error } = await dbAdmin().from("domains").update(patch).eq("id", id);
  if (error) throw new Error(`[db:domain.verify] ${error.message}`);
  return next as ShopDomain["status"];
}

export async function removeDomain(id: string): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("domains")
    .delete()
    .eq("id", id)
    .eq("barbershop_id", shop.id);
  if (error) throw new Error(`[db:domain.remove] ${error.message}`);
}

export async function setPrimaryDomain(id: string): Promise<void> {
  const shop = await mustShopRow();
  // Primero limpiar el primario actual (índice único parcial lo exige).
  const { error: clearErr } = await dbAdmin()
    .from("domains")
    .update({ is_primary: false })
    .eq("barbershop_id", shop.id)
    .eq("is_primary", true);
  if (clearErr) throw new Error(`[db:domain.primary] ${clearErr.message}`);

  if (id === SUBDOMAIN_ID) return; // el subdominio es primario por omisión

  const { error } = await dbAdmin()
    .from("domains")
    .update({ is_primary: true })
    .eq("id", id)
    .eq("barbershop_id", shop.id)
    .eq("status", "activo");
  if (error) throw new Error(`[db:domain.primary] ${error.message}`);
}

/* ------------------------------------------------------------------ *
 * Equipo (dueño desde barbershops + invitaciones)
 * ------------------------------------------------------------------ */

export async function getMembers(): Promise<Member[]> {
  const shop = await mustShopRow();
  const { data, error } = await dbAdmin()
    .from("invitations")
    .select("*")
    .eq("barbershop_id", shop.id)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`[db:members] ${error.message}`);

  const owner: Member = {
    id: "owner",
    barbershopId: shop.id,
    name: shop.owner_name ?? "Propietario",
    email: shop.owner_email ?? "",
    role: "owner",
    status: "activo",
    since: shop.created_at,
  };

  return [
    owner,
    ...(data ?? []).map(
      (i): Member => ({
        id: i.id,
        barbershopId: i.barbershop_id,
        name: i.name ?? i.email,
        email: i.email,
        role: i.role,
        status: "invitado",
        since: i.created_at,
      }),
    ),
  ];
}

export async function inviteMember(
  name: string,
  email: string,
  role: Member["role"],
): Promise<void> {
  const shop = await mustShopRow();
  if (email === (shop.owner_email ?? "").toLowerCase()) {
    throw new Error("Esa persona ya tiene acceso.");
  }
  const { error } = await dbAdmin()
    .from("invitations")
    .insert({ barbershop_id: shop.id, name, email, role });
  if (error) {
    if (error.code === "23505") throw new Error("Esa persona ya tiene acceso.");
    throw new Error(`[db:invite] ${error.message}`);
  }
}

export async function removeMember(id: string): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("invitations")
    .delete()
    .eq("id", id)
    .eq("barbershop_id", shop.id);
  if (error) throw new Error(`[db:member.remove] ${error.message}`);
}

/* ------------------------------------------------------------------ *
 * Plan y facturación (billing real llegará con Stripe/Conekta)
 * ------------------------------------------------------------------ */

export async function getSubscription(): Promise<Subscription> {
  const shop = await mustShopRow();
  const { data, error } = await dbAdmin()
    .from("subscriptions")
    .select("*")
    .eq("barbershop_id", shop.id)
    .maybeSingle();
  if (error) throw new Error(`[db:subscription] ${error.message}`);
  if (!data) {
    return {
      barbershopId: shop.id,
      planId: "esencial",
      status: "activa",
      renewsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      startedAt: shop.created_at,
    };
  }
  return {
    barbershopId: data.barbershop_id,
    planId: data.plan,
    status: data.status,
    renewsAt: data.renews_at ?? new Date().toISOString(),
    startedAt: data.started_at,
  };
}

export async function getPlan(): Promise<Plan> {
  const sub = await getSubscription();
  return PLANS.find((p) => p.id === sub.planId) ?? PLANS[1];
}

export async function changePlan(planId: PlanId): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("subscriptions")
    .upsert({ barbershop_id: shop.id, plan: planId }, { onConflict: "barbershop_id" });
  if (error) throw new Error(`[db:plan] ${error.message}`);
}

/** Historial de facturas sintético a partir de la suscripción (billing mock). */
export async function getInvoices(): Promise<Invoice[]> {
  const sub = await getSubscription();
  const plan = PLANS.find((p) => p.id === sub.planId) ?? PLANS[1];
  const out: Invoice[] = [];
  for (let n = 1; n <= 3; n++) {
    const d = new Date();
    d.setMonth(d.getMonth() - n);
    out.push({
      id: `NV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`,
      date: d.toISOString(),
      amountCents: plan.priceCents,
      status: "pagada",
    });
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * CRUD de catálogo (servicios y barberos)
 * ------------------------------------------------------------------ */

export interface ServiceInput {
  name: string;
  description?: string;
  durationMin: number;
  priceCents: number;
  popular: boolean;
}

export async function createService(input: ServiceInput): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin().from("services").insert({
    barbershop_id: shop.id,
    name: input.name,
    description: input.description ?? "",
    duration_min: input.durationMin,
    price_cents: input.priceCents,
    popular: input.popular,
  });
  if (error) throw new Error(`[db:service.create] ${error.message}`);
}

export async function updateService(id: UUID, input: ServiceInput): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("services")
    .update({
      name: input.name,
      description: input.description ?? "",
      duration_min: input.durationMin,
      price_cents: input.priceCents,
      popular: input.popular,
    })
    .eq("id", id)
    .eq("barbershop_id", shop.id);
  if (error) throw new Error(`[db:service.update] ${error.message}`);
}

export async function setServiceActive(id: UUID, active: boolean): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("services")
    .update({ active })
    .eq("id", id)
    .eq("barbershop_id", shop.id);
  if (error) throw new Error(`[db:service.active] ${error.message}`);
}

/**
 * Borra el servicio; si tiene citas históricas (FK), lo desactiva en su lugar
 * para no perder el historial. Devuelve qué pasó para informar al dueño.
 */
export async function deleteService(id: UUID): Promise<"deleted" | "deactivated"> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("services")
    .delete()
    .eq("id", id)
    .eq("barbershop_id", shop.id);
  if (!error) return "deleted";
  if (error.code === "23503") {
    await setServiceActive(id, false);
    return "deactivated";
  }
  throw new Error(`[db:service.delete] ${error.message}`);
}

export interface BarberInput {
  name: string;
  role?: string;
  bio?: string;
  specialties: string[];
  accent: string;
  serviceIds: UUID[];
}

async function syncBarberServices(barberId: UUID, serviceIds: UUID[]): Promise<void> {
  const db = dbAdmin();
  const { error: delErr } = await db
    .from("barber_services")
    .delete()
    .eq("barber_id", barberId);
  if (delErr) throw new Error(`[db:barber.services] ${delErr.message}`);
  if (serviceIds.length === 0) return;
  const { error } = await db
    .from("barber_services")
    .insert(serviceIds.map((service_id) => ({ barber_id: barberId, service_id })));
  if (error) throw new Error(`[db:barber.services] ${error.message}`);
}

export async function createBarber(input: BarberInput): Promise<void> {
  const shop = await mustShopRow();
  const { data, error } = await dbAdmin()
    .from("barbers")
    .insert({
      barbershop_id: shop.id,
      name: input.name,
      role: input.role ?? "",
      bio: input.bio ?? "",
      specialties: input.specialties,
      accent: input.accent,
    })
    .select("id")
    .single();
  if (error) throw new Error(`[db:barber.create] ${error.message}`);
  await syncBarberServices(data.id, input.serviceIds);
}

export async function updateBarber(id: UUID, input: BarberInput): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("barbers")
    .update({
      name: input.name,
      role: input.role ?? "",
      bio: input.bio ?? "",
      specialties: input.specialties,
      accent: input.accent,
    })
    .eq("id", id)
    .eq("barbershop_id", shop.id);
  if (error) throw new Error(`[db:barber.update] ${error.message}`);
  await syncBarberServices(id, input.serviceIds);
}

export async function setBarberActive(id: UUID, active: boolean): Promise<void> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("barbers")
    .update({ active })
    .eq("id", id)
    .eq("barbershop_id", shop.id);
  if (error) throw new Error(`[db:barber.active] ${error.message}`);
}

export async function deleteBarber(id: UUID): Promise<"deleted" | "deactivated"> {
  const shop = await mustShopRow();
  const { error } = await dbAdmin()
    .from("barbers")
    .delete()
    .eq("id", id)
    .eq("barbershop_id", shop.id);
  if (!error) return "deleted";
  if (error.code === "23503") {
    await setBarberActive(id, false);
    return "deactivated";
  }
  throw new Error(`[db:barber.delete] ${error.message}`);
}

/* ------------------------------------------------------------------ *
 * Reservar (público — vía RPC con la llave anon, igual que en prod)
 * ------------------------------------------------------------------ */

export async function bookAppointment(input: {
  shopId: UUID;
  serviceId: UUID;
  barberId: UUID | null;
  startIso: string;
  name: string;
  phone: string;
  email?: string;
  notes?: string;
}): Promise<{ ok: true; id: UUID } | { ok: false; error: string }> {
  const { data, error } = await dbAnon().rpc("book_appointment", {
    p_shop: input.shopId,
    p_service: input.serviceId,
    p_barber: input.barberId,
    p_start: input.startIso,
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) {
    // Los RAISE EXCEPTION de la RPC son mensajes pensados para el usuario
    // (p. ej. "Ese horario acaba de ocuparse"); cualquier otro error se
    // genericiza para no filtrar internals.
    const known = [
      "Nombre inválido",
      "Teléfono inválido",
      "El horario ya pasó",
      "Servicio inválido",
      "Barbería inválida",
      "Barbero inválido",
      "Sin disponibilidad",
      "Ese horario acaba de ocuparse",
    ];
    const msg = known.find((k) => error.message.includes(k));
    return { ok: false, error: msg ?? "No pudimos completar la reserva." };
  }
  return { ok: true, id: data as UUID };
}
