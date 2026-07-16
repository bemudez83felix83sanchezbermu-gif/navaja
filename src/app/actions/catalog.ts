"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import {
  activeToggleSchema,
  barberInputSchema,
  serviceInputSchema,
  uuidSchema,
} from "@/lib/security/validation";
import * as db from "@/lib/data/queries";
import type { ActionResult } from "./settings";

/**
 * CRUD del catálogo (servicios y barberos) — Server Actions del dashboard.
 * Pipeline idéntico al resto: rate-limit (IP) → Zod estricto → mutación
 * acotada al tenant. `revalidatePath` refresca dashboard Y página pública.
 */

async function guard(key: string): Promise<string | null> {
  const h = await headers();
  const rl = rateLimit(`catalog:${key}:${clientIp(h)}`, {
    limit: 20,
    windowMs: 60_000,
  });
  return rl.success ? null : `Demasiados cambios seguidos. Espera ${rl.retryAfter}s.`;
}

function fail(err: z.ZodError): ActionResult {
  return { ok: false, error: err.issues[0]?.message ?? "Datos inválidos." };
}

function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  return m && !m.startsWith("[db:") ? m : "Algo salió mal. Inténtalo de nuevo.";
}

function refresh() {
  revalidatePath("/", "layout");
}

/* ---------------- Servicios ---------------- */

export async function saveService(raw: unknown): Promise<ActionResult> {
  const limited = await guard("service");
  if (limited) return { ok: false, error: limited };

  const parsed = serviceInputSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);
  const { id, ...input } = parsed.data;

  try {
    if (id) await db.updateService(id, input);
    else await db.createService(input);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return { ok: true, message: id ? "Servicio actualizado." : "Servicio creado." };
}

export async function toggleService(raw: unknown): Promise<ActionResult> {
  const limited = await guard("service");
  if (limited) return { ok: false, error: limited };

  const parsed = activeToggleSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  try {
    await db.setServiceActive(parsed.data.id, parsed.data.active);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return {
    ok: true,
    message: parsed.data.active
      ? "Servicio activado: visible al reservar."
      : "Servicio desactivado: oculto al reservar.",
  };
}

export async function removeService(raw: unknown): Promise<ActionResult> {
  const limited = await guard("service");
  if (limited) return { ok: false, error: limited };

  const parsed = uuidSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  try {
    const result = await db.deleteService(parsed.data);
    refresh();
    return {
      ok: true,
      message:
        result === "deleted"
          ? "Servicio eliminado."
          : "El servicio tiene citas en el historial: se desactivó en su lugar.",
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

/* ---------------- Barberos ---------------- */

export async function saveBarber(raw: unknown): Promise<ActionResult> {
  const limited = await guard("barber");
  if (limited) return { ok: false, error: limited };

  const parsed = barberInputSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);
  const { id, ...input } = parsed.data;

  try {
    if (id) await db.updateBarber(id, input);
    else await db.createBarber(input);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return {
    ok: true,
    message: id ? "Barbero actualizado." : "Barbero agregado al equipo.",
  };
}

export async function toggleBarber(raw: unknown): Promise<ActionResult> {
  const limited = await guard("barber");
  if (limited) return { ok: false, error: limited };

  const parsed = activeToggleSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  try {
    await db.setBarberActive(parsed.data.id, parsed.data.active);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return {
    ok: true,
    message: parsed.data.active
      ? "Barbero activo: aparece en la agenda y al reservar."
      : "Barbero inactivo: fuera de la agenda y de las reservas.",
  };
}

export async function removeBarber(raw: unknown): Promise<ActionResult> {
  const limited = await guard("barber");
  if (limited) return { ok: false, error: limited };

  const parsed = uuidSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  try {
    const result = await db.deleteBarber(parsed.data);
    refresh();
    return {
      ok: true,
      message:
        result === "deleted"
          ? "Barbero eliminado."
          : "El barbero tiene citas en el historial: se desactivó en su lugar.",
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}
