"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Route error boundary. Shows a friendly message and a retry — never the raw
 * error message or stack (those can leak internals). The `digest` is a safe id
 * users can quote to support; the real error is only in server logs.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="grid min-h-dvh place-items-center bg-cream px-6 text-center">
      <div className="max-w-md">
        <p className="font-display text-6xl font-semibold text-stone-300">Ups</p>
        <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink">
          Algo salió mal
        </h1>
        <p className="mt-2 text-stone-500">
          Tuvimos un problema al cargar esta página. Puedes reintentar o volver al
          inicio.
        </p>
        {error.digest && (
          <p className="mt-3 text-xs text-stone-400">
            Código de referencia:{" "}
            <span className="tnum font-medium text-stone-500">{error.digest}</span>
          </p>
        )}
        <div className="mt-7 flex items-center justify-center gap-2">
          <Button onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Reintentar
          </Button>
          <Link
            href="/"
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-stone-600 hover:text-ink"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
