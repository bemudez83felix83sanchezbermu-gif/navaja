/**
 * Tenant resolution by hostname — the routing heart of the multi-tenant SaaS.
 *
 * Every barbershop is reachable at:
 *   1. `{slug}.navaja.app`        — managed subdomain, automatic.
 *   2. `barberiaelfilo.com`       — the shop's own domain (BYO), once verified.
 *   3. `navaja.app/{slug}`        — path fallback (kept for the demo/dev).
 *
 * This module is imported by the proxy, so it stays dependency-free: it reads
 * the mock settings straight off `globalThis` instead of importing the data
 * layer (which would drag the whole appointment seed into the proxy bundle).
 * In production this becomes a KV/DB lookup (domains table, see supabase/).
 */

import type { ShopDomain } from "@/lib/data/types";

export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "navaja.app";

/** Hosts that serve the marketing site + dashboard (not a tenant). */
const APP_HOSTS = new Set([
  ROOT_DOMAIN,
  `www.${ROOT_DOMAIN}`,
  "localhost",
  "127.0.0.1",
  "lvh.me",
]);

/** Suffixes whose first label is treated as a tenant slug. `.localhost` works
 *  in every modern browser without /etc/hosts — try el-filo.localhost:3000. */
const SUBDOMAIN_SUFFIXES = [`.${ROOT_DOMAIN}`, ".localhost", ".lvh.me"];

const SLUG_RE = /^[a-z0-9-]{2,40}$/;

function settingsDomains(): ShopDomain[] {
  const g = globalThis as { __navajaSettings?: { domains?: ShopDomain[] } };
  return g.__navajaSettings?.domains ?? [];
}

/**
 * Map a request Host header to a tenant slug, or `null` when the host is the
 * main app (marketing + dashboard) or unknown.
 */
export function resolveTenant(hostHeader: string | null): string | null {
  if (!hostHeader) return null;
  const host = hostHeader.toLowerCase().split(":")[0]; // strip port

  if (APP_HOSTS.has(host)) return null;

  // 1) Managed subdomain → slug is the first label.
  for (const suffix of SUBDOMAIN_SUFFIXES) {
    if (host.endsWith(suffix)) {
      const slug = host.slice(0, -suffix.length);
      return slug !== "www" && SLUG_RE.test(slug) ? slug : null;
    }
  }

  // 2) Custom domain → only ACTIVE, verified domains route traffic.
  const domains = settingsDomains();
  const match = domains.find(
    (d) => d.kind === "propio" && d.status === "activo" && d.domain === host,
  );
  if (match) {
    // Single-tenant mock: derive the slug from the managed subdomain record.
    const sub = domains.find((d) => d.kind === "subdominio");
    const slug = sub?.domain.split(".")[0];
    if (slug && SLUG_RE.test(slug)) return slug;
  }

  // Unknown host: fall through to the main site (prod would 404 or redirect).
  return null;
}
