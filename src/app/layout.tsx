import type { Metadata } from "next";
import { Inter, Playfair_Display, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

/**
 * Force dynamic rendering app-wide. Required so the per-request CSP nonce
 * (set in `src/proxy.ts`) is stamped onto Next's scripts at request time — a
 * statically prerendered page can't carry a fresh nonce. This is the documented
 * trade-off of nonce-based CSP. See SECURITY.md.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Navaja — Agenda sin fricción para barberías",
    template: "%s · Navaja",
  },
  description:
    "El sistema de agendamiento de citas para barberías modernas. Tu agenda, tus barberos y tus clientes en un solo lugar. Sin llamadas, sin huecos vacíos.",
  metadataBase: new URL("https://navaja.app"),
  openGraph: {
    title: "Navaja — Agenda sin fricción para barberías",
    description:
      "El sistema de agendamiento de citas para barberías modernas.",
    type: "website",
    locale: "es_MX",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${playfair.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
