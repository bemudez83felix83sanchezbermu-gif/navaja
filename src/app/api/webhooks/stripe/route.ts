import type Stripe from "stripe";
import { env } from "@/lib/security/env";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { dbAdmin } from "@/lib/db";
import {
  getStripeClient,
  planForPrice,
  shopIdForStripeCustomer,
} from "@/lib/payments/stripe";
import { syncStripeSubscription } from "@/lib/data/queries";
import type { Subscription } from "@/lib/data/types";

/**
 * Webhook de Stripe Billing (Track B de PAGOS.md) — mismo contrato de defensa
 * que el de Mercado Pago (../mercadopago/route.ts):
 *   1. Rate-limit generoso: Stripe reintenta desde IPs variables; la defensa
 *      real es la firma.
 *   2. Body CRUDO antes de todo: `constructEvent` verifica la firma sobre el
 *      string exacto — parsear antes la rompe (el bug clásico de este webhook).
 *   3. Idempotencia por `event.id` en `stripe_events` (insert + 23505 = ya
 *      procesado). Stripe puede duplicar entregas.
 *   4. El estado local se sincroniza SOLO desde `customer.subscription.*` (el
 *      objeto va firmado). `invoice.paid` no hace falta: cada renovación llega
 *      también como subscription.updated con el nuevo period_end.
 *   5. `invoice.payment_failed` = gracia: no tocamos el estado; Stripe
 *      reintenta el cobro y, si se agota, manda subscription.updated|deleted
 *      con el estado final.
 *
 * Runtime Node: el SDK de Stripe no corre en edge.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stripe → estados locales (check constraint de `subscriptions`). */
function localStatus(s: Stripe.Subscription.Status): Subscription["status"] | null {
  switch (s) {
    case "trialing":
      return "prueba";
    case "active":
    case "past_due": // gracia — Stripe sigue reintentando el cobro
      return "activa";
    case "canceled":
    case "unpaid":
    case "paused":
      return "cancelada";
    // Checkout abandonado a medias: nunca hubo cobro, no pisamos la fila local.
    case "incomplete":
    case "incomplete_expired":
      return null;
  }
}

async function syncFromSubscription(sub: Stripe.Subscription): Promise<void> {
  const status = localStatus(sub.status);
  if (!status) return;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const shopId =
    sub.metadata?.barbershop_id || (await shopIdForStripeCustomer(customerId));
  if (!shopId) {
    console.warn(`[stripe-webhook] suscripción ${sub.id} sin barbería conocida`);
    return;
  }

  const item = sub.items.data[0];
  await syncStripeSubscription({
    barbershopId: shopId,
    planId: planForPrice(item?.price?.id),
    status,
    stripeSubscriptionId: sub.id,
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
  });
}

export async function POST(req: Request) {
  // 1) Rate-limit generoso — la firma es la defensa real.
  const rl = rateLimit(`stripe-webhook:${clientIp(req.headers)}`, {
    limit: 300,
    windowMs: 60_000,
  });
  if (!rl.success) return new Response("rate_limited", { status: 429 });

  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY) {
    // 503: "temporalmente sin capacidad" — Stripe reintentará, no perdemos el aviso.
    return new Response("not_configured", { status: 503 });
  }

  // 2) Firma sobre el body crudo.
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(
      raw,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return new Response("bad_signature", { status: 401 });
  }

  // 3) Idempotencia por event.id.
  const { error: dupErr } = await dbAdmin()
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (dupErr) {
    if (dupErr.code === "23505") return new Response("already_processed", { status: 200 });
    console.error("[stripe-webhook] stripe_events insert failed:", dupErr);
    return new Response("db_error", { status: 500 });
  }

  try {
    switch (event.type) {
      // 4) Alta vía Checkout: la suscripción va referida en la sesión; el
      //    subscription.updated que la acompaña puede llegar antes o después,
      //    así que sincronizamos aquí también (la operación es idempotente).
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode !== "subscription" || !session.subscription) break;
        const subId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
        const sub = await getStripeClient().subscriptions.retrieve(subId);
        await syncFromSubscription(sub);
        break;
      }

      // El alta emite `created` (no `updated`); llega junto con el
      // checkout.session.completed pero el orden no está garantizado.
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await syncFromSubscription(event.data.object);
        break;
      }

      // 5) Cobro fallido = periodo de gracia; el estado final llega por
      //    subscription.updated|deleted cuando Stripe agote los reintentos.
      case "invoice.payment_failed": {
        console.warn(
          `[stripe-webhook] cobro fallido para customer ${String(
            event.data.object.customer,
          )} — en gracia, Stripe reintenta`,
        );
        break;
      }

      default:
        break; // evento que no nos interesa — 200 para que no reintente
    }
  } catch (e) {
    console.error(`[stripe-webhook] fallo procesando ${event.type}:`, e);
    // Quitamos la marca de idempotencia para que el reintento de Stripe
    // pueda procesarlo de verdad (si no, el retry saldría por 'already_processed').
    await dbAdmin().from("stripe_events").delete().eq("id", event.id);
    return new Response("processing_error", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}
