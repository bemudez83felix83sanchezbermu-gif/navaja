import { MercadoPagoConfig, Preference, Payment, PaymentRefund } from "mercadopago";
import { env } from "@/lib/security/env";
import { dbAdmin } from "@/lib/db";
import {
  getPaymentAccountSecrets,
  type PaymentAccountSecrets,
} from "@/lib/data/queries";
import { encryptToken } from "@/lib/security/crypto";

/**
 * Cliente de Mercado Pago para el Track A de PAGOS.md — Navaja NO cobra fee,
 * así que todo se hace CON EL TOKEN DEL VENDEDOR (cada barbería). Esta capa
 * es la única que toca el SDK; el webhook y el server action solo tocan estas
 * funciones tipadas.
 *
 * Contrato:
 *  - Nada de tokens en el cliente ni en logs. El acceso token se lee vía
 *    `getPaymentAccountSecrets` (columnas `_enc` desencriptadas server-side).
 *  - Renovación LAZY: si el token de la barbería expira en <30 días, se
 *    intercambia el refresh_token por uno nuevo antes de cada operación.
 *    Si el refresh falla → `payment_accounts.status = 'error_refresh'` +
 *    error propagado al caller para que muestre el banner de reconectar.
 *  - Los montos van en CENTAVOS internamente; MP recibe unidades (pesos con
 *    2 decimales). La conversión es explícita en `centsToUnits`.
 */

const OAUTH_TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const REFRESH_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function requireBaseUrl(): string {
  const u = env.NEXT_PUBLIC_APP_URL;
  if (!u) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL no está configurada (p. ej. https://navaja.app o " +
        "el túnel de dev).",
    );
  }
  return u.replace(/\/$/, "");
}

function centsToUnits(cents: number): number {
  // MP acepta 2 decimales — este redondeo es final; el número de centavos
  // ya fue calculado server-side (RPC book_appointment).
  return Math.round(cents) / 100;
}

/**
 * Devuelve el access_token vigente de la barbería, renovando lazy si el token
 * está por expirar. Si el refresh falla, marca la cuenta como `error_refresh`
 * y lanza — el caller debe presentar UI de reconectar. La función es la
 * fuente única de la verdad para "¿qué token uso para operar como esta shop?".
 */
async function ensureFreshToken(shopId: string): Promise<PaymentAccountSecrets> {
  const acc = await getPaymentAccountSecrets(shopId);
  if (!acc) throw new Error("Esta barbería no tiene cuenta de Mercado Pago conectada.");
  if (acc.status !== "activa") {
    throw new Error("La cuenta de Mercado Pago necesita reconectarse.");
  }

  const msLeft = new Date(acc.tokenExpiresAt).getTime() - Date.now();
  if (msLeft > REFRESH_THRESHOLD_MS) return acc;

  // Renovación: MP invalida el refresh anterior tras usarlo. Fallar aquí y
  // dejar el `access_token` viejo NO es opción — puede quedar sin refresh en
  // el próximo intento. Marcamos el error y propagamos.
  if (!env.MP_CLIENT_ID || !env.MP_CLIENT_SECRET) {
    throw new Error("Faltan MP_CLIENT_ID / MP_CLIENT_SECRET en el entorno.");
  }
  try {
    const res = await fetch(OAUTH_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        client_id: env.MP_CLIENT_ID,
        client_secret: env.MP_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: acc.refreshToken,
      }),
    });
    if (!res.ok) throw new Error(`refresh HTTP ${res.status}`);
    const tok = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    const expiresAt = new Date(Date.now() + tok.expires_in * 1000).toISOString();
    await dbAdmin()
      .from("payment_accounts")
      .update({
        access_token_enc: encryptToken(tok.access_token),
        refresh_token_enc: encryptToken(tok.refresh_token),
        token_expires_at: expiresAt,
        status: "activa",
        updated_at: new Date().toISOString(),
      })
      .eq("barbershop_id", shopId);
    return { ...acc, accessToken: tok.access_token, refreshToken: tok.refresh_token,
             tokenExpiresAt: expiresAt };
  } catch (e) {
    await dbAdmin()
      .from("payment_accounts")
      .update({ status: "error_refresh", updated_at: new Date().toISOString() })
      .eq("barbershop_id", shopId);
    throw new Error(
      "No pudimos renovar el token de Mercado Pago. Reconecta la cuenta.",
      { cause: e },
    );
  }
}

