"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { AppointmentDetailed, Barber } from "@/lib/data/types";
import { addDays, fromDayKey, sameDay, startOfDay, toDayKey } from "@/lib/dates";
import { AppointmentDrawer } from "@/components/dashboard/AppointmentDrawer";
import { Calendar } from "@/components/ui/Calendar";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn, formatDayLong, formatPrice, formatTime } from "@/lib/utils";

const HOUR_H = 76; // px por hora

/**
 * Tablero de agenda por barbero. El día activo vive en la URL (?d=YYYY-MM-DD):
 * navegar refetchea en el servidor — los datos siempre son la verdad de la DB.
 * Click en una cita → drawer de detalle con acciones de estado.
 */
export function AgendaBoard({
  dayKey,
  openHour,
  closeHour,
  barbers,
  appts,
  marks,
}: {
  dayKey: string;
  openHour: number;
  closeHour: number;
  barbers: Barber[];
  appts: AppointmentDetailed[];
  marks: Record<string, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [calOpen, setCalOpen] = useState(false);
  const [selected, setSelected] = useState<AppointmentDetailed | null>(null);
  const calRef = useRef<HTMLDivElement>(null);

  const active = fromDayKey(dayKey) ?? startOfDay(new Date());
  const today = startOfDay(new Date());
  const isToday = sameDay(active, today);

  const go = (key: string) => {
    setCalOpen(false);
    startTransition(() => {
      router.push(`/dashboard/agenda?d=${key}`, { scroll: false });
    });
  };

  // Línea de "ahora": solo tras montar (evita desfase SSR/cliente) y se
  // actualiza cada minuto.
  const [nowTop, setNowTop] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      const n = new Date();
      setNowTop(((n.getHours() * 60 + n.getMinutes() - openHour * 60) / 60) * HOUR_H);
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [openHour]);

  // Cerrar el popover del calendario al hacer click fuera.
  useEffect(() => {
    if (!calOpen) return;
    const onDown = (e: MouseEvent) => {
      if (calRef.current && !calRef.current.contains(e.target as Node)) {
        setCalOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [calOpen]);

  const hours = Array.from({ length: closeHour - openHour }, (_, i) => openHour + i);
  const openMin = openHour * 60;

  const dayActive = appts.filter((a) => a.status !== "cancelada");
  const dayRevenue = dayActive
    .filter((a) => a.status === "completada" || a.status === "confirmada")
    .reduce((s, a) => s + a.priceCents, 0);

  return (
    <>
      {/* Header con navegación de día */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
            Agenda
          </h1>
          <p className="mt-1 capitalize text-stone-500">{formatDayLong(active)}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-stone-200 bg-white">
            <button
              onClick={() => go(toDayKey(addDays(active, -1)))}
              className="grid h-10 w-10 place-items-center rounded-l-xl text-stone-500 hover:bg-stone-50"
              aria-label="Día anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="h-6 w-px bg-stone-200" />
            <div className="relative" ref={calRef}>
              <button
                onClick={() => setCalOpen((v) => !v)}
                aria-label="Elegir fecha"
                aria-expanded={calOpen}
                className={cn(
                  "grid h-10 w-10 place-items-center text-stone-500 hover:bg-stone-50",
                  calOpen && "bg-stone-100 text-ink",
                )}
              >
                <CalendarDays className="h-4 w-4" />
              </button>
              {calOpen && (
                <div className="animate-pop-in absolute right-0 top-12 z-40 rounded-2xl border border-stone-200 bg-card p-3 shadow-[var(--shadow-lift)]">
                  <Calendar value={dayKey} marks={marks} onSelect={go} />
                </div>
              )}
            </div>
            <span className="h-6 w-px bg-stone-200" />
            <button
              onClick={() => go(toDayKey(addDays(active, 1)))}
              className="grid h-10 w-10 place-items-center rounded-r-xl text-stone-500 hover:bg-stone-50"
              aria-label="Día siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant={isToday ? "dark" : "outline"}
            size="md"
            onClick={() => go(toDayKey(today))}
          >
            Hoy
          </Button>
        </div>
      </div>

      {/* Chips resumen del día */}
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Chip label="Citas" value={String(dayActive.length)} />
        <Chip label="Ingreso estimado" value={formatPrice(dayRevenue)} />
        <Chip label="Barberos" value={String(barbers.length)} />
      </div>

      {/* Tablero */}
      <Card
        className={cn(
          "overflow-hidden p-0 transition-opacity",
          isPending && "pointer-events-none opacity-60",
        )}
      >
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {/* Encabezados de columna */}
            <div
              className="grid border-b border-stone-200 bg-stone-50"
              style={{ gridTemplateColumns: `4rem repeat(${barbers.length}, 1fr)` }}
            >
              <div className="border-r border-stone-200" />
              {barbers.map((b) => {
                const count = dayActive.filter((a) => a.barberId === b.id).length;
                return (
                  <div
                    key={b.id}
                    className="flex items-center gap-2.5 border-r border-stone-200 px-3 py-3 last:border-r-0"
                  >
                    <Avatar name={b.name} accent={b.accent} size={32} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {b.name.split(" ")[0]}
                      </p>
                      <p className="text-xs text-stone-400">{count} citas</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rejilla horaria */}
            <div
              className="relative grid"
              style={{ gridTemplateColumns: `4rem repeat(${barbers.length}, 1fr)` }}
            >
              <div className="border-r border-stone-200">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="relative border-b border-stone-100"
                    style={{ height: HOUR_H }}
                  >
                    <span className="tnum absolute -top-2 right-2 text-xs font-medium text-stone-400">
                      {String(h).padStart(2, "0")}:00
                    </span>
                  </div>
                ))}
              </div>

              {barbers.map((b) => (
                <div key={b.id} className="relative border-r border-stone-100 last:border-r-0">
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="border-b border-stone-100"
                      style={{ height: HOUR_H }}
                    />
                  ))}
                  {appts
                    .filter((a) => a.barberId === b.id)
                    .map((a) => (
                      <ApptBlock
                        key={a.id}
                        appt={a}
                        openMin={openMin}
                        onClick={() => setSelected(a)}
                      />
                    ))}
                </div>
              ))}

              {/* Línea del ahora */}
              {isToday &&
                nowTop !== null &&
                nowTop >= 0 &&
                nowTop <= hours.length * HOUR_H && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: nowTop }}
                  >
                    <span className="ml-[3.25rem] h-2.5 w-2.5 rounded-full bg-gold ring-4 ring-gold/20" />
                    <span className="h-px flex-1 bg-gold" />
                  </div>
                )}
            </div>
          </div>
        </div>
      </Card>

      <AppointmentDrawer appt={selected} onClose={() => setSelected(null)} />
    </>
  );
}

