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
  /** hold de 15 min: bloquea el slot mientras el cliente paga el anticipo */
  | "pendiente_pago"
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
  /** Dueño mostrado en Configuración → Equipo (hasta que exista auth real). */
  ownerName?: string;
  ownerEmail?: string;
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
  /** inactivo = oculto en la página pública, conserva su historial */
  active: boolean;
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
  /** ISO — solo con status "pendiente_pago": cuándo expira el hold del slot */
  paymentExpiresAt?: string;
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

/* ---- Pagos (Track A de PAGOS.md: anticipos vía Mercado Pago) ------ */

export type PaymentMode = "off" | "anticipo_fijo" | "porcentaje" | "total";

/** Config de cobro de anticipos (Configuración → Pagos). Espejo de las
 *  columnas `payment_*` de barbershops; solo surte efecto con cuenta MP
 *  conectada y plan con `payments` (Pro/Estudio). */
export interface PaymentSettings {
  mode: PaymentMode;
  /** anticipo fijo en centavos MXN (modo "anticipo_fijo") */
  depositCents: number;
  /** porcentaje del precio del servicio (modo "porcentaje"), 1–100 */
  percent: number;
}

export type PaymentAccountStatus = "activa" | "error_refresh" | "desconectada";

/** Cuenta de Mercado Pago conectada por OAuth (espejo de `payment_accounts`).
 *  Los tokens cifrados NUNCA entran a este tipo: solo estado para la UI. */
export interface PaymentAccount {
  barbershopId: UUID;
  mpUserId: string;
  /** false = credenciales de sandbox */
  liveMode: boolean;
  status: PaymentAccountStatus;
  /** ISO — MP expira tokens a 180 días; renovación lazy al cobrar */
  tokenExpiresAt: string;
}

export type PaymentStatus = "aprobado" | "rechazado" | "reembolsado";

/** Anticipo cobrado, registrado por el webhook de MP (espejo de `payments`). */
export interface Payment {
  id: UUID;
  barbershopId: UUID;
  appointmentId: UUID;
  /** id del pago en MP — unique: idempotencia del webhook */
  mpPaymentId: string;
  amountCents: number;
  status: PaymentStatus;
  createdAt: string; // ISO
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
  /** WhatsApp del dueño al que llegan las reservas nuevas ("" = sin configurar) */
  ownerPhone: string;
}

/** Fila de notifications_log — el pipeline de avisos salientes. */
export interface NotificationEntry {
  id: UUID;
  barbershopId: UUID;
  appointmentId?: UUID;
  channel: "whatsapp" | "email" | "sms";
  audience: "dueno" | "cliente";
  recipient: string;
  subject: string;
  body?: string;
  status: "pendiente_envio" | "enviado" | "error";
  createdAt: string; // ISO
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
  /** cobro de anticipos con Mercado Pago (Track A) — exclusivo Pro/Estudio */
  payments: boolean;
  highlights: string[];
}

export interface Subscription {
  barbershopId: UUID;
  planId: PlanId;
  status: "activa" | "prueba" | "cancelada";
  /** ISO — next renewal */
  renewsAt: string;
  startedAt: string;
  /** Stripe Billing (Track B). null = trial app-side o modo demo sin Stripe. */
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: string | null;
}

export interface Invoice {
  id: string;
  date: string; // ISO
  amountCents: number;
  status: "pagada" | "pendiente";
  /** hosted_invoice_url de Stripe — la factura se ve/descarga allá. */
  url?: string;
}
