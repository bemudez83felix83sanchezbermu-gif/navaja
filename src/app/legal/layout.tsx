import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { SiteFooter } from "@/components/landing/SiteFooter";

/**
 * Layout de documentos legales. Estas rutas también se sirven desde los
 * dominios de cada tenant (el proxy no las reescribe) porque la página de
 * reservas enlaza al Aviso de Privacidad.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-stone-950 text-stone-300">
      <header className="border-b border-white/5">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="Inicio">
            <Logo tone="light" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-stone-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al inicio
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-14 sm:px-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
