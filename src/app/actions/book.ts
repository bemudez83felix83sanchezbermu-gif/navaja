"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { bookingInputSchema } from "@/lib/security/validation";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { bookAppointment, getShopBySlug } from "@/lib/data/queries";
import { createCheckoutPreference } from "@/lib/payments/mp";

/**
 * Server Action: crear una reserva REAL.
 *
 * Pipeline de confianza (cada capa asume que la anterior falló):
 *  1. rate-limit por IP — frena abuso/bots insistentes.
 *  2. Zod estricto — valida, recorta y bloquea honeypot + envíos ultrarrápidos.
 *  3. RPC `book_appointment` con la llave ANON: el mismo poder que tendría
 *     cualquier visitante. Postgres re-valida todo (servicio activo, barbero
 *     apto, horario futuro) y la exclusion constraint elimina el doble booking
 *     incluso en carrera.
 *  4. Track A — si la barbería cobra anticipo Y tiene cuenta MP activa, la RPC
 *     devuelve `paymentDueCents`: el action arma la preferencia de Checkout
 *     Pro con el token del vendedor y devuelve `checkoutUrl`. Las
 *     notificaciones NO se mandan aquí — las manda `confirm_paid_appointment`
 *     cuando el webhook confirme el pago.
 */
export type BookResult =
  | { ok: true; confirmationId: string }
  | { ok: true; checkoutUrl: string; confirmationId: string; expiresAt: string }
  | { ok: false; error: string };

export async function book(raw: unknown): Promise<BookResult> {
  const h = await headers();
  const rl = rateLimit(`book:${clientIp(h)}`, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return { ok: false, error: `Demasiados intentos. Espera ${rl.retryAfter}s.` };
  }

  const parsed = bookingInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const d = parsed.data;

  const res = await bookAppointment({
    shopId: d.shopId,
    serviceId: d.serviceId,
    barberId: d.barberId === "any" ? null : d.barberId,
    startIso: d.slotIso,
    name: d.name,
    phone: d.phone,
    email: d.email || undefined,
    notes: d.notes || undefined,
  });
  if (!res.ok) return res;

  // La agenda del dueño muestra la cita nueva sin recargar a mano.
  revalidatePath("/dashboard", "layout");

  // Sin anticipo → fin del flujo.
  if (res.paymentDueCents === null) {
    return { ok: true, confirmationId: res.id.slice(0, 8).toUpperCase() };
  }

  // Con anticipo → armamos la preferencia con el token del VENDEDOR (dueño de
  // esta shop). El monto ya lo calculó Postgres; el cliente nunca sugiere
  // cantidades. El slug lo necesitamos para armar back_urls; una consulta
  // más pero fuera del path crítico de la reserva.
  const shop = await getShopBySlug(await slugForShopId(d.shopId));
  if (!shop) {
    // Muy defensivo: la RPC ya validó la barbería. Si llegamos aquí, algo raro
    // pasó entre la RPC y este punto.
    return { ok: false, error: "Barbería no encontrada." };
  }

  try {
    const pref = await createCheckoutPreference({
      shopId: d.shopId,
      appointmentId: res.id,
      amountCents: res.paymentDueCents,
      serviceTitle: res.serviceName ?? "Reserva",
      payerEmail: d.email || undefined,
      shopSlug: shop.slug,
      expiresAtIso: res.paymentExpiresAt!,
    });
    return {
      ok: true,
      confirmationId: res.id.slice(0, 8).toUpperCase(),
      checkoutUrl: pref.initPoint,
      expiresAt: res.paymentExpiresAt!,
    };
  } catch (e) {
    // La cita ya nació 'pendiente_pago'; si no pudimos armar checkout, pg_cron
    // libera el hold en <15 min. Mientras tanto avisamos con un mensaje humano.
    console.error("[book] createCheckoutPreference failed:", e);
    return {
      ok: false,
      error:
        "No pudimos abrir Mercado Pago ahora. Inténtalo de nuevo en unos minutos.",
    };
  }
}

/** Slug de una barbería por id — el wizard trabaja con id, MP necesita el slug
 *  para el back_url. Es una lookup mínima; caché de React dedupe en el turno. */
async function slugForShopId(shopId: string): Promise<string> {
  const { dbAdmin } = await import("@/lib/db");
  const { data, error } = await dbAdmin()
    .from("barbershops")
    .select("slug")
    .eq("id", shopId)
    .maybeSingle();
  if (error || !data) throw new Error("Barbería no encontrada");
  return data.slug as string;
}
