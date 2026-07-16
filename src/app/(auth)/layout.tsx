import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

/**
 * Layout de las páginas de cuenta (login/registro/recuperar/restablecer):
 * tarjeta centrada sobre el mismo fondo oscuro de la landing, con enlaces
 * legales siempre visibles al pie.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grain relative flex min-h-dvh flex-col bg-stone-950">
      <div className="glow-gold pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-0 h-[36rem] w-[36rem] rounded-full opacity-15 blur-3xl"
        style={{ background: "radial-gradient(circle, #ca8a04, transparent 60%)" }}
      />

      <header className="relative z-10 mx-auto w-full max-w-7xl px-5 pt-8 sm:px-8">
        <Link href="/" aria-label="Inicio" className="inline-block">
          <Logo tone="light" />
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md animate-rise rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-7 shadow-2xl backdrop-blur sm:p-9">
          {children}
        </div>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-5 pb-8 text-xs text-stone-500 sm:flex-row sm:px-8">
        <p>© {new Date().getFullYear()} Navaja</p>
        <nav className="flex gap-5">
          <Link href="/legal/terminos" className="transition-colors hover:text-stone-300">
            Términos y Condiciones
          </Link>
          <Link href="/legal/privacidad" className="transition-colors hover:text-stone-300">
            Aviso de Privacidad
          </Link>
        </nav>
      </footer>
    </div>
  );
}
