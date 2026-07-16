"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, sameDay, startOfDay, toDayKey, fromDayKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

/**
 * Calendario mensual animado del sistema de diseño.
 *
 * - Cambio de mes con deslizamiento direccional (CSS puro, respeta
 *   prefers-reduced-motion vía la regla global).
 * - `marks` pinta puntos de densidad por día (1–3 según citas).
 * - Lunes como primer día, es-MX, cifras tabulares.
 */
export function Calendar({
  value,
  onSelect,
  marks = {},
  className,
}: {
  /** día seleccionado como dayKey (`2026-07-14`) */
  value?: string;
  onSelect: (dayKey: string) => void;
  /** citas por día — pinta puntos de densidad */
  marks?: Record<string, number>;
  className?: string;
}) {
  const selected = fromDayKey(value ?? null);
  const today = startOfDay(new Date());
  const [month, setMonth] = useState<Date>(
    new Date((selected ?? today).getFullYear(), (selected ?? today).getMonth(), 1),
  );
  const [dir, setDir] = useState<"next" | "prev">("next");

  const move = (delta: number) => {
    setDir(delta > 0 ? "next" : "prev");
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  // Rejilla: desde el lunes de la semana del día 1 hasta completar 6 filas.
  const firstWeekday = (month.getDay() + 6) % 7; // 0 = lunes
  const gridStart = addDays(month, -firstWeekday);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  const monthLabel = new Intl.DateTimeFormat("es-MX", {
    month: "long",
    year: "numeric",
  }).format(month);

  return (
    <div className={cn("w-[19.5rem] select-none", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="font-display text-sm font-semibold capitalize tracking-tight text-ink">
          {monthLabel}
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => move(-1)}
            aria-label="Mes anterior"
            className="grid h-7 w-7 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            aria-label="Mes siguiente"
            className="grid h-7 w-7 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 px-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-stone-400">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>

      {/* Days — keyed by month so the swap animates directionally */}
      <div
        key={month.toISOString()}
        className={cn(
          "grid grid-cols-7 gap-y-0.5 overflow-hidden px-1 pb-1",
          dir === "next" ? "animate-cal-next" : "animate-cal-prev",
        )}
      >
        {cells.map((d) => {
          const key = toDayKey(d);
          const inMonth = d.getMonth() === month.getMonth();
          const isToday = sameDay(d, today);
          const isSelected = selected ? sameDay(d, selected) : false;
          const count = marks[key] ?? 0;
          const dots = Math.min(3, count > 0 ? Math.ceil(count / 8) : 0);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              aria-label={key}
              aria-pressed={isSelected}
              className={cn(
                "group relative mx-auto flex h-9 w-9 flex-col items-center justify-center rounded-xl text-sm transition-all",
                inMonth ? "text-ink" : "text-stone-300",
                isSelected
                  ? "bg-gold font-semibold text-white shadow-[0_4px_14px_rgb(161_98_7/0.35)]"
                  : "hover:bg-stone-100",
                isToday && !isSelected && "ring-1 ring-gold",
              )}
            >
              <span className="tnum leading-none">{d.getDate()}</span>
              {dots > 0 && (
                <span className="absolute bottom-1 flex gap-0.5">
                  {Array.from({ length: dots }).map((_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 w-1 rounded-full",
                        isSelected ? "bg-white/80" : "bg-gold",
                      )}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
