"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Overlay accesible con dos presentaciones:
 *  - `center`: modal clásico (formularios CRUD).
 *  - `right`: drawer lateral (detalle de cita en la agenda).
 * Cierra con Escape, click en el fondo o el botón ×. Bloquea el scroll del
 * body mientras está abierto.
 */
export function Modal({
  open,
  onClose,
  title,
  side = "center",
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "center" | "right";
  children: React.ReactNode;
  /** modal centrado más ancho (formularios de dos columnas) */
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex",
        side === "right" ? "justify-end" : "items-center justify-center p-4",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 cursor-default bg-stone-950/40 backdrop-blur-[2px]"
      />
      <div
        className={cn(
          "relative flex flex-col bg-card shadow-[var(--shadow-lift)]",
          side === "right"
            ? "animate-drawer-in h-dvh w-full max-w-md border-l border-stone-200"
            : cn(
                "animate-pop-in max-h-[90dvh] w-full rounded-2xl border border-stone-200",
                wide ? "max-w-2xl" : "max-w-lg",
              ),
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
