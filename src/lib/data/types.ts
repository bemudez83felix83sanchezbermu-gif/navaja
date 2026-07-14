/**
 * Domain model for Navaja.
 * Shapes mirror a Supabase/Postgres multi-tenant schema so the mock layer
 * can be swapped for real queries without touching the UI.
 *
 *   barbershops 1─┬─< barbers
 *                 ├─< services
 *                 ├─< clients
 *                 └─< appointments >── barber, service, client
 */

export type UUID = string;

export type AppointmentStatus =
  | "confirmada"
  | "pendiente"
  | "completada"
  | "cancelada"
  | "no_show";

export interface Barbershop {
  id: UUID;
  slug: string;
  name: string;
  tagline: string;
  address: string;
  phone: string;
  timezone: string;
  /** 0 = Sunday … 6 = Saturday */
  openDays: number[];
  openHour: number; // 24h
  closeHour: number; // 24h
  rating: number;
  reviews: number;
}

export interface Barber {
  id: UUID;
  barbershopId: UUID;
  name: string;
  role: string;
  bio: string;
  specialties: string[];
  rating: number;
  /** services this barber performs (ids) */
  serviceIds: UUID[];
  active: boolean;
  /** brand accent used for the avatar tint */
  accent: string;
}

export interface Service {
  id: UUID;
  barbershopId: UUID;
  name: string;
  description: string;
  durationMin: number;
  /** price in cents (MXN) */
  priceCents: number;
  popular?: boolean;
}

export interface Client {
  id: UUID;
  barbershopId: UUID;
  name: string;
  phone: string;
  email?: string;
  visits: number;
  lastVisit: string; // ISO
  notes?: string;
}

export interface Appointment {
  id: UUID;
  barbershopId: UUID;
  barberId: UUID;
  serviceId: UUID;
  clientId: UUID;
  startsAt: string; // ISO
  endsAt: string; // ISO
  status: AppointmentStatus;
  priceCents: number;
  notes?: string;
}

/** Joined view used across the dashboard UI. */
export interface AppointmentDetailed extends Appointment {
  barber: Barber;
  service: Service;
  client: Client;
  start: Date;
  end: Date;
}

/* ------------------------------------------------------------------ *
 * Self-service settings (everything the owner configures on their own)
 * ------------------------------------------------------------------ */

/** Rules that shape the public booking wizard. */
export interface BookingRules {
  /** granularity of offered start times, minutes */
  slotStepMin: 15 | 20 | 30 | 60;
  /** minimum notice before a bookable slot, minutes */
  minNoticeMin: number;
  /** how far into the future clients can book, days */
  maxAdvanceDays: number;
  /** true => new bookings land as "confirmada"; false => "pendiente" */
  autoConfirm: boolean;
  /** clients may cancel up to N hours before the appointment */
  cancellationWindowHours: number;
  /** let the client pick a specific barber (vs. always auto-assign) */
  allowBarberChoice: boolean;
  /** ask for email in the booking form */
  requireEmail: boolean;
}

export interface NotificationSettings {
  /** send booking confirmation to the client */
  confirmationEmail: boolean;
  /** reminder 24h before */
  reminder24h: boolean;
  /** reminder 2h before */
  reminder2h: boolean;
  /** WhatsApp as an additional channel (besides email) */
  whatsappChannel: boolean;
  /** notify the owner on each new booking */
  ownerNewBookingEmail: boolean;
  /** sender name clients see in messages */
  senderName: string;
}

export type DomainStatus =
  | "pendiente_dns" // waiting for the owner to create the DNS records
  | "verificando"   // records seen, issuing certificate
  | "activo"        // serving traffic with TLS
  | "error";        // verification failed (wrong record, CAA, etc.)

/**
 * A hostname that resolves to this barbershop. Every shop gets
 * `{slug}.navaja.app` for free; custom domains are added here and go
 * through DNS verification before activation (Caddy on-demand TLS).
 */
export interface ShopDomain {
  id: UUID;
  barbershopId: UUID;
  /** full hostname, e.g. "barberiaelfilo.com" or "elfilo.navaja.app" */
  domain: string;
  /** subdomains of navaja.app are managed by us — no DNS steps needed */
  kind: "subdominio" | "propio";
  /** the canonical host: others 301-redirect to it */
  isPrimary: boolean;
  status: DomainStatus;
  verifiedAt?: string; // ISO
  /** human-readable reason when status === "error" */
  errorDetail?: string;
}

export type MemberRole = "owner" | "staff";
export type MemberStatus = "activo" | "invitado";

/** A user with access to this shop's dashboard (mirrors `memberships`). */
export interface Member {
  id: UUID;
  barbershopId: UUID;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  /** ISO — when they joined or were invited */
  since: string;
}

export type PlanId = "esencial" | "pro" | "estudio";

export interface Plan {
  id: PlanId;
  name: string;
  priceCents: number; // monthly, MXN
  maxBarbers: number;
  maxAppointmentsPerMonth: number;
  customDomain: boolean;
  whatsapp: boolean;
  highlights: string[];
}

export interface Subscription {
  barbershopId: UUID;
  planId: PlanId;
  status: "activa" | "prueba" | "cancelada";
  /** ISO — next renewal */
  renewsAt: string;
  startedAt: string;
}

export interface Invoice {
  id: string;
  date: string; // ISO
  amountCents: number;
  status: "pagada" | "pendiente";
}
