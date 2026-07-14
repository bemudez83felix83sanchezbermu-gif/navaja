"use server";

import { headers } from "next/headers";
import { bookingInputSchema } from "@/lib/security/validation";
import { rateLimit, clientIp } from "@/lib/security/rate-limit";

/**
 * Server Action: create a booking.
 *
 * Why a Server Action (and not just client state):
 *  - It moves the **authoritative** validation and rate limiting to the server,
 *    where the client can't bypass them.
 *  - Next.js Server Actions are POST-only and protected against CSRF by an
 *    automatic Origin/Host check, so we get cross-site request forgery defense
 *    for free.
 *
 * Pipeline: rate-limit (per IP) → validate + anti-bot (Zod) → persist.
 * Never logs PII. Returns a typed, non-leaky result.
 */
export type BookResult =
  | { ok: true; confirmationId: string }
  | { ok: false; error: string };

export async function book(raw: unknown): Promise<BookResult> {
  // 1) Throttle abuse.
  const h = await headers();
  const ip = clientIp(h);
  const rl = rateLimit(`book:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!rl.success) {
    return { ok: false, error: `Demasiados intentos. Espera ${rl.retryAfter}s.` };
  }

  // 2) Authoritative validation (also enforces honeypot + min fill time).
  const parsed = bookingInputSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos.";
    return { ok: false, error: msg };
  }

  // 3) Persist.
  //    TODO(Supabase): insert into `appointments` under the shop's RLS policy,
  //    re-checking slot availability transactionally to avoid double-booking.
  //    See supabase/policies.sql. For the demo we just acknowledge.
  const confirmationId = crypto.randomUUID().slice(0, 8).toUpperCase();

  return { ok: true, confirmationId };
}
