import { appointmentsInRange, getBarbers, getShop } from "./queries";
import { addDays } from "@/lib/dates";
import type { AppointmentDetailed } from "./types";

/**
 * Motor de reportes: agrega las citas de un rango en todos los cortes que
 * pinta /dashboard/reportes y que exportan los archivos Excel/PDF.
 * Una sola pasada sobre los datos — la DB entrega, aquí se agrega.
 *
 * Criterios:
 *  - "Ingresos" = citas COMPLETADAS (dinero que sí entró).
 *  - "Proyectado" = confirmadas + pendientes aún no atendidas en el rango.
 *  - Ocupación = minutos reservados (no cancelados) / minutos-silla abiertos.
 */

export interface ReportTotals {
  appointments: number;
  completed: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  noShow: number;
  revenueCents: number;
  projectedCents: number;
  avgTicketCents: number;
  uniqueClients: number;
  occupancyPct: number;
  noShowRatePct: number;
  cancelRatePct: number;
}

export interface ReportRow {
  id: string;
  name: string;
  accent?: string;
  count: number;
  revenueCents: number;
  /** participación sobre los ingresos del rango, 0–100 */
  sharePct: number;
}

export interface Report {
  fromKey: string;
  toKey: string;
  days: number;
  totals: ReportTotals;
  byService: ReportRow[];
  byBarber: ReportRow[];
  byWeekday: { label: string; count: number; revenueCents: number }[];
  byHour: { hour: number; count: number }[];
  byStatus: { status: string; label: string; count: number; pct: number }[];
  topClients: { name: string; phone: string; count: number; revenueCents: number }[];
  /** detalle plano para las hojas de export */
  rows: AppointmentDetailed[];
}

const STATUS_LABEL: Record<string, string> = {
  completada: "Completada",
  confirmada: "Confirmada",
  pendiente: "Pendiente",
  cancelada: "Cancelada",
  no_show: "No asistió",
};

const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const pad = (n: number) => String(n).padStart(2, "0");
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function buildReport(from: Date, to: Date): Promise<Report> {
  // `to` es inclusivo en la UI; la consulta usa exclusivo.
  const toExclusive = addDays(to, 1);
  const [shop, barbers, rows] = await Promise.all([
    getShop(),
    getBarbers(),
    appointmentsInRange(from, toExclusive),
  ]);

  const by = <K extends string | number>(
    keyOf: (a: AppointmentDetailed) => K,
  ): Map<K, AppointmentDetailed[]> => {
    const m = new Map<K, AppointmentDetailed[]>();
    for (const a of rows) {
      const k = keyOf(a);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return m;
  };

  const completed = rows.filter((a) => a.status === "completada");
  const revenue = completed.reduce((s, a) => s + a.priceCents, 0);
  const projected = rows
    .filter((a) => a.status === "confirmada" || a.status === "pendiente")
    .reduce((s, a) => s + a.priceCents, 0);
  const noShow = rows.filter((a) => a.status === "no_show").length;
  const cancelled = rows.filter((a) => a.status === "cancelada").length;
  const finished = completed.length + noShow;

  // Minutos-silla disponibles en el rango (días abiertos × horas × barberos).
  let openDays = 0;
  for (let d = new Date(from); d < toExclusive; d = addDays(d, 1)) {
    if (shop.openDays.includes(d.getDay())) openDays++;
  }
  const chairMinutes =
    openDays * (shop.closeHour - shop.openHour) * 60 * Math.max(1, barbers.length);
  const bookedMinutes = rows
    .filter((a) => a.status !== "cancelada")
    .reduce((s, a) => s + (a.end.getTime() - a.start.getTime()) / 60000, 0);

  const totals: ReportTotals = {
    appointments: rows.length,
    completed: completed.length,
    confirmed: rows.filter((a) => a.status === "confirmada").length,
    pending: rows.filter((a) => a.status === "pendiente").length,
    cancelled,
    noShow,
    revenueCents: revenue,
    projectedCents: projected,
    avgTicketCents: completed.length ? Math.round(revenue / completed.length) : 0,
    uniqueClients: new Set(rows.map((a) => a.clientId)).size,
    occupancyPct: chairMinutes
      ? Math.min(100, Math.round((bookedMinutes / chairMinutes) * 100))
      : 0,
    noShowRatePct: finished ? Math.round((noShow / finished) * 100) : 0,
    cancelRatePct: rows.length ? Math.round((cancelled / rows.length) * 100) : 0,
  };

  const toRows = (
    m: Map<string, AppointmentDetailed[]>,
    nameOf: (sample: AppointmentDetailed) => { name: string; accent?: string },
  ): ReportRow[] =>
    Array.from(m.entries())
      .map(([id, list]) => {
        const rev = list
          .filter((a) => a.status === "completada")
          .reduce((s, a) => s + a.priceCents, 0);
        return {
          id,
          ...nameOf(list[0]),
          count: list.length,
          revenueCents: rev,
          sharePct: revenue ? Math.round((rev / revenue) * 100) : 0,
        };
      })
      .sort((a, b) => b.revenueCents - a.revenueCents);

  const byService = toRows(by((a) => a.serviceId), (a) => ({ name: a.service.name }));
  const byBarber = toRows(by((a) => a.barberId), (a) => ({
    name: a.barber.name,
    accent: a.barber.accent,
  }));

  const weekdayMap = by((a) => (a.start.getDay() + 6) % 7); // 0 = lunes
  const byWeekday = WEEKDAYS.map((label, i) => {
    const list = weekdayMap.get(i) ?? [];
    return {
      label,
      count: list.length,
      revenueCents: list
        .filter((a) => a.status === "completada")
        .reduce((s, a) => s + a.priceCents, 0),
    };
  });

  const hourMap = by((a) => a.start.getHours());
  const byHour = Array.from({ length: shop.closeHour - shop.openHour }, (_, i) => {
    const hour = shop.openHour + i;
    return { hour, count: (hourMap.get(hour) ?? []).length };
  });

  const byStatus = (
    ["completada", "confirmada", "pendiente", "cancelada", "no_show"] as const
  ).map((status) => {
    const count = rows.filter((a) => a.status === status).length;
    return {
      status,
      label: STATUS_LABEL[status],
      count,
      pct: rows.length ? Math.round((count / rows.length) * 100) : 0,
    };
  });

  const topClients = Array.from(by((a) => a.clientId).values())
    .map((list) => ({
      name: list[0].client.name,
      phone: list[0].client.phone,
      count: list.filter((a) => a.status === "completada").length,
      revenueCents: list
        .filter((a) => a.status === "completada")
        .reduce((s, a) => s + a.priceCents, 0),
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 10);

  return {
    fromKey: dayKey(from),
    toKey: dayKey(to),
    days: Math.round((toExclusive.getTime() - from.getTime()) / 86400000),
    totals,
    byService,
    byBarber,
    byWeekday,
    byHour,
    byStatus,
    topClients,
    rows,
  };
}
