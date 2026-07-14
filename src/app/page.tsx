import {
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  Clock,
  Scissors,
  ShieldCheck,
  Smartphone,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { BarberPole } from "@/components/brand/BarberPole";
import { SiteNav } from "@/components/landing/SiteNav";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { AgendaPreview } from "@/components/landing/AgendaPreview";

export default function LandingPage() {
  return (
    <div className="bg-stone-950">
      <SiteNav />
      <main>
        <Hero />
        <Trust />
        <Features />
        <Steps />
        <Pricing />
        <FinalCTA />
      </main>
      <SiteFooter />
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Hero() {
  return (
    <section className="grain relative overflow-hidden bg-stone-950 pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* ambient glow */}
      <div className="glow-gold pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-0 h-[42rem] w-[42rem] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #ca8a04, transparent 60%)" }}
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-stone-300 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" />
            Nuevo · Recordatorios automáticos por WhatsApp
          </span>

          <h1 className="mt-6 font-display text-5xl font-semibold leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
            Tu silla,
            <br />
            <span className="text-gradient-gold">siempre llena.</span>
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-stone-300">
            Navaja es la agenda online para barberías. Tus clientes reservan en 30
            segundos, tú llenas los huecos y olvídate de las llamadas y las
            inasistencias.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/dashboard" size="lg" className="rounded-full">
              Crear mi barbería
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <ButtonLink
              href="/el-filo"
              size="lg"
              variant="outline"
              className="rounded-full border-white/15 bg-white/5 text-white hover:border-white/40 hover:bg-white/10"
            >
              Ver demo de reserva
            </ButtonLink>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-stone-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="flex">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-gold-400 text-gold-400" />
                ))}
              </span>
              <span className="font-semibold text-white">4.9</span> · 1,200+ barberías
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-gold-400" />
              14 días gratis, sin tarjeta
            </span>
          </div>
        </div>

        <div className="relative flex justify-center lg:justify-end">
          <div
            aria-hidden
            className="absolute -inset-6 -z-0 rounded-[2rem] opacity-60 blur-2xl"
            style={{
              background:
                "radial-gradient(50% 50% at 50% 40%, rgb(161 98 7 / 0.35), transparent 70%)",
            }}
          />
          <div className="relative animate-rise [animation-delay:120ms]">
            <AgendaPreview />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Trust() {
  const names = ["El Filo", "Don Bigote", "La Navaja", "Costa Barber", "Norte 33", "Atelier"];
  return (
    <section className="border-y border-white/5 bg-stone-950 py-10">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-stone-500">
          Barberías que ya no pierden citas
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-70">
          {names.map((n) => (
            <span
              key={n}
              className="font-display text-xl font-semibold tracking-tight text-stone-400"
            >
              {n}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
const FEATURES = [
  {
    icon: CalendarDays,
    title: "Agenda visual por barbero",
    desc: "Ve el día completo de cada silla de un vistazo. Arrastra, reagenda y bloquea horarios en segundos.",
    span: "lg:col-span-2",
  },
  {
    icon: Smartphone,
    title: "Reservas 24/7",
    desc: "Tu página de reservas funciona mientras duermes. Sin apps que instalar.",
    span: "",
  },
  {
    icon: Bell,
    title: "Recordatorios automáticos",
    desc: "WhatsApp y SMS que reducen las inasistencias hasta un 70%.",
    span: "",
  },
  {
    icon: Users,
    title: "Ficha de cada cliente",
    desc: "Historial, preferencias y notas. Que cada corte se sienta personal.",
    span: "",
  },
  {
    icon: TrendingUp,
    title: "Métricas que importan",
    desc: "Ocupación, ingresos del día y servicios estrella, sin hojas de cálculo.",
    span: "lg:col-span-2",
  },
];

function Features() {
  return (
    <section id="funciones" className="relative bg-stone-950 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="max-w-2xl">
          <span className="text-sm font-semibold uppercase tracking-widest text-gold-400">
            Funciones
          </span>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Todo el agendamiento. Nada de relleno.
          </h2>
          <p className="mt-4 text-lg text-stone-400">
            Navaja hace una sola cosa y la hace impecable: mantener tu agenda llena
            y ordenada.
          </p>
        </header>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className={`group relative overflow-hidden rounded-2xl border border-white/8 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 transition-colors hover:border-gold/30 ${f.span}`}
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/12 text-gold-400 ring-1 ring-gold/20">
                <f.icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <h3 className="mt-5 text-lg font-semibold text-white">{f.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-stone-400">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
const STEPS = [
  { n: "01", title: "Elige tu servicio", desc: "Corte, barba o el combo. El cliente ve duración y precio claros." },
  { n: "02", title: "Escoge barbero y hora", desc: "Solo se muestran los huecos realmente disponibles. Cero choques." },
  { n: "03", title: "Listo, confirmado", desc: "Recibe la cita en tu agenda y el cliente su recordatorio. Sin llamadas." },
];

function Steps() {
  return (
    <section id="como-funciona" className="relative overflow-hidden bg-stone-900 py-24 sm:py-28">
      <BarberPole className="absolute inset-x-0 top-0" />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-gold-400">
            Cómo funciona
          </span>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Reservar toma 30 segundos
          </h2>
          <p className="mt-4 text-lg text-stone-400">
            Para tu cliente es así de simple. Para ti, una agenda que se llena sola.
          </p>
        </header>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              <div className="flex items-center gap-4">
                <span className="font-display text-5xl font-semibold text-gold/30">
                  {s.n}
                </span>
                {i < STEPS.length - 1 && (
                  <span className="hidden h-px flex-1 bg-gradient-to-r from-gold/40 to-transparent md:block" />
                )}
              </div>
              <h3 className="mt-4 text-xl font-semibold text-white">{s.title}</h3>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-stone-400">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <ButtonLink href="/el-filo" size="lg" className="rounded-full">
            Probar el flujo de reserva
            <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
const PLANS = [
  {
    name: "Solo",
    price: "$0",
    period: "/mes",
    tagline: "Para el barbero independiente.",
    features: ["1 barbero", "Reservas ilimitadas", "Página de reservas", "Recordatorios por correo"],
    cta: "Empezar gratis",
    highlight: false,
  },
  {
    name: "Barbería",
    price: "$399",
    period: "/mes",
    tagline: "Para el equipo que crece.",
    features: ["Hasta 8 barberos", "Recordatorios WhatsApp + SMS", "Métricas y reportes", "Fichas de cliente", "Sin comisión por cita"],
    cta: "Probar 14 días gratis",
    highlight: true,
  },
  {
    name: "Cadena",
    price: "A medida",
    period: "",
    tagline: "Varias sucursales, una agenda.",
    features: ["Barberos ilimitados", "Multi-sucursal", "Roles y permisos", "Soporte prioritario"],
    cta: "Hablar con ventas",
    highlight: false,
  },
];

function Pricing() {
  return (
    <section id="precios" className="bg-stone-950 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-widest text-gold-400">
            Precios
          </span>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Un precio justo. Sin comisiones por cita.
          </h2>
          <p className="mt-4 text-lg text-stone-400">
            Lo que reservas es tuyo. Cancela cuando quieras.
          </p>
        </header>

        <div className="mt-14 grid items-stretch gap-5 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-2xl border p-7 ${
                p.highlight
                  ? "border-gold/40 bg-gradient-to-b from-gold/[0.10] to-stone-900 shadow-[0_20px_60px_-20px_rgb(161_98_7/0.5)]"
                  : "border-white/8 bg-white/[0.03]"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gold px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Más elegido
                </span>
              )}
              <h3 className="text-lg font-semibold text-white">{p.name}</h3>
              <p className="mt-1 text-sm text-stone-400">{p.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-semibold text-white">
                  {p.price}
                </span>
                <span className="text-sm text-stone-400">{p.period}</span>
              </div>
              <ul className="mt-6 space-y-3 text-sm text-stone-300">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
              <ButtonLink
                href="/dashboard"
                className={`mt-7 w-full rounded-full ${
                  p.highlight ? "" : "bg-white/10 text-white shadow-none hover:bg-white/15"
                }`}
                variant={p.highlight ? "primary" : "dark"}
              >
                {p.cta}
              </ButtonLink>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function FinalCTA() {
  return (
    <section className="bg-stone-950 px-5 pb-24 sm:px-8">
      <div className="grain relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-gold/20 bg-gradient-to-br from-stone-900 to-stone-950 px-8 py-16 text-center sm:py-20">
        <div className="glow-gold pointer-events-none absolute inset-0" />
        <div className="relative">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold/15 text-gold-400 ring-1 ring-gold/25">
            <Scissors className="h-6 w-6" />
          </span>
          <h2 className="mx-auto mt-6 max-w-2xl font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Deja de perder cortes por una agenda en papel.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-stone-300">
            Monta tu barbería en Navaja en menos de 10 minutos. Gratis los primeros
            14 días.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/dashboard" size="lg" className="rounded-full">
              Crear mi barbería
              <ArrowRight className="h-4 w-4" />
            </ButtonLink>
            <span className="inline-flex items-center gap-1.5 text-sm text-stone-400">
              <Clock className="h-4 w-4" /> Configúralo hoy mismo
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
