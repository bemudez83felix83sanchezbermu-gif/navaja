import {
  appointmentsInRange,
  appointmentsOn,
  getBarbers,
  getShop,
} from "@/lib/data/queries";
import { addDays, fromDayKey, startOfDay, toDayKey } from "@/lib/dates";
import { PageShell } from "@/components/dashboard/PageHeader";
import { AgendaBoard } from "@/components/dashboard/AgendaBoard";

/**
 * Agenda del día — server component. El día activo viaja en la URL (?d=)
 * para que navegar siempre refetchee datos frescos de la DB; el tablero
 * interactivo (drawer, calendario, línea del ahora) es el client component
 * AgendaBoard.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const active = fromDayKey(d) ?? startOfDay(new Date());

  // Marcas de densidad para el calendario: el mes visible ± 1 semana.
  const monthStart = new Date(active.getFullYear(), active.getMonth(), 1);
  const monthEnd = new Date(active.getFullYear(), active.getMonth() + 1, 1);

  const [shop, barbers, appts, monthAppts] = await Promise.all([
    getShop(),
    getBarbers(),
    appointmentsOn(active),
    appointmentsInRange(addDays(monthStart, -7), addDays(monthEnd, 7)),
  ]);

  const marks: Record<string, number> = {};
  for (const a of monthAppts) {
    if (a.status === "cancelada") continue;
    const k = toDayKey(a.start);
    marks[k] = (marks[k] ?? 0) + 1;
  }

  return (
    <PageShell>
      <AgendaBoard
        dayKey={toDayKey(active)}
        openHour={shop.openHour}
        closeHour={shop.closeHour}
        barbers={barbers}
        appts={appts}
        marks={marks}
      />
    </PageShell>
  );
}
