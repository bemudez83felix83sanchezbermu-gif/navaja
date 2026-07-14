import { Plus, Star, Scissors, CalendarDays } from "lucide-react";
import { BARBERS, SERVICES, appointmentsOn, startOfDay } from "@/lib/data/mock";
import { PageShell, PageHeader } from "@/components/dashboard/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

export default function BarberosPage() {
  const today = appointmentsOn(startOfDay(new Date()));

  return (
    <PageShell>
      <PageHeader
        title="Barberos"
        subtitle="Tu equipo y lo que cada uno atiende."
        actions={
          <Button size="md">
            <Plus className="h-4 w-4" /> Agregar barbero
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {BARBERS.map((b) => {
          const todayCount = today.filter(
            (a) => a.barberId === b.id && a.status !== "cancelada",
          ).length;
          const services = SERVICES.filter((s) => b.serviceIds.includes(s.id));
          return (
            <Card key={b.id} className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={b.name} accent={b.accent} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{b.name}</p>
                  <p className="text-sm text-stone-500">{b.role}</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-ink">
                  <Star className="h-3 w-3 fill-gold-400 text-gold-400" />
                  {b.rating}
                </span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-stone-500">{b.bio}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {b.specialties.map((sp) => (
                  <span
                    key={sp}
                    className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600"
                  >
                    {sp}
                  </span>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 text-sm">
                <span className="flex items-center gap-2 text-stone-500">
                  <Scissors className="h-4 w-4 text-stone-400" />
                  <span className="tnum font-semibold text-ink">{services.length}</span>{" "}
                  servicios
                </span>
                <span className="flex items-center gap-2 text-stone-500">
                  <CalendarDays className="h-4 w-4 text-stone-400" />
                  <span className="tnum font-semibold text-ink">{todayCount}</span> citas hoy
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> Activo
                </span>
                <button className="text-sm font-medium text-stone-500 hover:text-ink">
                  Ver agenda
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
