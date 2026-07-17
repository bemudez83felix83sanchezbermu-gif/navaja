"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import {
  bookingRulesSchema,
  entityIdSchema,
  hostnameSchema,
  inviteMemberSchema,
  notificationsSchema,
  paymentSettingsSchema,
  planIdSchema,
  RESERVED_SLUGS,
  shopProfileSchema,
  slugSchema,
} from "@/lib/security/validation";
import * as db from "@/lib/data/queries";
import { ROOT_DOMAIN } from "@/lib/tenant";

/**
 * Server Actions del panel de auto-servicio — ahora contra Supabase.
 *
 * Mismo pipeline de confianza que la reserva: rate-limit (IP) → Zod (estricto)
 * → mutación con service_role acotada al tenant del dashboard. Cuando llegue
 * auth, el service_role se sustituye por la sesión del usuario y las políticas
 * RLS de `supabase/policies.sql` hacen el mismo trabajo en la base.
 */
export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function guard(key: string): Promise<string | null> {
  const h = await headers();
  const rl = rateLimit(`settings:${key}:${clientIp(h)}`, {
    limit: 20,
    windowMs: 60_000,
  });
  return rl.success ? null : `Demasiados cambios seguidos. Espera ${rl.retryAfter}s.`;
}

function fail(err: z.ZodError): ActionResult {
  return { ok: false, error: err.issues[0]?.message ?? "Datos inválidos." };
}

/** Mensajes de dominio (español, pensados para el dueño) pasan; internals no. */
function errMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  return m && !m.startsWith("[db:") ? m : "Algo salió mal. Inténtalo de nuevo.";
}

/** Refresca todas las superficies que pintan datos de la barbería. */
function refresh() {
  revalidatePath("/", "layout");
}

/* ---------------- Negocio ---------------- */
export async function updateProfile(raw: unknown): Promise<ActionResult> {
  const limited = await guard("profile");
  if (limited) return { ok: false, error: limited };

  const parsed = shopProfileSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  try {
    await db.updateShopProfile(parsed.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return { ok: true, message: "Datos del negocio guardados." };
}

/* ---------------- Reglas de reserva ---------------- */
export async function updateBookingRules(raw: unknown): Promise<ActionResult> {
  const limited = await guard("rules");
  if (limited) return { ok: false, error: limited };

  const parsed = bookingRulesSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  try {
    await db.updateBookingRules(parsed.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return { ok: true, message: "Reglas de reserva actualizadas." };
}

/* ---------------- Pagos (Track A) ---------------- */
/**
 * Guarda modo y monto de anticipo. Gate por plan aquí — la UI puede mentir,
 * el server no. Coincide con addDomain, que también consulta `getPlan()`.
 * Cambiar el modo NO afecta a citas ya en curso ni al hold pg_cron; solo a
 * las próximas reservas del wizard público.
 */
export async function savePaymentRules(raw: unknown): Promise<ActionResult> {
  const limited = await guard("payment-rules");
  if (limited) return { ok: false, error: limited };

  const parsed = paymentSettingsSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  try {
    if (parsed.data.mode !== "off" && !(await db.getPlan()).payments) {
      return {
        ok: false,
        error: "Los cobros en reservas son parte del plan Pro.",
      };
    }
    await db.updatePaymentSettings(parsed.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return {
    ok: true,
    message: parsed.data.mode === "off"
      ? "Cobros de anticipo desactivados."
      : "Configuración de pagos guardada.",
  };
}

/* ---------------- Notificaciones ---------------- */
export async function updateNotifications(raw: unknown): Promise<ActionResult> {
  const limited = await guard("notifications");
  if (limited) return { ok: false, error: limited };

  const parsed = notificationsSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  try {
    await db.updateNotifications(parsed.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return { ok: true, message: "Notificaciones actualizadas." };
}

/* ---------------- Dominios ---------------- */
export async function updateSlug(raw: unknown): Promise<ActionResult> {
  const limited = await guard("slug");
  if (limited) return { ok: false, error: limited };

  const parsed = slugSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);
  if (RESERVED_SLUGS.has(parsed.data)) {
    return { ok: false, error: "Ese subdominio está reservado. Elige otro." };
  }

  try {
    await db.updateSlug(parsed.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return { ok: true, message: `Tu página ahora vive en ${parsed.data}.${ROOT_DOMAIN}` };
}

export async function addDomain(raw: unknown): Promise<ActionResult> {
  const limited = await guard("domain");
  if (limited) return { ok: false, error: limited };

  const parsed = hostnameSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  const domain = parsed.data;
  if (domain === ROOT_DOMAIN || domain.endsWith(`.${ROOT_DOMAIN}`)) {
    return { ok: false, error: "Ese dominio pertenece a Navaja. Usa tu propio dominio." };
  }
  try {
    if (!(await db.getPlan()).customDomain) {
      return { ok: false, error: "Tu plan no incluye dominio propio. Cambia a Pro." };
    }
    await db.addCustomDomain(domain);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return { ok: true, message: "Dominio agregado. Configura los registros DNS." };
}

export async function verifyDomain(raw: unknown): Promise<ActionResult> {
  const limited = await guard("domain");
  if (limited) return { ok: false, error: limited };

  const parsed = entityIdSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  try {
    const status = await db.verifyDomain(parsed.data);
    if (!status) return { ok: false, error: "Dominio no encontrado." };
    refresh();
    return {
      ok: true,
      message:
        status === "activo"
          ? "¡Dominio verificado! Ya sirve tráfico con SSL."
          : "Registros detectados. Emitiendo certificado…",
    };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

export async function removeDomain(raw: unknown): Promise<ActionResult> {
  const limited = await guard("domain");
  if (limited) return { ok: false, error: limited };

  const parsed = entityIdSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);
  if (parsed.data === "sub") {
    return { ok: false, error: "El subdominio incluido no se puede eliminar." };
  }

  try {
    await db.removeDomain(parsed.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return { ok: true, message: "Dominio eliminado." };
}

export async function setPrimaryDomain(raw: unknown): Promise<ActionResult> {
  const limited = await guard("domain");
  if (limited) return { ok: false, error: limited };

  const parsed = entityIdSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  try {
    await db.setPrimaryDomain(parsed.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return { ok: true, message: "Dominio principal actualizado." };
}

/* ---------------- Equipo ---------------- */
export async function inviteMember(raw: unknown): Promise<ActionResult> {
  const limited = await guard("team");
  if (limited) return { ok: false, error: limited };

  const parsed = inviteMemberSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  try {
    await db.inviteMember(parsed.data.name, parsed.data.email, parsed.data.role);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return { ok: true, message: `Invitación enviada a ${parsed.data.email}.` };
}

export async function removeMember(raw: unknown): Promise<ActionResult> {
  const limited = await guard("team");
  if (limited) return { ok: false, error: limited };

  const parsed = entityIdSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);
  if (parsed.data === "sub") return { ok: false, error: "Identificador inválido." };

  try {
    await db.removeMember(parsed.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return { ok: true, message: "Acceso revocado." };
}

/* ---------------- Plan ---------------- */
export async function changePlan(raw: unknown): Promise<ActionResult> {
  const limited = await guard("plan");
  if (limited) return { ok: false, error: limited };

  const parsed = planIdSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  try {
    await db.changePlan(parsed.data);
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
  refresh();
  return { ok: true, message: "Plan actualizado." };
}