function mpConfig(accessToken: string): MercadoPagoConfig {
  return new MercadoPagoConfig({
    accessToken,
    options: { timeout: 10_000 },
  });
}

/**
 * Crea la preferencia de Checkout Pro con el token del VENDEDOR (la barbería),
 * sin marketplace_fee — el dinero cae 100% en su cuenta MP. `external_reference`
 * = id de la cita: es como el webhook luego encuentra a qué cita corresponde
 * el pago.
 */
export async function createCheckoutPreference(input: {
  shopId: string;
  appointmentId: string;
  amountCents: number;
  serviceTitle: string;
  payerEmail?: string;
  shopSlug: string;
  /** ISO — mismo hold de 15 min que fija la RPC. */
  expiresAtIso: string;
}): Promise<{ initPoint: string; preferenceId: string }> {
  const acc = await ensureFreshToken(input.shopId);
  const base = requireBaseUrl();
  const preference = new Preference(mpConfig(acc.accessToken));

  const result = await preference.create({
    body: {
      items: [
        {
          id: input.appointmentId,
          title: input.serviceTitle,
          quantity: 1,
          unit_price: centsToUnits(input.amountCents),
          currency_id: "MXN",
        },
      ],
      external_reference: input.appointmentId,
      notification_url: `${base}/api/webhooks/mercadopago`,
      back_urls: {
        success: `${base}/${input.shopSlug}/pago/${input.appointmentId}`,
        pending: `${base}/${input.shopSlug}/pago/${input.appointmentId}`,
        failure: `${base}/${input.shopSlug}/pago/${input.appointmentId}`,
      },
      auto_return: "approved",
      date_of_expiration: input.expiresAtIso,
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      // sandbox vs producción lo decide la naturaleza del access_token
      // (APP_USR-... vs TEST-...); el SDK usa el mismo endpoint.
    },
  });

  if (!result.id || !result.init_point) {
    throw new Error("MP no devolvió init_point");
  }
  return { initPoint: result.init_point, preferenceId: result.id };
}

/**
 * Consulta el estado real del pago en MP con el token del vendedor. NUNCA
 * confiamos en el body del webhook para decidir estado — el body solo trae
 * el id; la verdad viene de la API. Devuelve un shape mínimo para el caller.
 */
export interface MpPaymentView {
  id: string;
  status:
    | "approved"
    | "authorized"
    | "in_process"
    | "in_mediation"
    | "rejected"
    | "cancelled"
    | "refunded"
    | "charged_back";
  externalReference: string | null;
  transactionAmountCents: number;
  raw: unknown;
}

export async function getMpPayment(input: {
  shopId: string;
  paymentId: string;
}): Promise<MpPaymentView> {
  const acc = await ensureFreshToken(input.shopId);
  const payment = new Payment(mpConfig(acc.accessToken));
  const res = await payment.get({ id: input.paymentId });
  return {
    id: String(res.id),
    status: (res.status ?? "in_process") as MpPaymentView["status"],
    externalReference: res.external_reference ?? null,
    transactionAmountCents: Math.round((res.transaction_amount ?? 0) * 100),
    raw: res,
  };
}

/**
 * Reembolso total. Se usa en dos casos:
 *  - carrera cancela-vs-confirma (pago aprobado que llegó tarde);
 *  - cancelación dentro de la ventana permitida por el dueño.
 */
export async function refundMpPayment(input: {
  shopId: string;
  paymentId: string;
}): Promise<void> {
  const acc = await ensureFreshToken(input.shopId);
  const refund = new PaymentRefund(mpConfig(acc.accessToken));
  await refund.create({ payment_id: input.paymentId, body: {} });
}
