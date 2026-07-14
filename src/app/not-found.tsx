import Link from "next/link";
import { Home, Scissors } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/** Friendly 404. Static, no data leak. */
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-6 text-center">
      <div className="max-w-md">
        <Logo className="mx-auto justify-center" />
        <p className="mt-8 font-display text-7xl font-semibold text-stone-300">404</p>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-ink">
          Esta página no existe
        </h1>
        <p className="mt-2 text-stone-500">
          Puede que el enlace esté roto o que la barbería haya cambiado de dirección.
        </p>
        <div className="mt-7 flex items-center justify-center gap-2">
          <Link
            href="/"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-stone-900 px-5 text-sm font-medium text-white hover:bg-stone-800"
          >
            <Home className="h-4 w-4" /> Inicio
          </Link>
          <Link
            href="/el-filo"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-stone-300 px-5 text-sm font-medium text-ink hover:bg-stone-50"
          >
            <Scissors className="h-4 w-4" /> Reservar
          </Link>
        </div>
      </div>
    </main>
  );
}