function ApptBlock({
  appt,
  openMin,
  onClick,
}: {
  appt: AppointmentDetailed;
  openMin: number;
  onClick: () => void;
}) {
  const start = new Date(appt.start);
  const end = new Date(appt.end);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const durMin = (end.getTime() - start.getTime()) / 60000;
  const top = ((startMin - openMin) / 60) * HOUR_H;
  const height = (durMin / 60) * HOUR_H - 3;
  const muted =
    appt.status === "completada" ||
    appt.status === "no_show" ||
    appt.status === "cancelada";
  const tiny = height < 44;

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute inset-x-1 z-10 cursor-pointer overflow-hidden rounded-lg border-l-[3px] px-2.5 py-1.5 text-left shadow-sm transition-all hover:z-30 hover:shadow-md focus-visible:z-30",
        muted && "opacity-55 hover:opacity-90",
      )}
      style={{
        top,
        height,
        backgroundColor: `color-mix(in oklab, ${appt.barber.accent} 14%, var(--color-card))`,
        borderColor: appt.barber.accent,
      }}
      title={`${formatTime(start)} · ${appt.client.name} · ${appt.service.name}`}
    >
      <p className="truncate text-xs font-semibold text-ink">{appt.client.name}</p>
      {!tiny && (
        <>
          <p className="truncate text-[0.7rem] text-stone-500">{appt.service.name}</p>
          <p className="tnum mt-0.5 text-[0.7rem] font-medium text-stone-400">
            {formatTime(start)}–{formatTime(end)}
          </p>
        </>
      )}
    </button>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3.5 py-1.5">
      <span className="text-stone-500">{label}</span>
      <span className="tnum font-semibold text-ink">{value}</span>
    </span>
  );
}
