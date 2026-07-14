import { CalendarDays, Check } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

const rows = [
  { time: "10:00", client: "Andrés Vega", service: "Fade / Degradado", barber: "Marco Salinas", accent: "#a16207", state: "done" },
  { time: "10:45", client: "Luis Fernando", service: "Corte + barba", barber: "Tato Mendoza", accent: "#7c2d12", state: "now" },
  { time: "11:30", client: "Carlos Mena", service: "Afeitado a navaja", barber: "Iván Ortega", accent: "#0369a1", state: "next" },
  { time: "12:15", client: "Emilio Cruz", service: "Corte clásico", barber: "Diego Ramos", accent: "#047857", state: "next" },
];

/** Static, on-brand mock of the day agenda — used as the hero centerpiece. */
export function AgendaPreview() {
  return (
    <div className="w-full max-w-md rounded-[1.6rem] border border-white/12 bg-white p-2 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.55)]">
      <div className="rounded-[1.25rem] bg-stone-50 p-5">
        {/* header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-stone-900 text-white">
              <CalendarDays className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-[0.7rem] font-medium uppercase tracking-wide text-stone-400">
                Agenda de hoy
              </p>
              <p className="text-sm font-semibold text-ink">sábado 13 de junio</p>
            </div>
          </div>
          <span className="rounded-full bg-success-bg px-2.5 py-1 text-xs font-semibold text-success">
            82% ocupado
          </span>
        </div>

        {/* rows */}
        <div className="mt-4 space-y-2">
          {rows.map((r) => (
            <div
              key={r.time}
              className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 ${
                r.state === "now"
                  ? "border-gold/40 ring-1 ring-gold/30"
                  : "border-stone-200"
              }`}
            >
              <span className="tnum w-11 text-sm font-semibold text-stone-500">
                {r.time}
              </span>
              <span className="h-8 w-px bg-stone-200" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{r.client}</p>
                <p className="truncate text-xs text-stone-500">{r.service}</p>
              </div>
              <Avatar name={r.barber} accent={r.accent} size={30} />
              {r.state === "done" && (
                <span className="grid h-5 w-5 place-items-center rounded-full bg-stone-100">
                  <Check className="h-3 w-3 text-stone-500" strokeWidth={3} />
                </span>
              )}
              {r.state === "now" && (
                <span className="rounded-full bg-gold px-2 py-0.5 text-[0.65rem] font-bold uppercase text-white">
                  En silla
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-dashed border-stone-300 px-3 py-2.5">
          <span className="text-xs font-medium text-stone-500">13:00 · libre</span>
          <span className="text-xs font-semibold text-gold">+ Reservar</span>
        </div>
      </div>
    </div>
  );
}
