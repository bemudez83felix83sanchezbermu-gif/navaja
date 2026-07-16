"use client";

import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

/** Sincroniza el tema con el mundo exterior: atributo en <html> + cookie
 *  que el root layout lee en el SSR (cero flash). Vive a nivel módulo porque
 *  muta sistemas externos — no es lógica de render. */
function persistTheme(next: Theme) {
  document.documentElement.setAttribute("data-theme", next);
  document.cookie = `navaja-theme=${next}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Interruptor claro/oscuro del dashboard. `initialTheme` viene del servidor
 * (cookie), así el estado inicial coincide con el SSR sin efectos ni flash.
 */
export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  const apply = (next: Theme) => {
    setTheme(next);
    persistTheme(next);
  };

  return (
    <div
      role="group"
      aria-label="Tema del panel"
      className="flex items-center rounded-xl border border-white/10 bg-white/[0.03] p-1"
    >
      {(
        [
          { id: "light", icon: Sun, label: "Claro" },
          { id: "dark", icon: Moon, label: "Oscuro" },
        ] as const
      ).map((t) => (
        <button
          key={t.id}
          onClick={() => apply(t.id)}
          aria-pressed={theme === t.id}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors",
            theme === t.id
              ? "bg-white/10 text-white"
              : "text-stone-500 hover:text-stone-300",
          )}
        >
          <t.icon className="h-3.5 w-3.5" />
          {t.label}
        </button>
      ))}
    </div>
  );
}
