"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarCog,
  CreditCard,
  Globe,
  Landmark,
  Store,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/configuracion", label: "Negocio", icon: Store },
  { href: "/dashboard/configuracion/reservas", label: "Reservas", icon: CalendarCog },
  { href: "/dashboard/configuracion/dominio", label: "Dominio", icon: Globe },
  { href: "/dashboard/configuracion/notificaciones", label: "Notificaciones", icon: Bell },
  { href: "/dashboard/configuracion/pagos", label: "Pagos", icon: Landmark },
  { href: "/dashboard/configuracion/equipo", label: "Equipo", icon: Users },
  { href: "/dashboard/configuracion/plan", label: "Plan y facturación", icon: CreditCard },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Secciones de configuración"
      className="-mx-1 mb-7 flex gap-1.5 overflow-x-auto px-1 pb-1"
    >
      {TABS.map((t) => {
        const active =
          t.href === "/dashboard/configuracion"
            ? pathname === t.href
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-stone-900 text-white"
                : "text-stone-500 hover:bg-stone-100 hover:text-ink",
            )}
          >
            <t.icon className={cn("h-4 w-4", active ? "text-gold-400" : "text-stone-400")} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
