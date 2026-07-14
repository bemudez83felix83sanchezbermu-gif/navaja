"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import {
  bookingRulesSchema,
  hostnameSchema,
  inviteMemberSchema,
  notificationsSchema,
  planIdSchema,
  RESERVED_SLUGS,
  shopProfileSchema,
  slugSchema,
  storeIdSchema,
} from "@/lib/security/validation";
import * as store from "@/lib/data/store";
import { ROOT_DOMAIN } from "@/lib/tenant";

/**
 * Server Actions for the self-service settings panel.
 *
 * Same trust pipeline as booking: rate-limit (per IP) → Zod (strict) → mutate.
 * In production every mutation additionally runs under the session's RLS
 * membership (see supabase/policies.sql) — the mock store stands in for that.
 * Results are typed and never leak internals.
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

/** Refresh every surface that renders shop data (dashboard + public booking). */
function refresh() {
  revalidatePath("/", "layout");
}

/* ---------------- Negocio ---------------- */
export async function updateProfile(raw: unknown): Promise<ActionResult> {
  const limited = await guard("profile");
  if (limited) return { ok: false, error: limited };

  const parsed = shopProfileSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  store.updateShopProfile(parsed.data);
  refresh();
  return { ok: true, message: "Datos del negocio guardados." };
}

/* ---------------- Reglas de reserva ---------------- */
export async function updateBookingRules(raw: unknown): Promise<ActionResult> {
  const limited = await guard("rules");
  if (limited) return { ok: false, error: limited };

  const parsed = bookingRulesSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  store.updateBookingRules(parsed.data);
  refresh();
  return { ok: true, message: "Reglas de reserva actualizadas." };
}

/* ---------------- Notificaciones ---------------- */
export async function updateNotifications(raw: unknown): Promise<ActionResult> {
  const limited = await guard("notifications");
  if (limited) return { ok: false, error: limited };

  const parsed = notificationsSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  store.updateNotifications(parsed.data);
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

  store.updateSlug(parsed.data);
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
  if (!store.getPlan().customDomain) {
    return { ok: false, error: "Tu plan no incluye dominio propio. Cambia a Pro." };
  }
  if (store.getDomains().some((d) => d.domain === domain)) {
    return { ok: false, error: "Ese dominio ya está agregado." };
  }

  store.addCustomDomain(domain);
  refresh();
  return { ok: true, message: "Dominio agregado. Configura los registros DNS." };
}

export async function verifyDomain(raw: unknown): Promise<ActionResult> {
  const limited = await guard("domain");
  if (limited) return { ok: false, error: limited };

  const parsed = storeIdSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  const d = store.verifyDomain(parsed.data);
  if (!d) return { ok: false, error: "Dominio no encontrado." };
  refresh();
  return {
    ok: true,
    message:
      d.status === "activo"
        ? "¡Dominio verificado! Ya sirve tráfico con SSL."
        : "Registros detectados. Emitiendo certificado…",
  };
}

export async function removeDomain(raw: unknown): Promise<ActionResult> {
  const limited = await guard("domain");
  if (limited) return { ok: false, error: limited };

  const parsed = storeIdSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  store.removeDomain(parsed.data);
  refresh();
  return { ok: true, message: "Dominio eliminado." };
}

export async function setPrimaryDomain(raw: unknown): Promise<ActionResult> {
  const limited = await guard("domain");
  if (limited) return { ok: false, error: limited };

  const parsed = storeIdSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  store.setPrimaryDomain(parsed.data);
  refresh();
  return { ok: true, message: "Dominio principal actualizado." };
}

/* ---------------- Equipo ---------------- */
export async function inviteMember(raw: unknown): Promise<ActionResult> {
  const limited = await guard("team");
  if (limited) return { ok: false, error: limited };

  const parsed = inviteMemberSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  if (store.getMembers().some((m) => m.email === parsed.data.email)) {
    return { ok: false, error: "Esa persona ya tiene acceso." };
  }

  store.inviteMember(parsed.data.name, parsed.data.email, parsed.data.role);
  refresh();
  return { ok: true, message: `Invitación enviada a ${parsed.data.email}.` };
}

export async function removeMember(raw: unknown): Promise<ActionResult> {
  const limited = await guard("team");
  if (limited) return { ok: false, error: limited };

  const parsed = storeIdSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  store.removeMember(parsed.data);
  refresh();
  return { ok: true, message: "Acceso revocado." };
}

/* ---------------- Plan ---------------- */
export async function changePlan(raw: unknown): Promise<ActionResult> {
  const limited = await guard("plan");
  if (limited) return { ok: false, error: limited };

  const parsed = planIdSchema.safeParse(raw);
  if (!parsed.success) return fail(parsed.error);

  store.changePlan(parsed.data);
  refresh();
  return { ok: true, message: "Plan actualizado." };
}
