"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Mail,
  Phone,
  Scissors,
  Sparkles,
  TriangleAlert,
  User,
} from "lucide-react";
import type { Barber, BookingRules, Service } from "@/lib/data/types";
import type { Slot } from "@/lib/data/queries";
import { addDays, startOfDay } from "@/lib/dates";
import { book } from "@/app/actions/book";
import { getAvailability } from "@/app/actions/availability";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import {
  cn,
  formatDayLong,
  formatDayShort,
  formatDuration,
  formatPrice,
} from "@/lib/utils";

type Props = {
  shopId: string;
  shopSlug: string;
  shopName: string;
  openDays: number[];
  services: Service[];
  barbers: Barber[];
  /** Owner-configured booking rules (see /dashboard/configuracion/reservas). */
  rules: BookingRules;
};

const STEPS = ["Servicio", "Barbero", "Fecha y hora", "Tus datos"];

const ANY_BARBER = "any";

export function BookingWizard({
  shopId,
  shopSlug,
  shopName,
  openDays,
  services,
  barbers,
  rules,
}: Props) {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string>(ANY_BARBER);
  const [slotIso, setSlotIso] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  // Honeypot (bots fill it) + wizard open time (anti-bot timing). See validation.ts.
  const [company, setCompany] = useState("");
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current ??= Date.now();
  }, []);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationId, setConfirmationId] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;

  // open days within the shop's booking horizon (maxAdvanceDays), capped for UI
  const days = useMemo(() => {
    const out: Date[] = [];
    let d = startOfDay(new Date());
    const horizon = Math.min(rules.maxAdvanceDays, 60);
    for (let i = 0; i <= horizon && out.length < 14; i++) {
      if (openDays.includes(d.getDay())) out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [openDays, rules.maxAdvanceDays]);

  const [activeDay, setActiveDay] = useState<Date>(days[0]);

  const eligibleBarbers = useMemo(
    () => (serviceId ? barbers.filter((b) => b.serviceIds.includes(serviceId)) : []),
    [serviceId, barbers],
  );

  // La disponibilidad se calcula en el SERVIDOR (vista busy_slots, sin PII).
  // "Cargando" es estado DERIVADO: la clave pedida aún no coincide con la
  // clave cargada — así el effect solo hace setState al resolver el fetch.
  const slotsKey = serviceId
    ? `${serviceId}|${barberId}|${activeDay.toISOString()}`
    : "";
  const [loaded, setLoaded] = useState<{ key: string; slots: Slot[] }>({
    key: "",
    slots: [],
  });
  const slotsLoading = slotsKey !== "" && loaded.key !== slotsKey;
  const slots = loaded.key === slotsKey ? loaded.slots : [];
  useEffect(() => {
    if (!slotsKey || !serviceId) return;
    let alive = true;
    getAvailability({
      shopSlug,
      serviceId,
      barberId,
      dateIso: activeDay.toISOString(),
    })
      .then((res) => {
        if (alive) setLoaded({ key: slotsKey, slots: res.ok ? res.slots : [] });
      })
      .catch(() => {
        if (alive) setLoaded({ key: slotsKey, slots: [] });
      });
    return () => {
      alive = false;
    };
  }, [slotsKey, shopSlug, serviceId, activeDay, barberId]);

  const slot = slotIso ? new Date(slotIso) : null;
  const chosenBarber =
    barberId === ANY_BARBER ? null : barbers.find((b) => b.id === barberId) ?? null;

  const emailOk =
    !rules.requireEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const canContinue =
    (step === 0 && !!serviceId) ||
    (step === 1 && !!barberId && eligibleBarbers.length > 0) ||
    (step === 2 && !!slotIso) ||
    (step === 3 &&
      form.name.trim().length > 1 &&
      form.phone.trim().length >= 8 &&
      emailOk);

  async function next() {
    setError(null);
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }
    // Final step: submit through the validated, rate-limited Server Action.
    if (!serviceId || !slotIso) return;
    setSubmitting(true);
    try {
      const res = await book({
        shopId,
        serviceId,
        barberId,
        slotIso,
        name: form.name,
        phone: form.phone,
        email: form.email,
        notes: form.notes,
        company,
        startedAt: startedAt.current ?? Date.now(),
      });
      if (res.ok) {
        setConfirmationId(res.confirmationId);
        setDone(true);
      } else {
        setError(res.error);
      }
    } catch {
      setError("No pudimos completar la reserva. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }
  function back() {
    if (step > 0) setStep((s) => s - 1);
  }

  if (done && service && slot) {
    return (
      <Success
        shopName={shopName}
        service={service}
        barber={chosenBarber}
        slot={slot}
        name={form.name}
        confirmationId={confirmationId}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Stepper */}
      <ol className="mb-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors",
                i < step && "bg-gold text-white",
                i === step && "bg-stone-900 text-white",
                i > step && "bg-stone-200 text-stone-500",
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={cn(
                "hidden text-sm font-medium sm:block",
                i <= step ? "text-ink" : "text-stone-400",
              )}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="mx-1 hidden h-px flex-1 bg-stone-200 sm:block" />
            )}
          </li>
        ))}
      </ol>

      {/* Step content */}
      <div className="min-h-[20rem]">
        {step === 0 && (
          <Step title="¿Qué te vas a hacer?" subtitle="Elige un servicio para empezar.">
            <div className="grid gap-3 sm:grid-cols-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    if (s.id === serviceId) return;
                    // Barbero y horario dependen del servicio: al cambiarlo dejan de ser válidos.
                    setServiceId(s.id);
                    setBarberId(ANY_BARBER);
                    setSlotIso(null);
                  }}
                  className={cn(
                    "group rounded-2xl border p-4 text-left transition-all",
                    serviceId === s.id
                      ? "border-gold bg-gold/[0.06] ring-1 ring-gold"
                      : "border-stone-200 bg-white hover:border-stone-400",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="flex items-center gap-1.5 font-semibold text-ink">
                        {s.name}
                        {s.popular && (
                          <span className="rounded-full bg-gold/12 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-gold">
                            Top
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-stone-500">{s.description}</p>
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border",
                        serviceId === s.id
                          ? "border-gold bg-gold text-white"
                          : "border-stone-300",
                      )}
                    >
                      {serviceId === s.id && <Check className="h-3 w-3" strokeWidth={3} />}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-sm">
                    <span className="font-semibold text-ink">{formatPrice(s.priceCents)}</span>
                    <span className="flex items-center gap-1 text-stone-500">
                      <Clock className="h-3.5 w-3.5" /> {formatDuration(s.durationMin)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step
            title="¿Con quién?"
            subtitle={
              rules.allowBarberChoice
                ? "Elige tu barbero o deja que asignemos al primero disponible."
                : "Te asignamos al primer barbero disponible."
            }
          >
            {eligibleBarbers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-300 py-10 text-center">
                <p className="text-sm text-stone-500">
                  Esta barbería aún no tiene barberos disponibles para este servicio.
                  Elige otro servicio o vuelve más tarde.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <BarberOption
                  selected={barberId === ANY_BARBER}
                  onClick={() => setBarberId(ANY_BARBER)}
                  any
                />
                {rules.allowBarberChoice &&
                  eligibleBarbers.map((b) => (
                    <BarberOption
                      key={b.id}
                      barber={b}
                      selected={barberId === b.id}
                      onClick={() => setBarberId(b.id)}
                    />
                  ))}
              </div>
            )}
          </Step>
        )}

        {step === 2 && (
          <Step title="¿Cuándo te acomoda?" subtitle="Elige el día y la hora disponible.">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
              {days.map((d) => {
                const active = d.toDateString() === activeDay.toDateString();
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => {
                      setActiveDay(d);
                      setSlotIso(null);
                    }}
                    className={cn(
                      "flex min-w-[4.5rem] shrink-0 flex-col items-center rounded-xl border px-3 py-2.5 transition-colors",
                      active
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:border-stone-400",
                    )}
                  >
                    <span className="text-[0.7rem] font-medium uppercase opacity-70">
                      {formatDayShort(d).split(" ")[0]}
                    </span>
                    <span className="text-lg font-semibold tnum">{d.getDate()}</span>
                  </button>
                );
              })}
            </div>

            <p className="mt-5 mb-2 text-sm font-medium capitalize text-stone-500">
              {formatDayLong(activeDay)}
            </p>
            {slotsLoading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-10 animate-pulse rounded-xl bg-stone-100"
                  />
                ))}
              </div>
            ) : slots.some((s) => s.available) ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <button
                    key={s.iso}
                    disabled={!s.available}
                    onClick={() => setSlotIso(s.iso)}
                    className={cn(
                      "tnum rounded-xl border py-2.5 text-sm font-semibold transition-all",
                      slotIso === s.iso
                        ? "border-gold bg-gold text-white"
                        : s.available
                          ? "border-stone-200 bg-white text-ink hover:border-stone-900"
                          : "cursor-not-allowed border-transparent bg-stone-100 text-stone-300 line-through",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-stone-300 py-10 text-center">
                <p className="text-sm text-stone-500">
                  No quedan horarios este día. Prueba otra fecha.
                </p>
              </div>
            )}
          </Step>
        )}

        {step === 3 && (
          <Step title="Tus datos" subtitle="Solo para confirmar y enviarte el recordatorio.">
            <div className="space-y-4">
              <Field icon={User} label="Nombre completo" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Andrés Vega"
                  className="w-full bg-transparent outline-none placeholder:text-stone-400"
                  autoComplete="name"
                />
              </Field>
              <Field icon={Phone} label="Teléfono / WhatsApp" required>
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="55 1234 5678"
                  inputMode="tel"
                  className="w-full bg-transparent outline-none placeholder:text-stone-400"
                  autoComplete="tel"
                />
              </Field>
              <Field
                icon={Mail}
                label={rules.requireEmail ? "Correo" : "Correo (opcional)"}
                required={rules.requireEmail}
              >
                <input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="andres@correo.com"
                  inputMode="email"
                  className="w-full bg-transparent outline-none placeholder:text-stone-400"
                  autoComplete="email"
                />
              </Field>

              {/* Aviso de privacidad (LFPDPPP): el cliente final debe saber
                  quién trata sus datos y para qué ANTES de enviarlos. El
                  proxy sirve /legal también en dominios de tenant. */}
              <p className="text-xs leading-relaxed text-stone-500">
                Usamos tus datos solo para gestionar tu cita y enviarte
                recordatorios. Al confirmar aceptas el{" "}
                <a
                  href="/legal/privacidad"
                  target="_blank"
                  rel="noopener"
                  className="font-medium text-stone-600 underline underline-offset-2 hover:text-ink"
                >
                  Aviso de Privacidad
                </a>
                .
              </p>

              {/* Honeypot — hidden from humans & a11y tree; only bots fill it. */}
              <div aria-hidden className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
                <label>
                  No llenar este campo
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </label>
              </div>
            </div>
          </Step>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive-bg px-3.5 py-2.5 text-sm font-medium text-destructive"
        >
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      {/* Summary + actions */}
      <div className="mt-8 flex items-center justify-between gap-4 border-t border-stone-200 pt-5">
        <div className="min-w-0 text-sm">
          {service ? (
            <p className="truncate font-semibold text-ink">
              {service.name} · {formatPrice(service.priceCents)}
            </p>
          ) : (
            <p className="text-stone-400">Selecciona un servicio</p>
          )}
          {slot && (
            <p className="truncate text-stone-500">
              {formatDayShort(slot)} · {String(slot.getHours()).padStart(2, "0")}:
              {String(slot.getMinutes()).padStart(2, "0")}
              {chosenBarber ? ` · ${chosenBarber.name}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <Button variant="ghost" size="md" onClick={back}>
              <ArrowLeft className="h-4 w-4" /> Atrás
            </Button>
          )}
          <Button size="md" onClick={next} disabled={!canContinue || submitting}>
            {step === 3
              ? submitting
                ? "Confirmando…"
                : "Confirmar cita"
              : "Continuar"}
            {step < 3 && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Step({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="animate-rise">
      <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-1 mb-6 text-stone-500">{subtitle}</p>
      {children}
    </div>
  );
}

function BarberOption({
  barber,
  selected,
  onClick,
  any,
}: {
  barber?: Barber;
  selected: boolean;
  onClick: () => void;
  any?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all",
        selected
          ? "border-gold bg-gold/[0.06] ring-1 ring-gold"
          : "border-stone-200 bg-white hover:border-stone-400",
      )}
    >
      {any ? (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-stone-900 text-gold-400">
          <Sparkles className="h-5 w-5" />
        </span>
      ) : (
        <Avatar name={barber!.name} accent={barber!.accent} size={44} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">
          {any ? "Cualquiera disponible" : barber!.name}
        </p>
        <p className="truncate text-sm text-stone-500">
          {any ? "Te asignamos al primero libre" : barber!.role}
        </p>
      </div>
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-full border",
          selected ? "border-gold bg-gold text-white" : "border-stone-300",
        )}
      >
        {selected && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
    </button>
  );
}

function Field({
  icon: Icon,
  label,
  required,
  children,
}: {
  icon: typeof User;
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-stone-600">
        {label}
        {required && <span className="text-gold"> *</span>}
      </span>
      <span className="flex items-center gap-2.5 rounded-xl border border-stone-200 bg-white px-3.5 py-3 focus-within:border-gold focus-within:ring-1 focus-within:ring-gold">
        <Icon className="h-4 w-4 shrink-0 text-stone-400" />
        {children}
      </span>
    </label>
  );
}

function Success({
  shopName,
  service,
  barber,
  slot,
  name,
  confirmationId,
}: {
  shopName: string;
  service: Service;
  barber: Barber | null;
  slot: Date;
  name: string;
  confirmationId: string | null;
}) {
  return (
    <div className="mx-auto max-w-md animate-rise text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-success-bg text-success ring-8 ring-success/5">
        <Check className="h-8 w-8" strokeWidth={2.5} />
      </span>
      <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-ink">
        ¡Cita confirmada!
      </h2>
      <p className="mt-2 text-stone-500">
        {name.split(" ")[0]}, te esperamos en {shopName}. Te enviamos el recordatorio
        por WhatsApp.
      </p>

      <div className="mt-7 rounded-2xl border border-stone-200 bg-white p-5 text-left">
        <Row icon={Scissors} label="Servicio" value={`${service.name} · ${formatPrice(service.priceCents)}`} />
        <Row icon={User} label="Barbero" value={barber ? barber.name : "Primero disponible"} />
        <Row
          icon={Clock}
          label="Cuándo"
          value={`${formatDayLong(slot)}, ${String(slot.getHours()).padStart(2, "0")}:${String(
            slot.getMinutes(),
          ).padStart(2, "0")}`}
        />
      </div>

      {confirmationId && (
        <p className="mt-4 text-sm text-stone-500">
          Folio de confirmación:{" "}
          <span className="tnum font-semibold text-ink">{confirmationId}</span>
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button variant="outline" onClick={() => location.reload()}>
          Agendar otra cita
        </Button>
        <Button variant="dark" onClick={() => (location.href = "/")}>
          Volver al inicio
        </Button>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 border-stone-100 py-2 [&:not(:last-child)]:border-b">
      <Icon className="h-4 w-4 text-stone-400" />
      <span className="w-20 text-sm text-stone-500">{label}</span>
      <span className="flex-1 text-right text-sm font-medium capitalize text-ink">
        {value}
      </span>
    </div>
  );
}
