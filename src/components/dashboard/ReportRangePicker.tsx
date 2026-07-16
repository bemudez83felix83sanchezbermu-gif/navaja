"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { addDays, fromDayKey, startOfDay, toDayKey } from "@/lib/dates";
import { Calendar } from "@/components/ui/Calendar";
import { cn, formatDayShort } from "@/lib/utils";

const PRESETS = [
  { label: "Últimos 7 días", days: 7 },
  { label: "Últimos 30 días", days: 30 },
  { label: "Últimos 90 días", days: 90 },
] as const;

/**
 * Selector de rango del reporte + botones de exportación.
 * El rango vive en la URL (?from=&to=) — el servidor recalcula el reporte y
 * los links de export llevan el mismo rango. El rango custom se elige con el
 * calendario animado: primer click = desde, segundo = hasta.
 */
export function ReportRangePicker({ fromKey, toKey }: { fromKey: string; toKey: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [pickStart, setPickStart] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPickStart(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = (f: string, t: string) => {
    setOpen(false);
    setPickStart(null);
    startTransition(() => {
      router.push(`/dashboard/reportes?from=${f}&to=${t}`, { scroll: false });
    });
  };

  const applyPreset = (days: number) => {
    const today = startOfDay(new Date());
    go(toDayKey(addDays(today, -(days - 1))), toDayKey(today));
  };

  const thisMonth = () => {
    const now = new Date();
    go(
      toDayKey(new Date(now.getFullYear(), now.getMonth(), 1)),
      toDayKey(startOfDay(now)),
    );
  };
  const lastMonth = () => {
    const now = new Date();
    go(
      toDayKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      toDayKey(new Date(now.getFullYear(), now.getMonth(), 0)),
    );
  };

  const onCalendarPick = (key: string) => {
    if (!pickStart) {
      setPickStart(key);
      return;
    }
    const a = pickStart <= key ? pickStart : key;
    const b = pickStart <= key ? key : pickStart;
    go(a, b);
  };

  const from = fromDayKey(fromKey)!;
  const to = fromDayKey(toKey)!;
  const exportQs = `from=${fromKey}&to=${toKey}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className={cn(
            "inline-flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-ink transition-colors hover:border-stone-400",
            open && "border-stone-900",
          )}
        >
          <CalendarDays className="h-4 w-4 text-stone-400" />
          <span className="capitalize">{formatDayShort(from)}</span>
          <span className="text-stone-400">→</span>
          <span className="capitalize">{formatDayShort(to)}</span>
          <ChevronDown className="h-3.5 w-3.5 text-stone-400" />
        </button>

        {open && (
          <div className="animate-pop-in absolute left-0 top-13 z-40 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-card p-4 shadow-[var(--shadow-lift)] sm:flex-row">
            <div className="flex flex-col gap-1 sm:w-40 sm:border-r sm:border-stone-100 sm:pr-3">
              {PRESETS.map((p) => (
                <button
                  key={p.days}
                  onClick={() => applyPreset(p.days)}
                  className="rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-ink"
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={thisMonth}
                className="rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-ink"
              >
                Este mes
              </button>
              <button
                onClick={lastMonth}
                className="rounded-lg px-3 py-2 text-left text-sm font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-ink"
              >
                Mes pasado
              </button>
            </div>
            <div>
              <p className="mb-1 px-1 text-xs font-medium text-stone-400">
                {pickStart
                  ? `Desde ${pickStart} — ahora elige el día final`
                  : "Rango personalizado: elige el día inicial"}
              </p>
              <Calendar value={pickStart ?? fromKey} onSelect={onCalendarPick} />
            </div>
          </div>
        )}
      </div>

      {/* Export */}
      <a
        href={`/dashboard/reportes/export?format=xlsx&${exportQs}`}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-ink transition-colors hover:border-success hover:text-success"
      >
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </a>
      <a
        href={`/dashboard/reportes/export?format=pdf&${exportQs}`}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-medium text-ink transition-colors hover:border-destructive hover:text-destructive"
      >
        <FileText className="h-4 w-4" /> PDF
      </a>
      <span className="hidden items-center gap-1.5 text-xs text-stone-400 xl:inline-flex">
        <Download className="h-3.5 w-3.5" /> Con el rango seleccionado
      </span>
    </div>
  );
}
