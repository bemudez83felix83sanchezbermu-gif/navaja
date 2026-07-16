"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";
import {
  loginSchema,
  passwordSchema,
  emailSchema,
  signupSchema,
  RESERVED_SLUGS,
} from "@/lib/security/validation";
import { dbAdmin } from "@/lib/db";
import { supabaseServer } from "@/lib/auth";
import { LEGAL_VERSION } from "@/lib/legal";

/**
 * Server Actions de cuentas. Mismo pipeline de confianza que book.ts:
 * rate-limit por IP → Zod estricto → mutación. Los mensajes de error son
 * deliberadamente genéricos donde revelar detalle ayudaría a un atacante
 * (login no distingue "correo no existe" de "contraseña mal"; recuperar
 * responde igual exista o no la cuenta).
 */

export type AuthState = { error?: string; ok?: boolean } | undefined;

const firstIssue = (e: { issues: { message: string }[] }) =>
  e.issues[0]?.message ?? "Datos inválidos.";

/* ------------------------------------------------------------------ *
 * Registro (onboarding completo: usuario + barbería + prueba 14 días)
 * ------------------------------------------------------------------ */

/** `nombre de barbería` → slug único para {slug}.navaja.app. */
function toSlug(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // sin acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 34); // deja espacio para sufijo -NNNN
  return base.length >= 2 ? base : `barberia-${base}`;
}

async function uniqueSlug(name: string): Promise<string> {
  const base = toSlug(name);
  const candidates = RESERVED_SLUGS.has(base) ? [] : [base];
  for (let i = 0; i < 4; i++) {
    candidates.push(`${base}-${Math.floor(1000 + Math.random() * 9000)}`);
  }
  const { data, error } = await dbAdmin()
    .from("barbershops")
    .select("slug")
    .in("slug", candidates);
  if (error) throw new Error(`[db:slug.check] ${error.message}`);
  const taken = new Set((data ?? []).map((r) => r.slug));
  const free = candidates.find((c) => !taken.has(c));
  if (!free) throw new Error("No pudimos generar un subdominio libre.");
  return free;
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const h = await headers();
  const rl = rateLimit(`signup:${clientIp(h)}`, { limit: 5, windowMs: 600_000 });
  if (!rl.success) {
    return { error: `Demasiados intentos. Espera ${rl.retryAfter}s.` };
  }

  const parsed = signupSchema.safeParse({
    ownerName: formData.get("ownerName"),
    shopName: formData.get("shopName"),
    email: formData.get("email"),
    password: formData.get("password"),
    acceptTerms: formData.get("acceptTerms") === "on",
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const d = parsed.data;

  const admin = dbAdmin();

  // 1) Usuario de auth. email_confirm=true: sin paso de verificación por
  //    correo mientras no haya SMTP propio (Supabase lo permite vía admin).
  //    El consentimiento queda en app_metadata (solo modificable por el
  //    backend) como evidencia: qué versión de los textos aceptó y cuándo.
  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true,
    user_metadata: { full_name: d.ownerName },
    app_metadata: {
      terms_version: LEGAL_VERSION,
      terms_accepted_at: new Date().toISOString(),
    },
  });
  if (userErr || !created?.user) {
    if (userErr?.code === "email_exists") {
      return { error: "Ese correo ya tiene una cuenta. Inicia sesión." };
    }
    console.error("[auth:signup]", userErr?.message);
    return { error: "No pudimos crear tu cuenta. Intenta de nuevo." };
  }
  const userId = created.user.id;

  // 2) Barbería + membresía owner + suscripción de prueba. Si algo falla,
  //    se revierte todo (delete shop cascadea; delete user limpia auth) para
  //    no dejar cuentas a medias.
  let shopId: string | null = null;
  try {
    const slug = await uniqueSlug(d.shopName);
    const { data: shop, error: shopErr } = await admin
      .from("barbershops")
      .insert({
        slug,
        name: d.shopName,
        owner_name: d.ownerName,
        owner_email: d.email,
      })
      .select("id")
      .single();
    if (shopErr) throw new Error(shopErr.message);
    shopId = shop.id;

    const { error: memErr } = await admin
      .from("memberships")
      .insert({ user_id: userId, barbershop_id: shopId, role: "owner" });
    if (memErr) throw new Error(memErr.message);

    const { error: subErr } = await admin.from("subscriptions").insert({
      barbershop_id: shopId,
      plan: "esencial",
      status: "prueba",
      renews_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    });
    if (subErr) throw new Error(subErr.message);
  } catch (e) {
    console.error("[auth:signup.shop]", e instanceof Error ? e.message : e);
    if (shopId) await admin.from("barbershops").delete().eq("id", shopId);
    await admin.auth.admin.deleteUser(userId);
    return { error: "No pudimos crear tu barbería. Intenta de nuevo." };
  }

  // 3) Sesión (cookies) y directo al panel.
  const supabase = await supabaseServer();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: d.email,
    password: d.password,
  });
  if (signInErr) redirect("/login?aviso=cuenta-creada");
  redirect("/dashboard");
}

/* ------------------------------------------------------------------ *
 * Login / Logout
 * ------------------------------------------------------------------ */

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const h = await headers();
  const rl = rateLimit(`login:${clientIp(h)}`, { limit: 8, windowMs: 60_000 });
  if (!rl.success) {
    return { error: `Demasiados intentos. Espera ${rl.retryAfter}s.` };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { error: "Correo o contraseña incorrectos." };
  }

  // Cuenta sin barbería (registro interrumpido): no dejar entrar a un panel
  // que no puede resolver tenant.
  const { data: member } = await dbAdmin()
    .from("memberships")
    .select("barbershop_id")
    .eq("user_id", data.user.id)
    .limit(1)
    .maybeSingle();
  if (!member) {
    await supabase.auth.signOut();
    return {
      error:
        "Tu cuenta no tiene una barbería asociada. Escribe a soporte@navaja.app.",
    };
  }

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

/* ------------------------------------------------------------------ *
 * Recuperación de contraseña
 * ------------------------------------------------------------------ */

export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const h = await headers();
  const rl = rateLimit(`reset:${clientIp(h)}`, { limit: 3, windowMs: 600_000 });
  if (!rl.success) {
    return { error: `Demasiados intentos. Espera ${rl.retryAfter}s.` };
  }

  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const supabase = await supabaseServer();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${proto}://${host}/auth/callback?next=/restablecer`,
  });

  // Siempre ok: no revelar si el correo tiene cuenta o no.
  return { ok: true };
}

export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  if (formData.get("password") !== formData.get("confirm")) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { error: "El enlace expiró. Solicita otro correo de recuperación." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return { error: "No pudimos actualizar la contraseña. Intenta de nuevo." };
  }
  redirect("/dashboard");
}
