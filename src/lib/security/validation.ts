import { z } from "zod";

/**
 * Input validation schemas (Zod).
 *
 * Security role: this is the trust boundary. **Never** trust data coming from the
 * client. Every value that crosses into a Server Action or (future) API route is
 * parsed here first. Parsing both validates *and* strips unknown keys, so a
 * malicious client cannot inject extra fields (mass-assignment protection).
 *
 * These schemas are shared by the client (for instant UX feedback) and the server
 * (as the authoritative check). The server check is the one that matters.
 */

/** Reusable, length-bounded, trimmed string — prevents oversized payloads. */
const boundedString = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

/** Phone: allow digits, spaces and + ( ) -, 8–20 chars. Not locale-strict on purpose. */
const phone = z
  .string()
  .trim()
  .min(8, "Teléfono demasiado corto")
  .max(20, "Teléfono demasiado largo")
  .regex(/^[\d\s()+-]+$/, "Teléfono inválido");

/** IDs in the data model are opaque slugs/uuids — restrict the charset. */
const id = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, "Identificador inválido");

/**
 * Booking submission. Includes anti-bot fields:
 *  - `company`  → honeypot. Real users never see it; bots fill it. Must be empty.
 *  - `startedAt`→ epoch ms when the wizard opened. Submissions faster than
 *                 MIN_FILL_MS are almost certainly bots.
 */
export const MIN_FILL_MS = 2500;

export const bookingInputSchema = z
  .object({
    serviceId: id,
    barberId: z.union([id, z.literal("any")]),
    slotIso: z
      .string()
      .datetime({ message: "Fecha/hora inválida" })
      .refine((s) => new Date(s).getTime() > Date.now() - 60_000, {
        message: "El horario ya pasó",
      }),
    name: boundedString(2, 80),
    phone,
    email: z.union([z.literal(""), z.string().trim().email().max(120)]).optional(),
    notes: boundedString(0, 500).optional(),
    // anti-bot
    company: z.string().max(0, "Bot detectado").optional().default(""),
    startedAt: z.number().int().positive(),
  })
  .strict() // reject unknown keys
  .refine((d) => Date.now() - d.startedAt >= MIN_FILL_MS, {
    message: "Envío demasiado rápido",
    path: ["startedAt"],
  });

export type BookingInput = z.infer<typeof bookingInputSchema>;

/**
 * Server-side environment validation schema. See `env.ts`.
 * All optional today (no backend yet); flip to required when Supabase is wired.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
});
