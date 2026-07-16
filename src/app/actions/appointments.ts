"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import { uuidSchema } from "@/lib/security/validation";
import { updateAppointmentStatus } from "@/lib/data/queries";
import type { ActionResult } from "./settings";

/**
 * Gestión de citas desde el dashboard (drawer de la agenda / lista de citas).
 * Mismo pipeline: rate-limit → Zod → mutación acotada al tenant.
 */

const statusInput = z
  .object({
    id: uuidSchema,
    status: z.enum(["pendiente", "confirmada", "completada", "cancelada", "no_show"]),
  })
  .strict();

const STATUS_MSG: Record<string, string> = {
  confirmada: "Cita confirmada.",
  completada: "Cita marcada como completada.",
  cancelada: "Cita cancelada.",
  no_show: "Marcada como inasistencia.",
  pendiente: "Cita marcada como pendiente.",
};

export async function setAppointmentStatus(raw: unknown): Promise<ActionResult> {
  const h = await headers();
  const rl = rateLimit(`appt:${clientIp(h)}`, { limit: 30, windowMs: 60_000 });
  if (!rl.success) {
    return { ok: false, error: `Demasiados cambios seguidos. Espera ${rl.retryAfter}s.` };
  }

  const parsed = statusInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  try {
    await updateAppointmentStatus(parsed.data.id, parsed.data.status);
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return {
      ok: false,
      error: m && !m.startsWith("[db:") ? m : "No se pudo actualizar la cita.",
    };
  }

  revalidatePath("/dashboard", "layout");
  return { ok: true, message: STATUS_MSG[parsed.data.status] };
}
