import { SHOP } from "./mock";
import type {
  Barbershop,
  BookingRules,
  Invoice,
  Member,
  NotificationSettings,
  Plan,
  PlanId,
  ShopDomain,
  Subscription,
} from "./types";

/**
 * Mutable settings store (mock persistence).
 *
 * The rest of the data layer is read-only seed data; this module holds the
 * state the owner can EDIT from the dashboard. It lives on `globalThis` so
 * mutations survive HMR in dev and are shared across server components and
 * Server Actions within one server process.
 *
 * Swap for Supabase later: each getter becomes a SELECT, each mutation an
 * UPDATE/INSERT under the shop's RLS policy. Shapes already match schema.sql.
 */

export const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "navaja.app";

export const PLANS: Plan[] = [
  {
    id: "esencial",
    name: "Esencial",
    priceCents: 24900,
    maxBarbers: 2,
    maxAppointmentsPerMonth: 200,
    customDomain: false,
    whatsapp: false,
    highlights: [
      "Agenda y reservas ilimitadas por web",
      "Hasta 2 barberos",
      "Subdominio incluido",
      "Recordatorios por email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceCents: 49900,
    maxBarbers: 8,
    maxAppointmentsPerMonth: 1000,
    customDomain: true,
    whatsapp: true,
    highlights: [
      "Todo lo de Esencial",
      "Hasta 8 barberos",
      "Dominio propio con SSL automático",
      "Recordatorios por WhatsApp",
      "Reportes de ocupación y no-shows",
    ],
  },
  {
    id: "estudio",
    name: "Estudio",
    priceCents: 89900,
    maxBarbers: 20,
    maxAppointmentsPerMonth: 5000,
    customDomain: true,
    whatsapp: true,
    highlights: [
      "Todo lo de Pro",
      "Hasta 20 barberos y multi-sucursal",
      "Roles y permisos avanzados",
      "Soporte prioritario",
    ],
  },
];

interface SettingsState {
  bookingRules: BookingRules;
  notifications: NotificationSettings;
  domains: ShopDomain[];
  members: Member[];
  subscription: Subscription;
  invoices: Invoice[];
}

function seed(): SettingsState {
  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const monthsAgo = (n: number) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() - n);
    return d;
  };
  const inDays = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d;
  };

  return {
    bookingRules: {
      slotStepMin: 15,
      minNoticeMin: 60,
      maxAdvanceDays: 30,
      autoConfirm: false,
      cancellationWindowHours: 3,
      allowBarberChoice: true,
      requireEmail: false,
    },
    notifications: {
      confirmationEmail: true,
      reminder24h: true,
      reminder2h: false,
      whatsappChannel: true,
      ownerNewBookingEmail: true,
      senderName: SHOP.name,
    },
    domains: [
      {
        id: "dom_sub",
        barbershopId: SHOP.id,
        domain: `${SHOP.slug}.${ROOT_DOMAIN}`,
        kind: "subdominio",
        isPrimary: true,
        status: "activo",
        verifiedAt: iso(monthsAgo(1)),
      },
    ],
    members: [
      {
        id: "mem_marco",
        barbershopId: SHOP.id,
        name: "Marco Salinas",
        email: "marco@elfilo.mx",
        role: "owner",
        status: "activo",
        since: iso(monthsAgo(6)),
      },
      {
        id: "mem_ivan",
        barbershopId: SHOP.id,
        name: "Iván Ortega",
        email: "ivan@elfilo.mx",
        role: "staff",
        status: "activo",
        since: iso(monthsAgo(4)),
      },
    ],
    subscription: {
      barbershopId: SHOP.id,
      planId: "pro",
      status: "activa",
      renewsAt: iso(inDays(17)),
      startedAt: iso(monthsAgo(3)),
    },
    invoices: [1, 2, 3].map((n) => ({
      id: `NV-${(2026_00 + n).toString()}`,
      date: iso(monthsAgo(n)),
      amountCents: 49900,
      status: "pagada" as const,
    })),
  };
}

