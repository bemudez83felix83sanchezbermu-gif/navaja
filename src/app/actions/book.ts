"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { bookingInputSchema } from "@/lib/security/validation";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { bookAppointment } from "@/lib/data/queries";

/**
 * Server Action: crear una reserva REAL.
 *
 * Pipeline de confianza (cada capa asume que la anterior falló):
 *  1. rate-limit por IP — frena abuso/bots insistentes.
 *  2. Zod estricto — valida, recorta y bloquea honeypot + envíos ultrarrápidos.
 *  3. RPC `book_appointment` con la llave ANON: el mismo poder que tendría
 *     cualquier visitante. Postgres re-valida todo (servicio activo, barbero
 *     apto, horario futuro) y la exclusion constraint elimina el doble booking
 *     incluso en carrera. La cita y sus notificaciones (WhatsApp al dueño,
 *     email al cliente) se insertan en la MISMA transacción.
 */
export type BookResult =
  | { ok: true; confirmationId: string }
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

  return { ok: true, confirmationId: res.id.slice(0, 8).toUpperCase() };
}
