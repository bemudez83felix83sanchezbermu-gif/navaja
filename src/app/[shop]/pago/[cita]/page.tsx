import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppointmentPaymentStatus, getShopBySlug } from "@/lib/data/queries";
import { uuidSchema } from "@/lib/security/validation";
import { Logo } from "@/components/brand/Logo";
import { PaymentReturn } from "@/components/booking/PaymentReturn";

/**
 * Retorno del Checkout Pro de Mercado Pago.
 *
 * Se llega aquí de tres formas (todas terminan en el mismo estado real):
 *   - back_urls.success/pending/failure de la preferencia;
 *   - un click del cliente en su email;
 *   - refresh manual desde el navegador.
 *
 * La única fuente de verdad es la base de datos (actualizada por el webhook).
 * No leemos ningún query param del redirect — MP los expone al navegador y
 * son manipulables. El componente cliente polea el estado hasta 'confirmada'
 * o 'cancelada'.
 */
type Params = { params: Promise<{ shop: string; cita: string }> };

export async function generateMetadata({ params }: Params) {
  const { shop } = await params;
  const s = await getShopBySlug(shop);
  return { title: s ? `Pago — ${s.name}` : "Pago" };
}

export default async function PaymentReturnPage({ params }: Params) {
  const { shop: slug, cita } = await params;

  const shop = await getShopBySlug(slug);
  if (!shop) notFound();

  const idParsed = uuidSchema.safeParse(cita);
  if (!idParsed.success) notFound();

  const status = await getAppointmentPaymentStatus(slug, idParsed.data);
  if (!status) notFound();

  return (
    <div className="min-h-dvh bg-cream">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href={`/${slug}`} aria-label={shop.name}>
            <Logo />
          </Link>
          <span className="text-sm text-stone-500">{shop.name}</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8">
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-[var(--shadow-card)] sm:p-12">
          <PaymentReturn
            shopSlug={slug}
            appointmentId={idParsed.data}
            initialStatus={status.status}
            initialExpiresAt={status.paymentExpiresAt}
          />
        </div>
        <p className="mt-6 text-center text-xs text-stone-400">
          Powered by <span className="font-semibold text-stone-500">Navaja</span>
        </p>
      </main>
    </div>
  );
}
