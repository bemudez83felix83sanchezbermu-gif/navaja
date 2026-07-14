import type { AppointmentDetailed } from "@/lib/data/types";
import { Avatar } from "@/components/ui/Avatar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn, formatPrice, formatTime } from "@/lib/utils";

export function AppointmentRow({
  appt,
  showStatus = true,
  showPrice = true,
}: {
  appt: AppointmentDetailed;
  showStatus?: boolean;
  showPrice?: boolean;
}) {
  const isPast = appt.status === "completada" || appt.status === "no_show";
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-stone-50",
        isPast && "opacity-65",
      )}
    >
      <div className="flex w-14 shrink-0 flex-col">
        <span className="tnum text-sm font-semibold text-ink">{formatTime(appt.start)}</span>
        <span className="tnum text-xs text-stone-400">{formatTime(appt.end)}</span>
      </div>
      <span
        className="h-9 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: appt.barber.accent }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{appt.client.name}</p>
        <p className="truncate text-xs text-stone-500">{appt.service.name}</p>
      </div>
      <div className="hidden items-center gap-2 sm:flex">
        <Avatar name={appt.barber.name} accent={appt.barber.accent} size={26} />
        <span className="text-xs font-medium text-stone-500">
          {appt.barber.name.split(" ")[0]}
        </span>
      </div>
      {showPrice && (
        <span className="tnum hidden w-16 text-right text-sm font-semibold text-ink md:block">
          {formatPrice(appt.priceCents)}
        </span>
      )}
      {showStatus && <StatusBadge status={appt.status} className="hidden lg:inline-flex" />}
    </div>
  );
}
