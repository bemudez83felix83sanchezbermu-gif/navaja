import { envSchema } from "./validation";

/**
 * Validated, typed environment access. Import this instead of touching
 * `process.env` directly so that:
 *   1. A misconfigured deploy fails fast and loudly (in production) instead of
 *      breaking mysteriously at runtime.
 *   2. Secrets are never accidentally read on the client. The keys without the
 *      `NEXT_PUBLIC_` prefix (e.g. SUPABASE_SERVICE_ROLE_KEY) are server-only;
 *      Next.js strips them from the client bundle, and this module must only be
 *      imported from server code.
 *
 * Today every backend var is optional (the app runs on the in-memory mock data
 * layer). When Supabase is connected, make the relevant fields required in
 * `envSchema` and the build will enforce their presence.
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  const msg = `❌ Variables de entorno inválidas:\n${issues}`;
  // Fail hard in production; warn (don't crash dev) while iterating locally.
  if (process.env.NODE_ENV === "production") throw new Error(msg);
  else console.warn(msg);
}

export const env = (parsed.success ? parsed.data : { NODE_ENV: "development" }) as
  ReturnType<typeof envSchema.parse>;

/** Convenience flag used by the CSP builder and elsewhere. */
export const isProd = env.NODE_ENV === "production";
