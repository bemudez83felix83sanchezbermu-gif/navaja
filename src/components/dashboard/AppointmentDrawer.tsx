"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  Check,
  Clock,
  Mail,
  Phone,
  Scissors,
  StickyNote,
  TriangleAlert,
  User,
  UserX,
  X,
} from "lucide-react";
import type { AppointmentDetailed, AppointmentStatus } from "@/lib/data/types";
import { setAppointmentStatus } from "@/app/actions/appointments";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { cn, formatDayLong, formatDuration, formatPrice, formatTime } from "@/lib/utils";

/**
 * Drawer de detalle de una reserva — se abre al seleccionar una cita en la
 * agenda o en la lista de citas. Permite avanzar el ciclo de vida:
 * pendiente → confirmada → completada / no_show / cancelada (y reabrir).
 */

type Transition = {
  status: AppointmentStatus;
  label: string;
  icon: typeof Check;
  variant: "primary" | "dark" | "outline" | "ghost";
  destructive?: boolean;
};

const TRANSITIONS: Record<AppointmentStatus, Transition[]> = {
  pendiente: [
    { status: "confirmada", label: "Confirmar", icon: Check, variant: "primary" },
    { status: "cancelada", label: "Cancelar cita", icon: X, variant: "ghost", destructive: true },
  ],
  // Un hold de pago SOLO lo confirma el webhook de Mercado Pago (ya pagado).
  // El dueño únicamente puede liberar el slot; si el pago llegara después,
  // el webhook lo reembolsa automáticamente (PAGOS.md A4).
  pendiente_pago: [
    { status: "cancelada", label: "Cancelar (libera el horario)", icon: X, variant: "ghost", destructive: true },
  ],
  confirmada: [
    { status: "completada", label: "Completar", icon: Check, variant: "primary" },
    { status: "no_show", label: "No asistió", icon: UserX, variant: "outline" },
    { status: "cancelada", label: "Cancelar cita", icon: X, variant: "ghost", destructive: true },
  ],
  completada: [],
  cancelada: [
    { status: "confirmada", label: "Reabrir como confirmada", icon: Check, variant: "outline" },
  ],
  no_show: [
    { status: "completada", label: "Corregir a completada", icon: Check, variant: "outline" },
  ],
};

export function AppointmentDrawer({
  appt,
  onClose,
}: {
  appt: AppointmentDetailed | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<AppointmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!appt) return null;
  const start = new Date(appt.start);
  const end = new Date(appt.end);

  async function transition(status: AppointmentStatus) {
    if (!appt) return;
    setBusy(status);
    setError(null);
    try {
      const res = await setAppointmentStatus({ id: appt.id, status });
      if (res.ok) {
        onClose();
        router.refresh();
      } else {
        setError(res.error);
      }
    } catch {
      setError("No se pudo actualizar la cita.");
    } finally {
      setBusy(null);
    }
  }

  const actions = TRANSITIONS[appt.status];

  return (
    <Modal open onClose={onClose} title="Detalle de la cita" side="right">
      <div className="space-y-5">
        {/* Estado + horario */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-2xl font-semibold tracking-tight text-ink">
              <span className="tnum">{formatTime(start)}</span>
              <span className="text-stone-400">–</span>
              <span className="tnum">{formatTime(end)}</span>
            </p>
            <p className="mt-0.5 text-sm capitalize text-stone-500">
              {formatDayLong(start)}
            </p>
          </div>
          <StatusBadge status={appt.status} />
        </div>

        {/* Cliente */}
        <section className="rounded-2xl border border-stone-200 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Cliente
          </p>
          <div className="space-y-2.5 text-sm">
            <p className="flex items-center gap-2.5 font-semibold text-ink">
              <User className="h-4 w-4 shrink-0 text-stone-400" />
              {appt.client.name}
            </p>
            <a
              href={`tel:${appt.client.phone.replace(/\s/g, "")}`}
              className="flex items-center gap-2.5 text-stone-600 transition-colors hover:text-gold"
            >
              <Phone className="h-4 w-4 shrink-0 text-stone-400" />
              <span className="tnum">{appt.client.phone}</span>
            </a>
            {appt.client.email && (
              <p className="flex items-center gap-2.5 text-stone-600">
                <Mail className="h-4 w-4 shrink-0 text-stone-400" />
                {appt.client.email}
              </p>
            )}
            {appt.client.notes && (
              <p className="flex items-start gap-2.5 text-stone-600">
                <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                {appt.client.notes}
              </p>
            )}
          </div>
        </section>

        {/* Servicio */}
        <section className="rounded-2xl border border-stone-200 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
            Servicio
          </p>
          <div className="space-y-2.5 text-sm">
            <p className="flex items-center gap-2.5 font-semibold text-ink">
              <Scissors className="h-4 w-4 shrink-0 text-stone-400" />
              {appt.service.name}
            </p>
            <p className="flex items-center gap-2.5 text-stone-600">
              <Clock className="h-4 w-4 shrink-0 text-stone-400" />
              {formatDuration(appt.service.durationMin)}
            </p>
            <p className="flex items-center gap-2.5 text-stone-600">
              <Banknote className="h-4 w-4 shrink-0 text-stone-400" />
              <span className="tnum font-semibold text-ink">
                {formatPrice(appt.priceCents)}
              </span>
            </p>
          </div>
        </section>

        {/* Barbero */}
        <section className="flex items-center gap-3 rounded-2xl border border-stone-200 p-4">
          <Avatar name={appt.barber.name} accent={appt.barber.accent} size={40} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{appt.barber.name}</p>
            <p className="text-xs text-stone-500">{appt.barber.role}</p>
          </div>
        </section>

        {/* Notas de la cita */}
        {appt.notes && (
          <section className="rounded-2xl border border-dashed border-stone-300 p-4 text-sm text-stone-600">
            <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
              <StickyNote className="h-3.5 w-3.5" /> Notas
            </p>
            {appt.notes}
          </section>
        )}

        <p className="flex items-center gap-2 text-xs text-stone-400">
          <CalendarDays className="h-3.5 w-3.5" />
          Folio <span className="tnum font-semibold">{appt.id.slice(0, 8).toUpperCase()}</span>
        </p>

        {error && (
          <p
            role="alert"
            className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive-bg px-3.5 py-2.5 text-sm font-medium text-destructive"
          >
            <TriangleAlert className="h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {actions.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-stone-100 pt-4">
            {actions.map((t) => (
              <Button
                key={t.status}
                variant={t.variant}
                size="md"
                disabled={busy !== null}
                onClick={() => transition(t.status)}
                className={cn(t.destructive && "text-destructive hover:bg-destructive-bg")}
              >
                <t.icon className="h-4 w-4" />
                {busy === t.status ? "Guardando…" : t.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
