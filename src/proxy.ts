import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { buildCsp, securityHeaders } from "@/lib/security/csp";
import { resolveCustomDomain, resolveTenant } from "@/lib/tenant";

/**
 * Proxy (Next.js 16's renamed "middleware") — runs on every non-static request.
 * Three responsibilities:
 *
 * A. **Multi-tenant routing by Host.** `{slug}.navaja.app` and verified custom
 *    domains rewrite internally to the `/[shop]` route, so each barbershop
 *    lives on its own domain while the app stays a single deployment
 *    (Caddy terminates TLS per-domain via on_demand_tls; see the vault).
 *    `/legal/*` never rewrites: el Aviso de Privacidad y los Términos deben
 *    ser alcanzables también desde la página de reservas de cada tenant.
 *
 * B. **Session keep-alive + optimistic auth check** (solo host principal):
 *    refresca el token de Supabase (los Server Components no pueden escribir
 *    cookies, así que el refresh vive aquí — patrón oficial @supabase/ssr) y
 *    redirige a /login si alguien pide /dashboard sin sesión. Es el chequeo
 *    OPTIMISTA; el candado real está en la capa de datos (lib/auth.ts).
 *
 * C. **Security gateway** (unchanged):
 *   1. Generate a fresh, unguessable **nonce** per request.
 *   2. Build a **Content-Security-Policy** with that nonce and set it on both the
 *      request (so Next.js stamps the nonce onto its own <script> tags) and the
 *      response (so the browser enforces it).
 *   3. Attach the rest of the **security headers**.
 *
 * All policy lives in `@/lib/security/csp` so there is a single source of truth.
 */

/** Rutas del host principal que necesitan sesión fresca en cada request. */
const SESSION_PATHS = ["/dashboard", "/restablecer"];

type PendingCookie = { name: string; value: string; options?: CookieOptions };

/**
 * Refresca la sesión de Supabase. Muta las cookies del request (para que el
 * render de este mismo request vea el token nuevo) y acumula en `pending` las
 * cookies que hay que devolver al navegador con la respuesta final.
 */
async function refreshSession(
  request: NextRequest,
  pending: PendingCookie[],
): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;

  // Sin cookie de sesión no hay nada que refrescar: evita el viaje a Supabase.
  if (!request.cookies.getAll().some((c) => c.name.includes("-auth-token"))) {
    return false;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        pending.push(...toSet);
      },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  return !error && !!data.user;
}

export async function proxy(request: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";

  // --- Tenant routing: host → /[shop] rewrite -------------------------------
  // Subdominios se resuelven parseando el host (sin I/O); dominios propios
  // consultan la tabla `domains` con caché de 60s (ver lib/tenant.ts).
  const host = request.headers.get("host");
  const slug = resolveTenant(host) ?? (await resolveCustomDomain(host));
  const { pathname } = request.nextUrl;

  // --- Auth: refresh + guard (solo en el host de la app) --------------------
  const pendingCookies: PendingCookie[] = [];
  if (!slug && SESSION_PATHS.some((p) => pathname.startsWith(p))) {
    const authenticated = await refreshSession(request, pendingCookies);
    if (!authenticated && pathname.startsWith("/dashboard")) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      pendingCookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options),
      );
      return response;
    }
  }

  // Web Crypto nonce (runtime-safe — no Node Buffer dependency).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const nonce = btoa(String.fromCharCode(...bytes));

  const csp = buildCsp(nonce, isProd);

  // Copia DESPUÉS del refresh de sesión: así el header Cookie que viaja al
  // render ya trae el token renovado.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let response: NextResponse;
  const isSharedPath = pathname.startsWith("/legal");
  if (slug && !isSharedPath && !pathname.startsWith(`/${slug}`)) {
    // On a tenant domain the whole site IS the booking page. Anything the
    // tenant route doesn't define (e.g. /dashboard) 404s — the dashboard is
    // only reachable on the app host. That isolation is intentional.
    const url = request.nextUrl.clone();
    url.pathname = `/${slug}${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
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
