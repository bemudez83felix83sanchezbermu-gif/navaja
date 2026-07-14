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
