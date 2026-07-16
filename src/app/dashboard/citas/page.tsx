import { Plus } from "lucide-react";
import {
  appointmentsInRange,
  getBarbers,
  getServices,
  getShop,
} from "@/lib/data/queries";
import { addDays, sameDay, startOfDay, toDayKey } from "@/lib/dates";
import type { AppointmentDetailed } from "@/lib/data/types";
import { PageShell, PageHeader } from "@/components/dashboard/PageHeader";
import { CitasList, type CitasFilters, type CitasTab } from "@/components/dashboard/CitasList";
import { ButtonLink } from "@/components/ui/Button";

const TABS: CitasTab[] = ["proximas", "hoy", "historial", "todas"];

/**
 * Citas — server component. Todos los filtros (pestaña, servicio, barbero,
 * estado, búsqueda) viajan en la URL y se aplican aquí sobre datos frescos;
 * CitasList solo pinta y actualiza la URL.
 */
export default async function CitasPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    servicio?: string;
    barbero?: string;
    estado?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const filters: CitasFilters = {
    tab: TABS.includes(sp.tab as CitasTab) ? (sp.tab as CitasTab) : "proximas",
    servicio: sp.servicio ?? "todos",
    barbero: sp.barbero ?? "todos",
    estado: sp.estado ?? "todos",
    q: sp.q ?? "",
  };

  const now = new Date();
  const today = startOfDay(now);

  const [shop, services, barbers, all] = await Promise.all([
    getShop(),
    getServices({ includeInactive: true }),
    getBarbers({ includeInactive: true }),
    appointmentsInRange(addDays(today, -35), addDays(today, 30)),
  ]);

  let list: AppointmentDetailed[];
  switch (filters.tab) {
    case "hoy":
      list = all.filter((a) => sameDay(a.start, today));
      break;
    case "historial":
      list = all
        .filter((a) => a.end < now)
        .sort((a, b) => b.start.getTime() - a.start.getTime());
      break;
    case "todas":
      list = all;
      break;
    default:
      list = all.filter(
        (a) =>
          a.start >= now && (a.status === "confirmada" || a.status === "pendiente"),
      );
  }

  if (filters.servicio !== "todos") {
    list = list.filter((a) => a.serviceId === filters.servicio);
  }
  if (filters.barbero !== "todos") {
    list = list.filter((a) => a.barberId === filters.barbero);
  }
  if (filters.estado !== "todos") {
    list = list.filter((a) => a.status === filters.estado);
  }
  if (filters.q.trim()) {
    const needle = filters.q.trim().toLowerCase();
    list = list.filter((a) => a.client.name.toLowerCase().includes(needle));
  }

  // Agrupar por día (dayKey estable — evita desfases de zona horaria).
  const map = new Map<string, AppointmentDetailed[]>();
  for (const a of list) {
    const key = toDayKey(a.start);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  const groups = Array.from(map.entries());

  return (
    <PageShell>
      <PageHeader
        title="Citas"
        subtitle="Todas tus reservas en un solo lugar."
        actions={
          <ButtonLink href={`/${shop.slug}`} size="md">
            <Plus className="h-4 w-4" /> Nueva cita
          </ButtonLink>
        }
      />
      <CitasList
        groups={groups}
        services={services}
        barbers={barbers}
        filters={filters}
        total={list.length}
      />
    </PageShell>
  );
}
