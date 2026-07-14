"use client";

import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import {
  appointmentsInRange,
  startOfDay,
  addDays,
  sameDay,
} from "@/lib/data/mock";
import type { AppointmentDetailed } from "@/lib/data/types";
import { PageShell, PageHeader } from "@/components/dashboard/PageHeader";
import { AppointmentRow } from "@/components/dashboard/AppointmentRow";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { cn, formatDayLong } from "@/lib/utils";

type Tab = "proximas" | "hoy" | "historial" | "todas";
const TABS: { id: Tab; label: string }[] = [
  { id: "proximas", label: "Próximas" },
  { id: "hoy", label: "Hoy" },
  { id: "historial", label: "Historial" },
  { id: "todas", label: "Todas" },
];

export default function CitasPage() {
  const [tab, setTab] = useState<Tab>("proximas");
  const [q, setQ] = useState("");

  const now = new Date();
  const today = startOfDay(now);

  const all = useMemo(
    () => appointmentsInRange(addDays(today, -10), addDays(today, 16)),
    [today],
  );

  const filtered = useMemo(() => {
    let list: AppointmentDetailed[];
    switch (tab) {
      case "proximas":
        list = all
          .filter((a) => a.start >= now && (a.status === "confirmada" || a.status === "pendiente"))
          .sort((a, b) => a.start.getTime() - b.start.getTime());
        break;
      case "hoy":
        list = all.filter((a) => sameDay(a.start, today));
        break;
      case "historial":
        list = all.filter((a) => a.end < now).sort((a, b) => b.start.getTime() - a.start.getTime());
        break;
      default:
        list = all;
    }
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(
        (a) =>
          a.client.name.toLowerCase().includes(needle) ||
          a.service.name.toLowerCase().includes(needle) ||
          a.barber.name.toLowerCase().includes(needle),
      );
    }
    return list;
  }, [all, tab, q, now, today]);

  // group by day
  const groups = useMemo(() => {
    const map = new Map<string, AppointmentDetailed[]>();
    for (const a of filtered) {
      const key = a.start.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <PageShell>
      <PageHeader
        title="Citas"
        subtitle="Todas tus reservas en un solo lugar."
        actions={
          <ButtonLink href="/el-filo" size="md">
            <Plus className="h-4 w-4" /> Nueva cita
          </ButtonLink>
        }
      />

      {/* Controls */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                tab === t.id ? "bg-stone-900 text-white" : "text-stone-500 hover:text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 focus-within:border-gold focus-within:ring-1 focus-within:ring-gold sm:w-72">
          <Search className="h-4 w-4 shrink-0 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente, servicio…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
          />
        </label>
      </div>

      {/* Groups */}
      {groups.length > 0 ? (
        <div className="space-y-6">
          {groups.map(([key, items]) => (
            <div key={key}>
              <p className="mb-2 px-1 text-sm font-semibold capitalize text-stone-500">
                {formatDayLong(new Date(key))}
                <span className="ml-2 font-normal text-stone-400">
                  · {items.length} {items.length === 1 ? "cita" : "citas"}
                </span>
              </p>
              <Card className="divide-y divide-stone-100 overflow-hidden">
                {items.map((a) => (
                  <AppointmentRow key={a.id} appt={a} />
                ))}
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <Card className="py-16 text-center">
          <p className="font-semibold text-ink">Sin resultados</p>
          <p className="mt-1 text-sm text-stone-500">
            Prueba con otro filtro o término de búsqueda.
          </p>
        </Card>
      )}
    </PageShell>
  );
}
