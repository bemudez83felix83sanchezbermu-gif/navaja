import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, securityHeaders } from "@/lib/security/csp";

/**
 * Proxy (Next.js 16's renamed "middleware") — runs on every non-static request
 * and is the app's security gateway. Responsibilities:
 *
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

  const response = NextResponse.next({ request: { headers: requestHeaders } });

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
