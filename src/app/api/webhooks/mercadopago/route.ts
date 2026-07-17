import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/security/env";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { dbAdmin } from "@/lib/db";
import { confirmPaidAppointment } from "@/lib/data/queries";
import { getMpPayment, refundMpPayment } from "@/lib/payments/mp";

/**
 * Webhook de Mercado Pago (Track A de PAGOS.md).
 *
 * Contrato de este handler — cada punto es una defensa:
 *   1. Rate-limit generoso: MP reintenta desde IPs variables. Un límite
 *      agresivo pierde confirmaciones legítimas; la defensa real es la firma.
 *   2. Body CRUDO antes de parsear: la firma se computa sobre el string exacto
 *      que MP mandó — usar req.json() lo alteraría (whitespace, orden).
 *   3. Firma HMAC-SHA256: si `x-signature` no valida, 401 sin detalle.
 *   4. Estado real desde la API de MP: el body solo trae el id del pago; nunca
 *      confiamos en su contenido para decidir el estado. Con el `user_id` del
 *      body (ya firmado) encontramos al vendedor y usamos su token.
 *   5. Idempotencia por `payments.mp_payment_id` unique en la RPC — MP puede
 *      reintentar; el segundo webhook con el mismo pago sale por 'already_processed'.
 *   6. Carrera cancela-vs-confirma: la RPC hace update condicional; si el hold
 *      ya expiró, devuelve 'race_conflict' y disparamos un refund automático.
 *
 * Runtime Node: necesitamos `node:crypto` para HMAC.
 */
export const runtime = "nodejs";
// Route Handlers no cachean POST por default, pero lo hacemos explícito.
export const dynamic = "force-dynamic";

interface MpWebhookBody {
  action?: string;
  type?: string;
  data?: { id?: string | number };
  user_id?: string | number;
  live_mode?: boolean;
}

function parseSignatureHeader(h: string): { ts?: string; v1?: string } {
  const out: Record<string, string> = {};
  for (const part of h.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) out[k.trim()] = v.trim();
  }
  return { ts: out.ts, v1: out.v1 };
}

export async function POST(req: Request) {
  // 1) Rate-limit generoso — la firma es la defensa real.
  const rl = rateLimit(`mp-webhook:${clientIp(req.headers)}`, {
    limit: 300,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return new Response("rate_limited", { status: 429 });
  }

  if (!env.MP_WEBHOOK_SECRET) {
    // No queremos devolver 200 y perder el aviso, ni 500 verboso a MP.
    // 503 es lo más honesto: "temporalmente sin capacidad de procesarlo".
    return new Response("not_configured", { status: 503 });
  }

  // 2) Body crudo. Después parseamos solo lo mínimo (nada de confiar en él aún).
  const raw = await req.text();
  let payload: MpWebhookBody;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("bad_body", { status: 400 });
  }

  const dataId = payload?.data?.id != null ? String(payload.data.id) : "";
  if (!dataId) return new Response("no_data_id", { status: 400 });

  // 3) Firma. Formato MP actual:
  //    x-signature: "ts=<epoch>,v1=<hex_hmac_sha256>"
  //    mensaje = `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
  const sigHeader = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const { ts, v1 } = parseSignatureHeader(sigHeader);
  if (!ts || !v1) return new Response("bad_signature", { status: 401 });

  const message = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", env.MP_WEBHOOK_SECRET)
    .update(message)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const gotBuf = Buffer.from(v1, "hex");
  if (expectedBuf.length !== gotBuf.length || !timingSafeEqual(expectedBuf, gotBuf)) {
    return new Response("bad_signature", { status: 401 });
  }

  // 4) Solo actuamos en avisos de tipo 'payment'. Los merchant_order,
  //    chargeback, etc. los aceptamos con 2xx para que MP no reintente.
  if (payload.type !== "payment") {
    return new Response("ok", { status: 200 });
  }

  // 5) Encontrar la barbería vendedora vía `user_id` (ya firmado).
  const mpUserId = payload.user_id != null ? String(payload.user_id) : "";
  if (!mpUserId) return new Response("no_user_id", { status: 400 });

  const { data: accRow, error: accErr } = await dbAdmin()
    .from("payment_accounts")
    .select("barbershop_id")
    .eq("mp_user_id", mpUserId)
    .maybeSingle();
  if (accErr) {
    console.error("[mp-webhook] payment_accounts lookup failed:", accErr);
    return new Response("db_error", { status: 500 });
  }
  if (!accRow) {
    // Pago de un vendedor que no tenemos conectado — no es un error del webhook;
    // 200 para que MP no reintente indefinidamente.
    return new Response("unknown_seller", { status: 200 });
  }
  const shopId = accRow.barbershop_id as string;

  // 6) Estado real del pago (con el token del vendedor).
  let mp;
  try {
    mp = await getMpPayment({ shopId, paymentId: dataId });
  } catch (e) {
    console.error("[mp-webhook] getMpPayment failed:", e);
    // 502 → MP reintentará.
    return new Response("mp_upstream_error", { status: 502 });
  }

  if (!mp.externalReference) {
    // Sin external_reference no podemos correlacionar; MP no nos volverá a
    // servir información nueva → cerramos con 200.
    return new Response("no_ref", { status: 200 });
  }

  // 7) Solo actuamos en aprobado. Rechazado/pendiente/etc: el hold sigue
  //    corriendo; el cliente puede reintentar desde la página de retorno.
  if (mp.status !== "approved") {
    return new Response("ok", { status: 200 });
  }

  const result = await confirmPaidAppointment({
    appointmentId: mp.externalReference,
    mpPaymentId: mp.id,
    amountCents: mp.transactionAmountCents,
    raw: mp.raw,
  });

  // 8) Carrera cancela-vs-confirma: el pago llegó tarde y la cita ya no existe
  //    como pendiente_pago (pg_cron liberó el hold o el dueño canceló).
  //    Reembolsamos automáticamente. Fallar el refund no debe reventar el
  //    webhook — MP reintentará y la RPC ya devuelve 'already_processed'.
  if (result === "race_conflict") {
    try {
      await refundMpPayment({ shopId, paymentId: mp.id });
    } catch (e) {
      console.error("[mp-webhook] auto-refund failed:", e);
    }
  }

  return new Response("ok", { status: 200 });
}
