import { Plus, Phone, StickyNote } from "lucide-react";
import { CLIENTS } from "@/lib/data/mock";
import { PageShell, PageHeader } from "@/components/dashboard/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { formatDayShort, pickBySeed } from "@/lib/utils";

const ACCENTS = ["#a16207", "#0369a1", "#047857", "#7c2d12", "#6d28d9", "#b91c1c"];
const pickAccent = (seed: string) => pickBySeed(ACCENTS, seed);

export default function ClientesPage() {
  const clients = [...CLIENTS].sort((a, b) => b.visits - a.visits);

  return (
    <PageShell>
      <PageHeader
        title="Clientes"
        subtitle={`${CLIENTS.length} clientes en tu base.`}
        actions={
          <Button size="md">
            <Plus className="h-4 w-4" /> Nuevo cliente
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {/* table head */}
        <div className="hidden grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b border-stone-200 bg-stone-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-stone-400 sm:grid">
          <span>Cliente</span>
          <span>Visitas</span>
          <span>Última visita</span>
          <span className="w-20 text-right">Acción</span>
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
                    {c.notes && (
                      <StickyNote className="h-3.5 w-3.5 text-gold" />
                    )}
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
                Hace {Math.max(1, Math.round((Date.now() - new Date(c.lastVisit).getTime()) / 86400000))} días
                <span className="ml-1 hidden text-stone-400 md:inline">
                  ({formatDayShort(new Date(c.lastVisit))})
                </span>
              </div>

              <div className="sm:w-20 sm:text-right">
                <button className="text-sm font-medium text-stone-500 hover:text-ink">
                  Ver ficha
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}
