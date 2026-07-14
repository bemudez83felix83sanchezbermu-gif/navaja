import {
  Banknote,
  CalendarCheck,
  Plus,
  Percent,
  UserX,
  ArrowRight,
  Clock,
} from "lucide-react";
import {
  SHOP,
  BARBERS,
  appointmentsOn,
  appointmentsInRange,
  kpisForToday,
  startOfDay,
  addDays,
} from "@/lib/data/mock";
import { PageShell, PageHeader } from "@/components/dashboard/PageHeader";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { AppointmentRow } from "@/components/dashboard/AppointmentRow";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { formatPrice } from "@/lib/utils";

export default function OverviewPage() {
  const now = new Date();
  const today = startOfDay(now);
  const todays = appointmentsOn(today);
  const kpis = kpisForToday();

  const hour = now.getHours();
  const greeting = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";

  // next upcoming (today + following open days), max 5
  const upcoming = appointmentsInRange(now, addDays(today, 8))
    .filter((a) => a.status === "confirmada" || a.status === "pendiente")
    .slice(0, 5);

  const workMin = (SHOP.closeHour - SHOP.openHour) * 60;
  const team = BARBERS.filter((b) => b.active).map((b) => {
    const list = todays.filter(
      (a) => a.barberId === b.id && a.status !== "cancelada",
    );
    const booked = list.reduce(
      (s, a) => s + (a.end.getTime() - a.start.getTime()) / 60000,
      0,
    );
    return { barber: b, count: list.length, pct: Math.min(100, Math.round((booked / workMin) * 100)) };
  });

  return (
    <PageShell>
      <PageHeader
        title={`${greeting}, Marco`}
        subtitle={`Esto es lo que tienes hoy en ${SHOP.name}.`}
        actions={
          <ButtonLink href="/el-filo" size="md">
            <Plus className="h-4 w-4" />
            Nueva cita
          </ButtonLink>
        }
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={CalendarCheck}
          label="Citas hoy"
          value={String(kpis.todayCount)}
          hint={`${kpis.upcomingCount} aún por venir`}
          trend={{ value: "+12%", up: true }}
        />
        <KpiCard
          icon={Banknote}
          label="Ingresos del día"
          value={formatPrice(kpis.revenueTodayCents)}
          hint="Confirmado + completado"
          trend={{ value: "+8%", up: true }}
        />
        <KpiCard
          icon={Percent}
          label="Ocupación"
          value={`${kpis.occupancyPct}%`}
          hint="De las sillas activas"
          trend={{ value: "+5%", up: true }}
        />
        <KpiCard
          icon={UserX}
          label="Inasistencias"
          value={`${kpis.noShowRatePct}%`}
          hint="Esta semana"
          trend={{ value: "-3%", up: false }}
        />
      </div>

      {/* Main grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Today's agenda */}
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Agenda de hoy</CardTitle>
            <ButtonLink
              href="/dashboard/agenda"
              variant="ghost"
              size="sm"
              className="text-stone-500"
            >
              Ver agenda completa <ArrowRight className="h-3.5 w-3.5" />
            </ButtonLink>
          </CardHeader>
          <div className="mt-2 divide-y divide-stone-100">
            {todays.length > 0 ? (
              todays.map((a) => <AppointmentRow key={a.id} appt={a} />)
            ) : (
              <EmptyDay />
            )}
          </div>
        </Card>

        {/* Right column */}
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Próximas citas</CardTitle>
              <Clock className="h-4 w-4 text-stone-400" />
            </CardHeader>
            <div className="mt-2 divide-y divide-stone-100">
              {upcoming.length > 0 ? (
                upcoming.map((a) => (
                  <AppointmentRow key={a.id} appt={a} showStatus={false} showPrice={false} />
                ))
              ) : (
                <p className="px-4 py-8 text-center text-sm text-stone-400">
                  Nada por ahora.
                </p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tu equipo hoy</CardTitle>
            </CardHeader>
            <div className="space-y-4 p-5 pt-4">
              {team.map(({ barber, count, pct }) => (
                <div key={barber.id} className="flex items-center gap-3">
                  <Avatar name={barber.name} accent={barber.accent} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-sm font-semibold text-ink">
                        {barber.name}
                      </p>
                      <p className="text-xs text-stone-500">
                        <span className="tnum font-semibold text-ink">{count}</span> citas
                      </p>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: barber.accent }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

function EmptyDay() {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-stone-100 text-stone-400">
        <CalendarCheck className="h-6 w-6" />
      </span>
      <p className="mt-4 font-semibold text-ink">Sin citas hoy</p>
      <p className="mt-1 text-sm text-stone-500">
        Comparte tu página de reservas para empezar a llenar la agenda.
      </p>
      <ButtonLink href="/el-filo" variant="outline" size="sm" className="mt-4">
        Ver página de reservas
      </ButtonLink>
    </div>
  );
}
