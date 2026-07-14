import type {
  Appointment,
  AppointmentDetailed,
  AppointmentStatus,
  Barber,
  Barbershop,
  Client,
  Service,
} from "./types";

/* ------------------------------------------------------------------ *
 * Deterministic PRNG so server renders are stable (no hydration drift)
 * ------------------------------------------------------------------ */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ *
 * Static seed data
 * ------------------------------------------------------------------ */
export const SHOP: Barbershop = {
  id: "shop_filo",
  slug: "el-filo",
  name: "Barbería El Filo",
  tagline: "Cortes con carácter desde 2014",
  address: "Av. Reforma 124, Roma Norte, CDMX",
  phone: "+52 55 1234 5678",
  timezone: "America/Mexico_City",
  openDays: [1, 2, 3, 4, 5, 6], // Mon–Sat
  openHour: 10,
  closeHour: 20,
  rating: 4.9,
  reviews: 348,
};

export const SERVICES: Service[] = [
  { id: "svc_clasico", barbershopId: SHOP.id, name: "Corte clásico", description: "Tijera y máquina, lavado y peinado.", durationMin: 30, priceCents: 18000 },
  { id: "svc_fade", barbershopId: SHOP.id, name: "Fade / Degradado", description: "Degradado a piel con definición y diseño.", durationMin: 45, priceCents: 25000, popular: true },
  { id: "svc_barba", barbershopId: SHOP.id, name: "Perfilado de barba", description: "Diseño, toalla caliente y aceite.", durationMin: 20, priceCents: 14000 },
  { id: "svc_combo", barbershopId: SHOP.id, name: "Corte + barba", description: "El paquete completo. Corte a tu estilo y barba perfilada.", durationMin: 50, priceCents: 32000, popular: true },
  { id: "svc_navaja", barbershopId: SHOP.id, name: "Afeitado a navaja", description: "Afeitado tradicional con navaja y toallas calientes.", durationMin: 30, priceCents: 22000 },
  { id: "svc_nino", barbershopId: SHOP.id, name: "Corte infantil", description: "Para los más chicos, con paciencia y juego.", durationMin: 25, priceCents: 15000 },
];

export const BARBERS: Barber[] = [
  { id: "brb_marco", barbershopId: SHOP.id, name: "Marco Salinas", role: "Master barber", bio: "13 años perfeccionando el fade. Fundador de El Filo.", specialties: ["Fade", "Diseño", "Clásico"], rating: 4.9, serviceIds: ["svc_clasico", "svc_fade", "svc_combo", "svc_navaja"], active: true, accent: "#a16207" },
  { id: "brb_ivan", barbershopId: SHOP.id, name: "Iván Ortega", role: "Barbero senior", bio: "Especialista en barba y afeitado tradicional a navaja.", specialties: ["Barba", "Navaja", "Clásico"], rating: 4.8, serviceIds: ["svc_clasico", "svc_barba", "svc_combo", "svc_navaja"], active: true, accent: "#0369a1" },
  { id: "brb_diego", barbershopId: SHOP.id, name: "Diego Ramos", role: "Barbero", bio: "Rápido, preciso y el favorito de los más pequeños.", specialties: ["Clásico", "Infantil", "Fade"], rating: 4.7, serviceIds: ["svc_clasico", "svc_fade", "svc_nino"], active: true, accent: "#047857" },
  { id: "brb_tato", barbershopId: SHOP.id, name: "Tato Mendoza", role: "Estilista", bio: "Texturas, diseños y los degradados más limpios.", specialties: ["Fade", "Diseño", "Combo"], rating: 4.9, serviceIds: ["svc_fade", "svc_combo", "svc_barba"], active: true, accent: "#7c2d12" },
];

const CLIENT_NAMES = [
  "Andrés Vega", "Luis Fernando", "Carlos Mena", "Roberto Díaz", "Emilio Cruz",
  "Sergio Lara", "Pablo Nieto", "Héctor Ruiz", "Mateo Robles", "Iker Fonseca",
  "Joaquín Real", "Bruno Castro", "Daniel Sosa", "Ángel Prado", "Toño Beltrán",
];

export const CLIENTS: Client[] = CLIENT_NAMES.map((name, i) => ({
  id: `cli_${i}`,
  barbershopId: SHOP.id,
  name,
  phone: `+52 55 ${(2000 + i * 137).toString().padStart(4, "0")} ${(1100 + i * 311).toString().slice(0, 4)}`,
  email: `${name.split(" ")[0].toLowerCase()}@correo.com`,
  visits: 1 + ((i * 7) % 18),
  lastVisit: new Date(Date.now() - ((i * 4) % 40) * 86400000).toISOString(),
  notes: i % 5 === 0 ? "Prefiere tijera, raya marcada a la izquierda." : undefined,
}));

/* ------------------------------------------------------------------ *
 * Date helpers
 * ------------------------------------------------------------------ */
export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * 60000);
export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Monday as first day of the week. */
export const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  return addDays(x, -day);
};

/* ------------------------------------------------------------------ *
 * Appointment generation (anchored to "today")
 * ------------------------------------------------------------------ */
const byId = <T extends { id: string }>(arr: T[]) =>
  Object.fromEntries(arr.map((x) => [x.id, x])) as Record<string, T>;

const SERVICE_MAP = byId(SERVICES);
const BARBER_MAP = byId(BARBERS);
const CLIENT_MAP = byId(CLIENTS);

