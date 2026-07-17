"use server";

import { headers } from "next/headers";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { uuidSchema } from "@/lib/security/validation";
import { getAppointmentPaymentStatus } from "@/lib/data/queries";
import type { AppointmentStatus } from "@/lib/data/types";

/**
 * Polling desde la página de retorno de MP. Devuelve SOLO el estado de la cita
 * y su expiración de hold — cero PII. Rate-limited de manera generosa para que
 * un cliente honesto (ping cada 3s) nunca lo toque, pero un abuser no pueda
 * enumerar `cita` ids del shop.
 *
 * Diseño: aceptamos `(shopSlug, appointmentId)` explícitos porque la ruta ya
 * los tiene en los params y validamos el pareo en la query — quien conoce un
 * id no puede leerlo desde otro slug.
 */
export type PaymentStatusResult =
  | {
      ok: true;
      status: AppointmentStatus;
      /** ISO — cuándo termina el hold. Solo con status 'pendiente_pago'. */
      paymentExpiresAt: string | null;
    }
  | { ok: false; error: string };

export async function getPaymentReturnStatus(
  shopSlug: string,
  appointmentId: string,
): Promise<PaymentStatusResult> {
  const h = await headers();
  // 30/min es holgado (polling cada 3s = 20/min). Blindar el endpoint contra
  // enumeración es la razón real del límite.
  const rl = rateLimit(`pay-status:${clientIp(h)}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.success) {
    return { ok: false, error: `Demasiadas consultas. Espera ${rl.retryAfter}s.` };
  }

  const idParsed = uuidSchema.safeParse(appointmentId);
  if (!idParsed.success) return { ok: false, error: "Cita inválida." };

  const row = await getAppointmentPaymentStatus(shopSlug, idParsed.data);
  if (!row) return { ok: false, error: "Cita no encontrada." };

  return {
    ok: true,
    status: row.status,
    paymentExpiresAt: row.paymentExpiresAt,
  };
}
