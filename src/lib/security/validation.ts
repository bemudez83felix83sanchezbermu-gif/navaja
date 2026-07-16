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

/** IDs reales de la base de datos (uuid v4 de Postgres). */
export const uuidSchema = z.string().uuid("Identificador inválido");

/**
 * Booking submission. Includes anti-bot fields:
 *  - `company`  → honeypot. Real users never see it; bots fill it. Must be empty.
 *  - `startedAt`→ epoch ms when the wizard opened. Submissions faster than
 *                 MIN_FILL_MS are almost certainly bots.
 */
export const MIN_FILL_MS = 2500;

export const bookingInputSchema = z
  .object({
    shopId: uuidSchema,
    serviceId: uuidSchema,
    barberId: z.union([uuidSchema, z.literal("any")]),
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

/* ------------------------------------------------------------------ *
 * Self-service settings (dashboard) — every mutation crosses this
 * boundary before touching the store. Same rules as booking: strict
 * objects, bounded strings, no mass-assignment.
 * ------------------------------------------------------------------ */

/** Tenant slug: becomes `{slug}.navaja.app`. Mirrors the DB check constraint. */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, "Solo minúsculas, números y guiones (2–40)")
  .refine((s) => !s.includes("--"), "Sin guiones dobles");

/** Reserved labels: ni subdominios de tenant ni slugs que tapen rutas de la app. */
export const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "dashboard", "panel", "mail", "smtp",
  "soporte", "ayuda", "blog", "docs", "status", "cdn", "assets", "dominios",
  // rutas de cuenta y legales (src/app/*): un tenant con este slug las taparía
  "login", "registro", "recuperar", "restablecer", "auth", "legal", "cuenta",
]);

/**
 * Hostname (RFC-ish, pragmatic): labels of [a-z0-9-], at least one dot,
 * no scheme/path/port. Lowercased on input.
 */
export const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(253, "Dominio demasiado largo")
  .regex(
    /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/,
    "Escribe solo el dominio, p. ej. mibarberia.com",
  );

export const shopProfileSchema = z
  .object({
    name: boundedString(2, 80),
    tagline: boundedString(0, 120).optional().default(""),
    address: boundedString(0, 160).optional().default(""),
    phone,
    timezone: boundedString(2, 60),
    openDays: z.array(z.number().int().min(0).max(6)).min(1, "Abre al menos un día").max(7),
    openHour: z.number().int().min(0).max(23),
    closeHour: z.number().int().min(1).max(24),
  })
  .strict()
  .refine((d) => d.closeHour > d.openHour, {
    message: "La hora de cierre debe ser después de la de apertura",
    path: ["closeHour"],
  });

export const bookingRulesSchema = z
  .object({
    slotStepMin: z.union([z.literal(15), z.literal(20), z.literal(30), z.literal(60)]),
    minNoticeMin: z.number().int().min(0).max(48 * 60),
    maxAdvanceDays: z.number().int().min(1).max(180),
    autoConfirm: z.boolean(),
    cancellationWindowHours: z.number().int().min(0).max(72),
    allowBarberChoice: z.boolean(),
    requireEmail: z.boolean(),
  })
  .strict();

export const notificationsSchema = z
  .object({
    confirmationEmail: z.boolean(),
    reminder24h: z.boolean(),
    reminder2h: z.boolean(),
    whatsappChannel: z.boolean(),
    ownerNewBookingEmail: z.boolean(),
    senderName: boundedString(2, 60),
    /** WhatsApp del dueño; vacío = aún sin configurar. */
    ownerPhone: z.union([z.literal(""), phone]),
  })
  .strict();

/* ------------------------------------------------------------------ *
 * Cuentas (registro / login / recuperación)
 * ------------------------------------------------------------------ */

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Correo inválido")
  .max(120);

/** Contraseña: 8–72 (límite bcrypt), al menos una letra y un número. */
export const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .max(72, "Máximo 72 caracteres")
  .regex(/[a-zA-Z]/, "Incluye al menos una letra")
  .regex(/[0-9]/, "Incluye al menos un número");

export const signupSchema = z
  .object({
    ownerName: boundedString(2, 80),
    shopName: boundedString(2, 80),
    email: emailSchema,
    password: passwordSchema,
    /** Consentimiento LFPDPPP: sin aceptar Términos + Aviso no hay cuenta. */
    acceptTerms: z.literal(true, {
      message: "Debes aceptar los Términos y el Aviso de Privacidad",
    }),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, "Escribe tu contraseña").max(72),
  })
  .strict();

export const inviteMemberSchema = z
  .object({
    name: boundedString(2, 80),
    email: z.string().trim().toLowerCase().email("Correo inválido").max(120),
    role: z.enum(["owner", "staff"]),
  })
  .strict();

export const planIdSchema = z.enum(["esencial", "pro", "estudio"]);

/** Id de entidad: uuid de la DB o "sub" (el subdominio administrado, sintético). */
export const entityIdSchema = z.union([uuidSchema, z.literal("sub")]);

/* ------------------------------------------------------------------ *
 * CRUD de catálogo (servicios y barberos)
 * ------------------------------------------------------------------ */

export const serviceInputSchema = z
  .object({
    id: uuidSchema.optional(),
    name: boundedString(2, 80),
    description: boundedString(0, 200).optional().default(""),
    durationMin: z.number().int().min(5, "Mínimo 5 min").max(600, "Máximo 10 h"),
    priceCents: z.number().int().min(0, "Precio inválido").max(10_000_000),
    popular: z.boolean(),
  })
  .strict();

export const barberInputSchema = z
  .object({
    id: uuidSchema.optional(),
    name: boundedString(2, 80),
    role: boundedString(0, 60).optional().default(""),
    bio: boundedString(0, 300).optional().default(""),
    specialties: z.array(boundedString(1, 30)).max(8, "Máximo 8 especialidades"),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido"),
    serviceIds: z.array(uuidSchema).max(50),
  })
  .strict();

export const activeToggleSchema = z
  .object({ id: uuidSchema, active: z.boolean() })
  .strict();

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