function buildAppointments(): Appointment[] {
  const rng = mulberry32(20260613);
  const today = startOfDay(new Date());
  const now = new Date();
  const out: Appointment[] = [];
  let counter = 0;

  for (let offset = -4; offset <= 12; offset++) {
    const day = addDays(today, offset);
    if (!SHOP.openDays.includes(day.getDay())) continue;

    for (const barber of BARBERS) {
      // walk the working day in 15-min steps
      let cursor = SHOP.openHour * 60;
      const end = SHOP.closeHour * 60;
      while (cursor < end) {
        const start = (rng() < 0.45); // density of bookings
        if (!start) {
          cursor += 15;
          continue;
        }
        const svc = barber.serviceIds[Math.floor(rng() * barber.serviceIds.length)];
        const service = SERVICE_MAP[svc];
        if (cursor + service.durationMin > end) break;

        const startsAt = addMinutes(day, cursor);
        const endsAt = addMinutes(startsAt, service.durationMin);
        const client = CLIENTS[Math.floor(rng() * CLIENTS.length)];

        let status: AppointmentStatus;
        if (endsAt < now) {
          const r = rng();
          status = r < 0.84 ? "completada" : r < 0.92 ? "no_show" : "cancelada";
        } else if (sameDay(startsAt, now)) {
          status = rng() < 0.85 ? "confirmada" : "pendiente";
        } else {
          status = rng() < 0.7 ? "confirmada" : "pendiente";
        }

        out.push({
          id: `apt_${counter++}`,
          barbershopId: SHOP.id,
          barberId: barber.id,
          serviceId: service.id,
          clientId: client.id,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          status,
          priceCents: service.priceCents,
          notes: undefined,
        });

        cursor += service.durationMin + 15 * Math.floor(rng() * 3); // gap
      }
    }
  }
  return out;
}

export const APPOINTMENTS: Appointment[] = buildAppointments();

/* ------------------------------------------------------------------ *
 * Query layer (the surface the UI consumes — swap for Supabase later)
 * ------------------------------------------------------------------ */
export function detail(a: Appointment): AppointmentDetailed {
  return {
    ...a,
    barber: BARBER_MAP[a.barberId],
    service: SERVICE_MAP[a.serviceId],
    client: CLIENT_MAP[a.clientId],
    start: new Date(a.startsAt),
    end: new Date(a.endsAt),
  };
}

const ACTIVE: AppointmentStatus[] = ["confirmada", "pendiente"];

export function appointmentsOn(date: Date): AppointmentDetailed[] {
  return APPOINTMENTS.filter((a) => sameDay(new Date(a.startsAt), date))
    .map(detail)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function appointmentsInRange(from: Date, to: Date): AppointmentDetailed[] {
  return APPOINTMENTS.filter((a) => {
    const s = new Date(a.startsAt);
    return s >= from && s < to;
  })
    .map(detail)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export interface Kpis {
  todayCount: number;
  upcomingCount: number;
  revenueTodayCents: number;
  occupancyPct: number;
  newClientsWeek: number;
  noShowRatePct: number;
}

export function kpisForToday(): Kpis {
  const today = startOfDay(new Date());
  const now = new Date();
  const todays = appointmentsOn(today);
  const active = todays.filter((a) => a.status !== "cancelada");
  const revenue = todays
    .filter((a) => a.status === "completada" || a.status === "confirmada")
    .reduce((s, a) => s + a.priceCents, 0);

  // occupancy = booked minutes / available chair-minutes today
  const chairMinutes =
    BARBERS.filter((b) => b.active).length *
    (SHOP.closeHour - SHOP.openHour) * 60;
  const bookedMinutes = active.reduce(
    (s, a) => s + (a.end.getTime() - a.start.getTime()) / 60000,
    0,
  );

  const weekStart = startOfWeek(now);
  const week = appointmentsInRange(weekStart, addDays(weekStart, 7));
  const noShows = week.filter((a) => a.status === "no_show").length;
  const finished = week.filter(
    (a) => a.status === "completada" || a.status === "no_show",
  ).length;

  return {
    todayCount: active.length,
    upcomingCount: todays.filter((a) => a.start > now && ACTIVE.includes(a.status)).length,
    revenueTodayCents: revenue,
    occupancyPct: Math.min(100, Math.round((bookedMinutes / chairMinutes) * 100)),
    newClientsWeek: 6,
    noShowRatePct: finished ? Math.round((noShows / finished) * 100) : 0,
  };
}

/* --- Booking availability ----------------------------------------- */
export interface Slot {
  iso: string;
  label: string;
  available: boolean;
}

export function getService(id: string) {
  return SERVICE_MAP[id];
}
export function getBarber(id: string) {
  return BARBER_MAP[id];
}
export function barbersForService(serviceId: string): Barber[] {
  return BARBERS.filter((b) => b.active && b.serviceIds.includes(serviceId));
}

/**
 * Available start times for a service on a date.
 * barberId === "any" => slot is free if ANY qualified barber is free.
 */
export function availability(
  serviceId: string,
  date: Date,
  barberId: string,
): Slot[] {
  const service = SERVICE_MAP[serviceId];
  if (!service) return [];
  const now = new Date();
  const candidates =
    barberId === "any" ? barbersForService(serviceId) : [BARBER_MAP[barberId]];

  const dayAppts = appointmentsOn(date).filter((a) => ACTIVE.includes(a.status));

  const slots: Slot[] = [];
  const step = 15;
  for (let m = SHOP.openHour * 60; m + service.durationMin <= SHOP.closeHour * 60; m += step) {
    const start = addMinutes(startOfDay(date), m);
    const end = addMinutes(start, service.durationMin);

    const freeBarber = candidates.some((b) => {
      const conflicts = dayAppts.some(
        (a) => a.barberId === b.id && a.start < end && a.end > start,
      );
      return !conflicts;
    });

    slots.push({
      iso: start.toISOString(),
      label: `${start.getHours().toString().padStart(2, "0")}:${start
        .getMinutes()
        .toString()
        .padStart(2, "0")}`,
      available: freeBarber && start > now,
    });
  }
  return slots;
}
