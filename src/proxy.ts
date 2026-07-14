import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, securityHeaders } from "@/lib/security/csp";
import { resolveTenant } from "@/lib/tenant";

/**
 * Proxy (Next.js 16's renamed "middleware") — runs on every non-static request.
 * Two responsibilities:
 *
 * A. **Multi-tenant routing by Host.** `{slug}.navaja.app` and verified custom
 *    domains rewrite internally to the `/[shop]` route, so each barbershop
 *    lives on its own domain while the app stays a single deployment
 *    (Caddy terminates TLS per-domain via on_demand_tls; see the vault).
 *
 * B. **Security gateway** (unchanged):
 *   1. Generate a fresh, unguessable **nonce** per request.
 *   2. Build a **Content-Security-Policy** with that nonce and set it on both the
 *      request (so Next.js stamps the nonce onto its own <script> tags) and the
 *      response (so the browser enforces it). This is the approach documented in
 *      Next's official CSP guide.
 *   3. Attach the rest of the **security headers** (HSTS, anti-clickjacking,
 *      nosniff, referrer & permissions policy, cross-origin isolation).
 *
 * All policy lives in `@/lib/security/csp` so there is a single source of truth.
 */
export function proxy(request: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";

  // Web Crypto nonce (runtime-safe — no Node Buffer dependency).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));

  const csp = buildCsp(nonce, isProd);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  // --- Tenant routing: host → /[shop] rewrite -------------------------------
  const slug = resolveTenant(request.headers.get("host"));
  const { pathname } = request.nextUrl;

  let response: NextResponse;
  if (slug && !pathname.startsWith(`/${slug}`)) {
    // On a tenant domain the whole site IS the booking page. Anything the
    // tenant route doesn't define (e.g. /dashboard) 404s — the dashboard is
    // only reachable on the app host. That isolation is intentional.
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  response.headers.set("Content-Security-Policy", csp);
  for (const [key, value] of Object.entries(securityHeaders(isProd))) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  /**
   * Run on everything except static assets and image files — those don't need a
   * nonce and skipping them keeps the proxy fast.
   */
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
    },
  ],
};
