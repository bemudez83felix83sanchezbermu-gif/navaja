"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import type { AppointmentDetailed, Barber, Service } from "@/lib/data/types";
import { AppointmentDrawer } from "@/components/dashboard/AppointmentDrawer";
import { AppointmentRow } from "@/components/dashboard/AppointmentRow";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Input";
import { cn, formatDayLong } from "@/lib/utils";

export type CitasTab = "proximas" | "hoy" | "historial" | "todas";
const TABS: { id: CitasTab; label: string }[] = [
  { id: "proximas", label: "Próximas" },
  { id: "hoy", label: "Hoy" },
  { id: "historial", label: "Historial" },
  { id: "todas", label: "Todas" },
];

const ESTADOS: { id: string; label: string }[] = [
  { id: "todos", label: "Todos los estados" },
  { id: "pendiente", label: "Pendiente" },
  { id: "confirmada", label: "Confirmada" },
  { id: "completada", label: "Completada" },
  { id: "cancelada", label: "Cancelada" },
  { id: "no_show", label: "No asistió" },
];

export interface CitasFilters {
  tab: CitasTab;
  servicio: string;
  barbero: string;
  estado: string;
  q: string;
}

/**
 * Lista de citas con filtros combinables. Los filtros viven en la URL
 * (?tab=&servicio=&barbero=&estado=&q=): el servidor filtra sobre datos
 * frescos y la URL es compartible. Click en una fila → drawer de detalle.
 */
export function CitasList({
  groups,
  services,
  barbers,
  filters,
  total,
}: {
  groups: [string, AppointmentDetailed[]][];
  services: Service[];
  barbers: Barber[];
  filters: CitasFilters;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<AppointmentDetailed | null>(null);
  const [q, setQ] = useState(filters.q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = (patch: Partial<CitasFilters>) => {
    const next = { ...filters, q, ...patch };
    const params = new URLSearchParams();
    if (next.tab !== "proximas") params.set("tab", next.tab);
    if (next.servicio !== "todos") params.set("servicio", next.servicio);
    if (next.barbero !== "todos") params.set("barbero", next.barbero);
    if (next.estado !== "todos") params.set("estado", next.estado);
    if (next.q.trim()) params.set("q", next.q.trim());
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  };

  // Búsqueda con debounce — escribe fluido, la URL se actualiza a los 300ms.
  useEffect(() => {
    if (q === filters.q) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ q }), 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters =
    filters.servicio !== "todos" ||
    filters.barbero !== "todos" ||
    filters.estado !== "todos" ||
    filters.q.trim() !== "";

  return (
    <>
      {/* Controles */}
      <div className="mb-5 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => apply({ tab: t.id })}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
                  filters.tab === t.id
                    ? "bg-stone-900 text-white"
                    : "text-stone-500 hover:text-ink",
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
              placeholder="Buscar cliente…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-stone-400"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                aria-label="Limpiar búsqueda"
                className="text-stone-400 hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
        </div>

        {/* Filtros por catálogo */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Filtrar por servicio"
            value={filters.servicio}
            onChange={(e) => apply({ servicio: e.target.value })}
            className="h-10 w-auto min-w-44 text-sm"
          >
            <option value="todos">Todos los servicios</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrar por barbero"
            value={filters.barbero}
            onChange={(e) => apply({ barbero: e.target.value })}
            className="h-10 w-auto min-w-40 text-sm"
          >
            <option value="todos">Todos los barberos</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filtrar por estado"
            value={filters.estado}
            onChange={(e) => apply({ estado: e.target.value })}
            className="h-10 w-auto min-w-40 text-sm"
          >
            {ESTADOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          {hasFilters && (
            <button
              onClick={() => {
                setQ("");
                apply({ servicio: "todos", barbero: "todos", estado: "todos", q: "" });
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </button>
          )}
          <span className="ml-auto text-sm text-stone-400">
            <span className="tnum font-semibold text-stone-600">{total}</span>{" "}
            {total === 1 ? "cita" : "citas"}
          </span>
        </div>
      </div>

      {/* Grupos por día */}
      <div className={cn("transition-opacity", isPending && "opacity-60")}>
        {groups.length > 0 ? (
          <div className="space-y-6">
            {groups.map(([key, items]) => (
              <div key={key}>
                <p className="mb-2 px-1 text-sm font-semibold capitalize text-stone-500">
                  {formatDayLong(new Date(`${key}T12:00:00`))}
                  <span className="ml-2 font-normal text-stone-400">
                    · {items.length} {items.length === 1 ? "cita" : "citas"}
                  </span>
                </p>
                <Card className="divide-y divide-stone-100 overflow-hidden">
                  {items.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className="block w-full text-left"
                    >
                      <AppointmentRow appt={a} />
                    </button>
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
      </div>

      <AppointmentDrawer appt={selected} onClose={() => setSelected(null)} />
    </>
  );
}
