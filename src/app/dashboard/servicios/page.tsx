import { Clock, Plus, Pencil, Scissors } from "lucide-react";
import { SERVICES, BARBERS } from "@/lib/data/mock";
import { PageShell, PageHeader } from "@/components/dashboard/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { formatDuration, formatPrice } from "@/lib/utils";

export default function ServiciosPage() {
  return (
    <PageShell>
      <PageHeader
        title="Servicios"
        subtitle="El menú que tus clientes ven al reservar."
        actions={
          <Button size="md">
            <Plus className="h-4 w-4" /> Nuevo servicio
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SERVICES.map((s) => {
          const team = BARBERS.filter((b) => b.active && b.serviceIds.includes(s.id));
          return (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-stone-900 text-gold-400">
                  <Scissors className="h-5 w-5" />
                </span>
                <div className="flex items-center gap-2">
                  {s.popular && (
                    <span className="rounded-full bg-gold/12 px-2 py-0.5 text-xs font-semibold text-gold">
                      Popular
                    </span>
                  )}
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 text-stone-400 transition-colors hover:border-stone-400 hover:text-ink"
                    aria-label={`Editar ${s.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="mt-4 text-lg font-semibold text-ink">{s.name}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-stone-500">
                {s.description}
              </p>

              <div className="mt-4 flex items-center gap-4 border-t border-stone-100 pt-4">
                <span className="font-display text-xl font-semibold text-ink tnum">
                  {formatPrice(s.priceCents)}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-stone-500">
                  <Clock className="h-4 w-4" /> {formatDuration(s.durationMin)}
                </span>
                <div className="ml-auto flex -space-x-2">
                  {team.slice(0, 3).map((b) => (
                    <Avatar
                      key={b.id}
                      name={b.name}
                      accent={b.accent}
                      size={26}
                      className="ring-2 ring-white"
                    />
                  ))}
                  {team.length > 3 && (
                    <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-stone-100 text-[0.65rem] font-semibold text-stone-500 ring-2 ring-white">
                      +{team.length - 3}
                    </span>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
}
