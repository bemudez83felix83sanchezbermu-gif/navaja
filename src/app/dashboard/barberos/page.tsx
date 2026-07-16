import { appointmentsOn, getBarbers, getServices } from "@/lib/data/queries";
import { startOfDay } from "@/lib/dates";
import { PageShell } from "@/components/dashboard/PageHeader";
import { BarbersManager } from "@/components/dashboard/BarbersManager";

export default async function BarberosPage() {
  const [barbers, services, today] = await Promise.all([
    getBarbers({ includeInactive: true }),
    getServices({ includeInactive: true }),
    appointmentsOn(startOfDay(new Date())),
  ]);

  const todayCounts: Record<string, number> = {};
  for (const a of today) {
    if (a.status === "cancelada") continue;
    todayCounts[a.barberId] = (todayCounts[a.barberId] ?? 0) + 1;
  }

  return (
    <PageShell>
      <BarbersManager barbers={barbers} services={services} todayCounts={todayCounts} />
    </PageShell>
  );
}
