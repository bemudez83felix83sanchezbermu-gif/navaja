import { Phone, StickyNote } from "lucide-react";
import { getClients } from "@/lib/data/queries";
import { PageShell, PageHeader } from "@/components/dashboard/PageHeader";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { daysSince, formatDayShort, pickBySeed } from "@/lib/utils";

const ACCENTS = ["#a16207", "#0369a1", "#047857", "#7c2d12", "#6d28d9", "#b91c1c"];
const pickAccent = (seed: string) => pickBySeed(ACCENTS, seed);

export default async function ClientesPage() {
  // La vista client_stats trae visitas completadas y última visita ya calculadas.
  const clients = await getClients();

  return (
    <PageShell>
      <PageHeader
        title="Clientes"
        subtitle={`${clients.length} clientes en tu base. Se agregan solos al reservar.`}
      />

      <Card className="overflow-hidden">
        {/* table head */}
        <div className="hidden grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b border-stone-200 bg-stone-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400 sm:grid">
          <span>Cliente</span>
          <span>Visitas</span>
          <span>Última visita</span>
          <span className="w-20 text-right">Contacto</span>
        </div>

        <div className="divide-y divide-stone-100">
          {clients.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-1 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-stone-50 sm:grid-cols-[2fr_1fr_1fr_auto] sm:gap-4"
            >
              <div className="flex items-center gap-3">
                <Avatar name={c.name} accent={pickAccent(c.id)} size={40} />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
                    {c.name}
                    {c.notes && <StickyNote className="h-3.5 w-3.5 text-gold" />}
                  </p>
                  <p className="flex items-center gap-1 truncate text-xs text-stone-500">
                    <Phone className="h-3 w-3" /> {c.phone}
                  </p>
                </div>
              </div>

              <div className="text-sm text-stone-600">
                <span className="tnum font-semibold text-ink">{c.visits}</span>
                <span className="text-stone-400"> visitas</span>
              </div>

              <div className="text-sm text-stone-500">
                {c.visits > 0 ? (
                  <>
                    Hace {daysSince(c.lastVisit)} días
                    <span className="ml-1 hidden text-stone-400 md:inline">
                      ({formatDayShort(new Date(c.lastVisit))})
                    </span>
                  </>
                ) : (
                  <span className="text-stone-400">Aún sin visitas</span>
                )}
              </div>

              <div className="sm:w-20 sm:text-right">
                <a
                  href={`tel:${c.phone.replace(/\s/g, "")}`}
                  className="text-sm font-medium text-stone-500 hover:text-ink"
                >
                  Llamar
                </a>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}
