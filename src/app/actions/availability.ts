"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { slugSchema, uuidSchema } from "@/lib/security/validation";
import { availability, type Slot } from "@/lib/data/queries";

/**
 * Disponibilidad de horarios para el wizard público.
 *
 * Antes el wizard la calculaba en el cliente sobre datos mock; ahora la
 * calcula el servidor contra la vista `busy_slots` (solo rangos ocupados,
 * cero PII) usando la llave anon — exactamente lo que vería un visitante.
 */
const availabilityInput = z
  .object({
    shopSlug: slugSchema,
    serviceId: uuidSchema,
    barberId: z.union([uuidSchema, z.literal("any")]),
    dateIso: z.string().datetime({ message: "Fecha inválida" }),
  })
  .strict();

export type AvailabilityResult =
  | { ok: true; slots: Slot[] }
  | { ok: false; error: string };

export async function getAvailability(raw: unknown): Promise<AvailabilityResult> {
  const h = await headers();
  const rl = rateLimit(`avail:${clientIp(h)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.success) {
    return { ok: false, error: `Demasiadas consultas. Espera ${rl.retryAfter}s.` };
  }

  const parsed = availabilityInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const { shopSlug, serviceId, barberId, dateIso } = parsed.data;

  try {
    const slots = await availability(shopSlug, serviceId, new Date(dateIso), barberId);
    return { ok: true, slots };
  } catch {
    return { ok: false, error: "No pudimos cargar los horarios." };
  }
}
