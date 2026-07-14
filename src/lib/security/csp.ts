/**
 * Content-Security-Policy builder.
 *
 * Strategy:
 *  - **Production**: nonce-based, `'strict-dynamic'`, no `'unsafe-inline'` for
 *    scripts. This is the strong configuration — even if an attacker injects a
 *    <script>, the browser refuses to run it without the per-request nonce.
 *  - **Development**: relaxed so Turbopack/React Fast Refresh (which use eval and
 *    inline bootstrapping) and the HMR websocket keep working.
 *
 * `style-src` keeps `'unsafe-inline'` in both modes because the UI uses inline
 * `style={...}` attributes (Tailwind tokens, brand tints). Inline *style attrs*
 * cannot carry a nonce; the risk is low (no script execution) and accepted —
 * documented in `SECURITY.md`.
 *
 * `connect-src` includes the Supabase URL when configured, so the future client
 * can reach the database without weakening the policy elsewhere.
 */
export function buildCsp(nonce: string, isProd: boolean): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'unsafe-eval' 'unsafe-inline'`;

  const connectSrc = isProd
    ? `'self' ${supabase}`.trim()
    : `'self' ${supabase} ws: wss: http://localhost:* https://localhost:*`.trim();

  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": scriptSrc,
    "style-src": "'self' 'unsafe-inline'",
    "img-src": "'self' data: blob:",
    "font-src": "'self' data:",
    "connect-src": connectSrc,
    "form-action": "'self'",
    "frame-ancestors": "'none'", // clickjacking protection
    "frame-src": "'none'",
    "base-uri": "'self'",
    "object-src": "'none'",
    "worker-src": "'self' blob:",
    "manifest-src": "'self'",
  };

  let csp = Object.entries(directives)
    .map(([k, v]) => `${k} ${v}`)
    .join("; ");

  // Force HTTPS for any subresource in production.
  if (isProd) csp += "; upgrade-insecure-requests";

  return csp;
}

/**
 * Static security headers (no nonce needed). Applied alongside the CSP.
 * Kept here as the single source of truth; `next.config.ts` and the middleware
 * both read from this list.
 */
export function securityHeaders(isProd: boolean): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-DNS-Prefetch-Control": "off",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), browsing-topics=(), interest-cohort=()",
  };
  // HSTS only in production (don't pin localhost to HTTPS).
  if (isProd) {
    headers["Strict-Transport-Security"] =
      "max-age=63072000; includeSubDomains; preload";
  }
  return headers;
}
