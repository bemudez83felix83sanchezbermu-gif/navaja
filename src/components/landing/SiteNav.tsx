import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

const links = [
  { href: "#funciones", label: "Funciones" },
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#precios", label: "Precios" },
];

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-stone-950/60 px-3 py-1.5 backdrop-blur-xl">
          <Link href="/" aria-label="Inicio">
            <Logo tone="light" />
          </Link>
        </div>

        <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-stone-950/60 px-2 py-1.5 backdrop-blur-xl md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-stone-300 transition-colors hover:bg-white/5 hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-stone-300 transition-colors hover:text-white sm:block"
          >
            Entrar
          </Link>
          <ButtonLink href="/dashboard" size="sm" className="rounded-full">
            Empezar gratis
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
