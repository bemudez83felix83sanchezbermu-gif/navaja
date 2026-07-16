import { getBarbers, getServices } from "@/lib/data/queries";
import { PageShell } from "@/components/dashboard/PageHeader";
import { ServicesManager } from "@/components/dashboard/ServicesManager";

export default async function ServiciosPage() {
  const [services, barbers] = await Promise.all([
    getServices({ includeInactive: true }),
    getBarbers(),
  ]);

  return (
    <PageShell>
      <ServicesManager services={services} barbers={barbers} />
    </PageShell>
  );
}
