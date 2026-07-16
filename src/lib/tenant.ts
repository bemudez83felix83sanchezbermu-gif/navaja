/**
 * Resolución de tenant por hostname — el corazón de ruteo del SaaS.
 *
 * Cada barbería es alcanzable en:
 *   1. `{slug}.navaja.app`   — subdominio administrado (se parsea, sin DB).
 *   2. `barberiaelfilo.com`  — dominio propio (BYO) verificado → tabla `domains`.
 *   3. `navaja.app/{slug}`   — fallback por ruta (demo/dev).
 *
 * El lookup de dominios propios va a Postgres con la llave ANON (RLS solo
 * expone dominios ACTIVOS) y se cachea en memoria 60s por proceso: el proxy
 * corre en cada request y un dominio recién verificado tarda ≤60s en rutear.
 */

import { dbAnon } from "@/lib/db";

export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "navaja.app";

/** Hosts que sirven la app principal (marketing + dashboard), no un tenant. */
const APP_HOSTS = new Set([
  ROOT_DOMAIN,
  `www.${ROOT_DOMAIN}`,
  "localhost",
  "127.0.0.1",
  "lvh.me",
]);

/** Sufijos cuyo primer label se trata como slug del tenant. `.localhost`
 *  funciona en todo navegador moderno sin /etc/hosts — el-filo.localhost:3000. */
const SUBDOMAIN_SUFFIXES = [`.${ROOT_DOMAIN}`, ".localhost", ".lvh.me"];

const SLUG_RE = /^[a-z0-9-]{2,40}$/;

/**
 * Resolución SÍNCRONA (sin DB): subdominios administrados.
 * Devuelve el slug, o null si el host es la app principal / desconocido.
 */
export function resolveTenant(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.toLowerCase().split(":")[0]; // sin puerto

  if (APP_HOSTS.has(host)) return null;

  for (const suffix of SUBDOMAIN_SUFFIXES) {
    if (host.endsWith(suffix)) {
      const slug = host.slice(0, -suffix.length);
      return slug !== "www" && SLUG_RE.test(slug) ? slug : null;
    }
  }
  return null;
}

/* --- Dominios propios: lookup con caché TTL ------------------------------ */

const TTL_MS = 60_000;
const MAX_ENTRIES = 500;
const domainCache = new Map<string, { slug: string | null; exp: number }>();

/**
 * ¿Este host es un dominio propio ACTIVO de algún tenant? → slug o null.
 * Solo se llama para hosts que no son app ni subdominio administrado.
 */
export async function resolveCustomDomain(
  hostHeader: string | null,
): Promise<string | null> {
  if (!hostHeader) return null;
  const host = hostHeader.toLowerCase().split(":")[0];

  if (APP_HOSTS.has(host)) return null;
  if (SUBDOMAIN_SUFFIXES.some((s) => host.endsWith(s))) return null;
  if (!host.includes(".")) return null;

  const hit = domainCache.get(host);
  if (hit && hit.exp > Date.now()) return hit.slug;

  let slug: string | null = null;
  try {
    const { data } = await dbAnon()
      .from("domains")
      .select("domain, barbershops!inner(slug)")
      .eq("domain", host)
      .eq("status", "activo")
      .maybeSingle();
    const shop = data?.barbershops as unknown as { slug: string } | undefined;
    slug = shop && SLUG_RE.test(shop.slug) ? shop.slug : null;
  } catch {
    // DB caída ≠ sitio caído: el host desconocido cae a la app principal.
    slug = null;
  }

  if (domainCache.size >= MAX_ENTRIES) {
    const first = domainCache.keys().next().value;
    if (first) domainCache.delete(first);
  }
  domainCache.set(host, { slug, exp: Date.now() + TTL_MS });
  return slug;
}
