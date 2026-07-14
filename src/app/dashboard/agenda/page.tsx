"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  SHOP,
  BARBERS,
  appointmentsOn,
  startOfDay,
  addDays,
  sameDay,
} from "@/lib/data/mock";
import type { AppointmentDetailed } from "@/lib/data/types";
import { PageShell } from "@/components/dashboard/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn, formatDayLong, formatPrice, formatTime } from "@/lib/utils";

const HOUR_H = 76; // px per hour

export default function AgendaPage() {
  const [active, setActive] = useState(() => startOfDay(new Date()));
  const now = new Date();
  const isToday = sameDay(active, now);

  const appts = useMemo(() => appointmentsOn(active), [active]);
  const barbers = BARBERS.filter((b) => b.active);

  const hours = Array.from(
    { length: SHOP.closeHour - SHOP.openHour },
    (_, i) => SHOP.openHour + i,
  );
  const openMin = SHOP.openHour * 60;

  const dayActive = appts.filter((a) => a.status !== "cancelada");
  const dayRevenue = dayActive
    .filter((a) => a.status === "completada" || a.status === "confirmada")
    .reduce((s, a) => s + a.priceCents, 0);

  const nowTop = ((now.getHours() * 60 + now.getMinutes() - openMin) / 60) * HOUR_H;

  return (
    <PageShell>
      {/* Header with day nav */}
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
              onClick={() => setActive((d) => addDays(d, -1))}
              className="grid h-10 w-10 place-items-center rounded-l-xl text-stone-500 hover:bg-stone-50"
              aria-label="Día anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="h-6 w-px bg-stone-200" />
            <button
              onClick={() => setActive((d) => addDays(d, 1))}
              className="grid h-10 w-10 place-items-center rounded-r-xl text-stone-500 hover:bg-stone-50"
              aria-label="Día siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant={isToday ? "dark" : "outline"}
            size="md"
            onClick={() => setActive(startOfDay(new Date()))}
          >
            Hoy
          </Button>
        </div>
      </div>

      {/* Day summary chips */}
      <div className="mb-5 flex flex-wrap gap-2 text-sm">
        <Chip label="Citas" value={String(dayActive.length)} />
        <Chip label="Ingreso estimado" value={formatPrice(dayRevenue)} />
        <Chip label="Barberos" value={String(barbers.length)} />
      </div>

      {/* Board */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {/* Column headers */}
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

            {/* Time grid */}
            <div
              className="relative grid"
              style={{ gridTemplateColumns: `4rem repeat(${barbers.length}, 1fr)` }}
            >
              {/* time gutter */}
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

              {/* barber columns */}
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
                      <ApptBlock key={a.id} appt={a} openMin={openMin} />
                    ))}
                </div>
              ))}

              {/* now line */}
              {isToday && nowTop >= 0 && nowTop <= hours.length * HOUR_H && (
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
    </PageShell>
  );
}

function ApptBlock({ appt, openMin }: { appt: AppointmentDetailed; openMin: number }) {
  const startMin = appt.start.getHours() * 60 + appt.start.getMinutes();
  const durMin = (appt.end.getTime() - appt.start.getTime()) / 60000;
  const top = ((startMin - openMin) / 60) * HOUR_H;
  const height = (durMin / 60) * HOUR_H - 3;
  const muted = appt.status === "completada" || appt.status === "no_show" || appt.status === "cancelada";
  const tiny = height < 44;

  return (
    <div
      className={cn(
        "absolute inset-x-1 z-10 overflow-hidden rounded-lg border-l-[3px] px-2.5 py-1.5 text-left shadow-sm transition-shadow hover:z-30 hover:shadow-md",
        muted && "opacity-55",
      )}
      style={{
        top,
        height,
        backgroundColor: `color-mix(in oklab, ${appt.barber.accent} 12%, white)`,
        borderColor: appt.barber.accent,
      }}
      title={`${formatTime(appt.start)} · ${appt.client.name} · ${appt.service.name}`}
    >
      <p className="truncate text-xs font-semibold text-ink">
        {appt.client.name}
      </p>
      {!tiny && (
        <>
          <p className="truncate text-[0.7rem] text-stone-500">{appt.service.name}</p>
          <p className="tnum mt-0.5 text-[0.7rem] font-medium text-stone-400">
            {formatTime(appt.start)}–{formatTime(appt.end)}
          </p>
        </>
      )}
    </div>
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
