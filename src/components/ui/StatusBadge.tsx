import type { AppointmentStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const MAP: Record<
  AppointmentStatus,
  { label: string; className: string; dot: string }
> = {
  confirmada: {
    label: "Confirmada",
    className: "bg-success-bg text-success",
    dot: "bg-success",
  },
  pendiente: {
    label: "Pendiente",
    className: "bg-warning-bg text-warning",
    dot: "bg-warning",
  },
  pendiente_pago: {
    label: "Pago pendiente",
    className: "bg-info-bg text-info",
    dot: "bg-info",
  },
  completada: {
    label: "Completada",
    className: "bg-stone-100 text-stone-600",
    dot: "bg-stone-400",
  },
  cancelada: {
    label: "Cancelada",
    className: "bg-destructive-bg text-destructive",
    dot: "bg-destructive",
  },
  no_show: {
    label: "No asistió",
    className: "bg-destructive-bg text-destructive",
    dot: "bg-destructive",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string;
}) {
  const s = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        s.className,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}
