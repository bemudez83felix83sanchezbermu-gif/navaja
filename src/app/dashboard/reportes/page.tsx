import {
  Banknote,
  CalendarCheck,
  Percent,
  Receipt,
  Users,
  UserX,
} from "lucide-react";
import { buildReport } from "@/lib/data/reports";
import { addDays, fromDayKey, startOfDay } from "@/lib/dates";
import { PageShell, PageHeader } from "@/components/dashboard/PageHeader";
import { ReportRangePicker } from "@/components/dashboard/ReportRangePicker";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Reportes — todo server-rendered sobre el rango de la URL. Las "gráficas"
 * son CSS puro (barras por ancho/alto): cero JS extra y compatibles con la
 * CSP estricta. La exportación Excel/PDF vive en ./export (route handler).
 */
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const today = startOfDay(new Date());
  let from = fromDayKey(sp.from) ?? addDays(today, -29);
  let to = fromDayKey(sp.to) ?? today;
  if (to < from) [from, to] = [to, from];

  const r = await buildReport(from, to);
  const maxServiceRev = Math.max(1, ...r.byService.map((s) => s.revenueCents));
  const maxBarberRev = Math.max(1, ...r.byBarber.map((b) => b.revenueCents));
  const maxWeekday = Math.max(1, ...r.byWeekday.map((d) => d.count));
  const maxHour = Math.max(1, ...r.byHour.map((h) => h.count));

  return (
    <PageShell>
      <PageHeader
        title="Reportes"
        subtitle={`${r.days} días de operación, desglosados por servicio, barbero, día y hora.`}
      />

      <div className="mb-6">
        <ReportRangePicker fromKey={r.fromKey} toKey={r.toKey} />
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          icon={Banknote}
          label="Ingresos (completadas)"
          value={formatPrice(r.totals.revenueCents)}
          hint={`Proyectado por atender: ${formatPrice(r.totals.projectedCents)}`}
        />
        <KpiCard
          icon={CalendarCheck}
          label="Citas en el periodo"
          value={String(r.totals.appointments)}
          hint={`${r.totals.completed} completadas · ${r.totals.confirmed} confirmadas · ${r.totals.pending} pendientes`}
        />
        <KpiCard
          icon={Receipt}
          label="Ticket promedio"
          value={formatPrice(r.totals.avgTicketCents)}
          hint="Sobre citas completadas"
        />
        <KpiCard
          icon={Percent}
          label="Ocupación"
          value={`${r.totals.occupancyPct}%`}
          hint="Minutos reservados vs. sillas disponibles"
        />
        <KpiCard
          icon={Users}
          label="Clientes únicos"
          value={String(r.totals.uniqueClients)}
          hint="Atendidos o con reserva en el periodo"
        />
        <KpiCard
          icon={UserX}
          label="No-show"
          value={`${r.totals.noShowRatePct}%`}
          hint={`${r.totals.noShow} inasistencias · ${r.totals.cancelRatePct}% canceladas`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Por servicio */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Ingresos por servicio</CardTitle>
          </CardHeader>
          <div className="space-y-3 p-5">
            {r.byService.map((s) => (
              <div key={s.id}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-ink">{s.name}</span>
                  <span className="tnum shrink-0 text-stone-500">
                    {s.count} citas ·{" "}
                    <span className="font-semibold text-ink">
                      {formatPrice(s.revenueCents)}
                    </span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className="h-full rounded-full bg-gold"
                    style={{ width: `${(s.revenueCents / maxServiceRev) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {r.byService.length === 0 && <Empty />}
          </div>
        </Card>

        {/* Por barbero */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Rendimiento por barbero</CardTitle>
          </CardHeader>
          <div className="space-y-4 p-5">
            {r.byBarber.map((b) => (
              <div key={b.id} className="flex items-center gap-3">
                <Avatar name={b.name} accent={b.accent ?? "#a16207"} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-ink">{b.name}</span>
                    <span className="tnum shrink-0 text-stone-500">
                      {b.count} citas ·{" "}
                      <span className="font-semibold text-ink">
                        {formatPrice(b.revenueCents)}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(b.revenueCents / maxBarberRev) * 100}%`,
                        backgroundColor: b.accent ?? "#a16207",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {r.byBarber.length === 0 && <Empty />}
          </div>
        </Card>

        {/* Por día de la semana */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Citas por día de la semana</CardTitle>
          </CardHeader>
          <div className="flex items-end justify-between gap-2 px-5 pb-5 pt-4">
            {r.byWeekday.map((d) => (
              <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="tnum text-xs font-semibold text-ink">{d.count}</span>
                <div className="flex h-28 w-full items-end">
                  <div
                    className="w-full rounded-t-lg bg-stone-900 transition-all"
                    style={{ height: `${Math.max(4, (d.count / maxWeekday) * 100)}%` }}
                    title={`${d.label}: ${d.count} citas · ${formatPrice(d.revenueCents)}`}
                  />
                </div>
                <span className="text-[0.65rem] font-medium uppercase text-stone-400">
                  {d.label.slice(0, 3)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {/* Horas pico */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Horas pico</CardTitle>
          </CardHeader>
          <div className="px-5 pb-5 pt-4">
            <div className="flex gap-1">
              {r.byHour.map((h) => (
                <div key={h.hour} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="h-16 w-full rounded-md"
                    style={{
                      backgroundColor: `color-mix(in oklab, var(--color-gold) ${Math.round(
                        (h.count / maxHour) * 100,
                      )}%, var(--color-stone-100))`,
                    }}
                    title={`${String(h.hour).padStart(2, "0")}:00 — ${h.count} citas`}
                  />
                  <span className="tnum text-[0.6rem] font-medium text-stone-400">
                    {String(h.hour).padStart(2, "0")}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-stone-400">
              Más oscuro = más citas iniciadas en esa hora.
            </p>
          </div>
        </Card>

        {/* Estados */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Distribución por estado</CardTitle>
          </CardHeader>
          <div className="px-5 pb-5 pt-4">
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              {r.byStatus
                .filter((s) => s.count > 0)
                .map((s) => (
                  <div
                    key={s.status}
                    className={cn("h-full", STATUS_BAR[s.status])}
                    style={{ width: `${s.pct}%` }}
                    title={`${s.label}: ${s.count} (${s.pct}%)`}
                  />
                ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {r.byStatus.map((s) => (
                <span key={s.status} className="flex items-center gap-2 text-sm">
                  <span className={cn("h-2.5 w-2.5 rounded-full", STATUS_BAR[s.status])} />
                  <span className="text-stone-500">{s.label}</span>
                  <span className="tnum ml-auto font-semibold text-ink">{s.count}</span>
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* Top clientes */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Top clientes del periodo</CardTitle>
          </CardHeader>
          <div className="mt-2 divide-y divide-stone-100">
            {r.topClients.map((c, i) => (
              <div key={c.phone} className="flex items-center gap-3 px-5 py-2.5">
                <span className="tnum w-5 text-sm font-semibold text-stone-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                  <p className="tnum text-xs text-stone-400">{c.phone}</p>
                </div>
                <span className="tnum text-sm text-stone-500">{c.count} visitas</span>
                <span className="tnum w-20 text-right text-sm font-semibold text-ink">
                  {formatPrice(c.revenueCents)}
                </span>
              </div>
            ))}
            {r.topClients.length === 0 && (
              <div className="p-5">
                <Empty />
              </div>
            )}
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

const STATUS_BAR: Record<string, string> = {
  completada: "bg-success",
  confirmada: "bg-gold",
  pendiente: "bg-warning",
  cancelada: "bg-stone-300",
  no_show: "bg-destructive",
};

function Empty() {
  return (
    <p className="py-6 text-center text-sm text-stone-400">
      Sin datos en este rango de fechas.
    </p>
  );
}
