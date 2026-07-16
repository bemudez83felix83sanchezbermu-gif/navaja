import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Star, Clock } from "lucide-react";
import {
  getBarbers,
  getBookingRules,
  getServices,
  getShopBySlug,
} from "@/lib/data/queries";
import { Logo } from "@/components/brand/Logo";
import { BarberPole } from "@/components/brand/BarberPole";
import { BookingWizard } from "@/components/booking/BookingWizard";

type Params = { params: Promise<{ shop: string }> };

export async function generateMetadata({ params }: Params) {
  const { shop } = await params;
  const s = await getShopBySlug(shop);
  if (!s) return { title: "Barbería no encontrada" };
  return {
    title: `Reservar en ${s.name}`,
    description: `Agenda tu cita en ${s.name} en 30 segundos.`,
  };
}

export default async function BookingPage({ params }: Params) {
  // Resolución de tenant: slugs desconocidos → 404. Los datos vienen de la DB
  // con RLS de lectura pública (solo servicios y barberos activos).
  const { shop: slug } = await params;
  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const [services, barbers, rules] = await Promise.all([
    getServices({ slug }),
    getBarbers({ slug }),
    getBookingRules(slug),
  ]);

  return (
    <div className="min-h-dvh bg-cream">
      {/* Branded header */}
      <header className="grain relative overflow-hidden bg-stone-950 text-white">
        <div className="glow-gold pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-5xl px-5 py-6 sm:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" aria-label="Navaja">
              <Logo tone="light" />
            </Link>
            <a
              href={`tel:${shop.phone.replace(/\s/g, "")}`}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-stone-200 backdrop-blur transition-colors hover:bg-white/10"
            >
              Llamar
            </a>
          </div>

          <div className="mt-8 pb-8">
            <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
              {shop.name}
            </h1>
            <p className="mt-2 text-stone-300">{shop.tagline}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-stone-300">
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-gold-400 text-gold-400" />
                <span className="font-semibold text-white">{shop.rating}</span>
                <span className="text-stone-400">({shop.reviews} reseñas)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-gold-400" /> {shop.address}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-gold-400" /> Lun–Sáb · {shop.openHour}:00–
                {shop.closeHour}:00
              </span>
            </div>
          </div>
        </div>
        <BarberPole />
      </header>

      {/* Wizard */}
      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-[var(--shadow-card)] sm:p-10">
          <BookingWizard
            shopId={shop.id}
            shopSlug={shop.slug}
            shopName={shop.name}
            openDays={shop.openDays}
            services={services}
            barbers={barbers}
            rules={rules}
          />
        </div>
        <p className="mt-6 text-center text-xs text-stone-400">
          Powered by <span className="font-semibold text-stone-500">Navaja</span> · Tus
          datos solo se usan para gestionar tu cita.
        </p>
      </main>
    </div>
  );
}