/** globalThis-backed singleton so dev HMR doesn't wipe edits. */
const g = globalThis as typeof globalThis & { __navajaSettings?: SettingsState };
function state(): SettingsState {
  g.__navajaSettings ??= seed();
  return g.__navajaSettings;
}

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */
export const getShop = (): Barbershop => SHOP;
export const getBookingRules = (): BookingRules => state().bookingRules;
export const getNotifications = (): NotificationSettings => state().notifications;
export const getDomains = (): ShopDomain[] => state().domains;
export const getMembers = (): Member[] => state().members;
export const getSubscription = (): Subscription => state().subscription;
export const getInvoices = (): Invoice[] => state().invoices;
export const getPlan = (): Plan =>
  PLANS.find((p) => p.id === state().subscription.planId) ?? PLANS[1];

/** All hostnames that resolve to a tenant — consumed by the proxy. */
export function domainMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const d of state().domains) {
    if (d.status === "activo") map[d.domain.toLowerCase()] = SHOP.slug;
  }
  // The managed subdomain always resolves, even mid-edit.
  map[`${SHOP.slug}.${ROOT_DOMAIN}`.toLowerCase()] = SHOP.slug;
  return map;
}

/* ------------------------------------------------------------------ *
 * Mutations (called only from validated Server Actions)
 * ------------------------------------------------------------------ */
export function updateShopProfile(patch: Partial<Barbershop>) {
  Object.assign(SHOP, patch);
}

/** Changing the slug also renames the managed subdomain. */
export function updateSlug(slug: string) {
  SHOP.slug = slug;
  const sub = state().domains.find((d) => d.kind === "subdominio");
  if (sub) sub.domain = `${slug}.${ROOT_DOMAIN}`;
}

export function updateBookingRules(patch: Partial<BookingRules>) {
  Object.assign(state().bookingRules, patch);
}

export function updateNotifications(patch: Partial<NotificationSettings>) {
  Object.assign(state().notifications, patch);
}

export function addCustomDomain(domain: string): ShopDomain {
  const d: ShopDomain = {
    id: `dom_${crypto.randomUUID().slice(0, 8)}`,
    barbershopId: SHOP.id,
    domain: domain.toLowerCase(),
    kind: "propio",
    isPrimary: false,
    status: "pendiente_dns",
  };
  state().domains.push(d);
  return d;
}

/**
 * Mock verification: first call moves pendiente_dns → verificando, second
 * call activates. In production this checks the CNAME/A records and asks
 * Caddy to issue the certificate (on_demand_tls).
 */
export function verifyDomain(id: string): ShopDomain | undefined {
  const d = state().domains.find((x) => x.id === id);
  if (!d || d.kind === "subdominio") return d;
  if (d.status === "pendiente_dns") d.status = "verificando";
  else if (d.status === "verificando" || d.status === "error") {
    d.status = "activo";
    d.verifiedAt = new Date().toISOString();
    d.errorDetail = undefined;
  }
  return d;
}

export function removeDomain(id: string) {
  const s = state();
  const d = s.domains.find((x) => x.id === id);
  if (!d || d.kind === "subdominio") return; // managed subdomain is not removable
  s.domains = s.domains.filter((x) => x.id !== id);
  // never leave the shop without a primary host
  if (d.isPrimary) {
    const sub = s.domains.find((x) => x.kind === "subdominio");
    if (sub) sub.isPrimary = true;
  }
}

export function setPrimaryDomain(id: string) {
  const s = state();
  const target = s.domains.find((x) => x.id === id);
  if (!target || target.status !== "activo") return;
  for (const d of s.domains) d.isPrimary = d.id === id;
}

export function inviteMember(name: string, email: string, role: Member["role"]) {
  state().members.push({
    id: `mem_${crypto.randomUUID().slice(0, 8)}`,
    barbershopId: SHOP.id,
    name,
    email: email.toLowerCase(),
    role,
    status: "invitado",
    since: new Date().toISOString(),
  });
}

export function removeMember(id: string) {
  const s = state();
  const m = s.members.find((x) => x.id === id);
  if (!m || m.role === "owner") return; // the owner cannot remove themselves
  s.members = s.members.filter((x) => x.id !== id);
}

export function changePlan(planId: PlanId) {
  state().subscription.planId = planId;
}
