import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework/version (reduces targeted attacks).
  poweredByHeader: false,

  // Surface unsafe lifecycles and double-render side effects in dev.
  reactStrictMode: true,

  // Don't ship source maps to the browser in production (avoid leaking source).
  productionBrowserSourceMaps: false,

  // Security headers + CSP (with per-request nonce) are set in `src/middleware.ts`
  // to keep a single source of truth. See `src/lib/security/csp.ts`.

  // When Supabase storage is used for real images, allow only that host:
  // images: { remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }] },
};

export default nextConfig;
