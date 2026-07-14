import type { MetadataRoute } from "next";

/**
 * robots.txt — allow the public marketing + booking pages, keep the private
 * owner dashboard and server actions out of search indexes.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/actions"],
    },
  };
}
