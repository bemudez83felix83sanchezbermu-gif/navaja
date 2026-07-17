import Stripe from "stripe";
import { env } from "@/lib/security/env";
import { dbAdmin } from "@/lib/db";
import type { Invoice, PlanId } from "@/lib/data/types";

/**
 * Cliente de Stripe Billing para el Track B de PAGOS.md — las SUSCRIPCIONES
 * del SaaS (barbería → Navaja). Cuenta única de Navaja, sin Connect: nada que
 * ver con los anticipos de reserva (Track A, `mp.ts`), que van a la cuenta MP
 * de cada barbería.
 *
 * Contrato:
 *  - Esta capa es la única que toca el SDK; actions y webhook usan estas
 *    funciones tipadas.
 *  - Checkout y Customer Portal hospedados por Stripe (cero alcance PCI).
 *  - El customer se crea LAZY en el primer checkout y se persiste en
 *    `barbershops.stripe_customer_id`.
 *  - Trial sin tarjeta por delante (decidido 2026-07-16): el estado `prueba`
 *    vive app-side en `subscriptions`; Stripe entra solo al convertir.
 *  - Facturas: NO se almacenan — se leen de la API al vuelo.
 *  - Sin las env vars el panel opera en modo demo (cambio de plan directo en
 *    DB, sin cobro) para que `main` siga funcional en dev.
 */

let _stripe: Stripe | null = null;

/** ¿Está el billing real habilitado? (env completa). */
export function stripeConfigured(): boolean {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_PRICE_ESENCIAL &&
      env.STRIPE_PRICE_PRO &&
      env.STRIPE_PRICE_ESTUDIO,
  );
}

/** Singleton del SDK. Lanza si falta la llave (los callers gatean antes). */
export function getStripeClient(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY no está configurada.");
  }
  return (_stripe ??= new Stripe(env.STRIPE_SECRET_KEY));
}

function baseUrl(): string {
  const u =
    env.NEXT_PUBLIC_APP_URL ??
    (env.NODE_ENV !== "production" ? "http://localhost:3000" : null);
  if (!u) throw new Error("NEXT_PUBLIC_APP_URL no está configurada.");
  return u.replace(/\/$/, "");
}

/* ------------------------------------------------------------------ *
 * Mapeo plan ⇄ price (espejo de src/lib/data/plans.ts en la cuenta)
 * ------------------------------------------------------------------ */

function priceForPlan(plan: PlanId): string {
  const price = {
    esencial: env.STRIPE_PRICE_ESENCIAL,
    pro: env.STRIPE_PRICE_PRO,
    estudio: env.STRIPE_PRICE_ESTUDIO,
  }[plan];
  if (!price) throw new Error(`STRIPE_PRICE_${plan.toUpperCase()} no está configurada.`);
  return price;
}

/** Inverso: el webhook resuelve a qué plan local corresponde un price. */
export function planForPrice(priceId: string | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === env.STRIPE_PRICE_ESENCIAL) return "esencial";
  if (priceId === env.STRIPE_PRICE_PRO) return "pro";
  if (priceId === env.STRIPE_PRICE_ESTUDIO) return "estudio";
  return null;
}

/* ------------------------------------------------------------------ *
 * Customer por barbería (lazy)
 * ------------------------------------------------------------------ */

interface ShopBillingRow {
  id: string;
  slug: string;
  name: string;
  owner_email: string | null;
  stripe_customer_id: string | null;
}

async function shopBillingRow(shopId: string): Promise<ShopBillingRow> {
  const { data, error } = await dbAdmin()
    .from("barbershops")
    .select("id, slug, name, owner_email, stripe_customer_id")
    .eq("id", shopId)
    .maybeSingle();
  if (error) throw new Error(`[db:stripe.shop] ${error.message}`);
  if (!data) throw new Error("Barbería inválida.");
  return data as ShopBillingRow;
}

/** Webhook: ¿de qué barbería es este customer? */
export async function shopIdForStripeCustomer(customerId: string): Promise<string | null> {
  const { data, error } = await dbAdmin()
    .from("barbershops")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (error) throw new Error(`[db:stripe.customer] ${error.message}`);
  return (data?.id as string) ?? null;
}

async function ensureCustomer(shopId: string): Promise<string> {
  const shop = await shopBillingRow(shopId);
  if (shop.stripe_customer_id) return shop.stripe_customer_id;

  const customer = await getStripeClient().customers.create({
    name: shop.name,
    email: shop.owner_email ?? undefined,
    metadata: { barbershop_id: shop.id, slug: shop.slug },
  });

  const { error } = await dbAdmin()
    .from("barbershops")
    .update({ stripe_customer_id: customer.id })
    .eq("id", shopId);
  if (error) throw new Error(`[db:stripe.customer.save] ${error.message}`);
  return customer.id;
}

/* ------------------------------------------------------------------ *
 * Checkout y Customer Portal
 * ------------------------------------------------------------------ */

/**
 * Sesión de Checkout para contratar `plan` (upgrade / primera suscripción).
 * El webhook (`checkout.session.completed` + `customer.subscription.updated`)
 * es quien actualiza `subscriptions` — el redirect del navegador no confirma nada.
 */
export async function createPlanCheckout(input: {
  shopId: string;
  plan: PlanId;
}): Promise<string> {
  const customer = await ensureCustomer(input.shopId);
  const returnTo = `${baseUrl()}/dashboard/configuracion/plan`;

  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: priceForPlan(input.plan), quantity: 1 }],
    success_url: `${returnTo}?checkout=exito`,
    cancel_url: `${returnTo}?checkout=cancelado`,
    client_reference_id: input.shopId,
    subscription_data: {
      metadata: { barbershop_id: input.shopId, plan_id: input.plan },
    },
    metadata: { barbershop_id: input.shopId, plan_id: input.plan },
  });

  if (!session.url) throw new Error("Stripe no devolvió URL de checkout.");
  return session.url;
}

/**
 * Sesión del Customer Portal: cambio de plan, tarjeta y cancelación viven en
 * la UI hospedada de Stripe — no construimos esa superficie.
 */
export async function createPortalSession(shopId: string): Promise<string> {
  const shop = await shopBillingRow(shopId);
  if (!shop.stripe_customer_id) {
    throw new Error("Esta barbería aún no tiene facturación en Stripe.");
  }
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: shop.stripe_customer_id,
    return_url: `${baseUrl()}/dashboard/configuracion/plan`,
  });
  return session.url;
}

/* ------------------------------------------------------------------ *
 * Facturas (lectura al vuelo — no se almacenan)
 * ------------------------------------------------------------------ */

export async function listShopInvoices(shopId: string): Promise<Invoice[]> {
  const shop = await shopBillingRow(shopId);
  if (!shop.stripe_customer_id) return [];

  const { data } = await getStripeClient().invoices.list({
    customer: shop.stripe_customer_id,
    limit: 12,
  });

  return data
    .filter((inv) => inv.status === "paid" || inv.status === "open")
    .map((inv) => ({
      id: inv.number ?? inv.id ?? "—",
      date: new Date(inv.created * 1000).toISOString(),
      amountCents: inv.amount_paid || inv.amount_due,
      status: inv.status === "paid" ? ("pagada" as const) : ("pendiente" as const),
      url: inv.hosted_invoice_url ?? undefined,
    }));
}
