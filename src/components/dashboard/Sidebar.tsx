"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  ChevronsUpDown,
  LayoutDashboard,
  ListChecks,
  Menu,
  Scissors,
  Settings,
  UserRound,
  Users,
  X,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/brand/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Resumen", icon: LayoutDashboard },
  { href: "/dashboard/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/dashboard/citas", label: "Citas", icon: ListChecks },
  { href: "/dashboard/reportes", label: "Reportes", icon: BarChart3 },
  { href: "/dashboard/servicios", label: "Servicios", icon: Scissors },
  { href: "/dashboard/barberos", label: "Barberos", icon: Users },
  { href: "/dashboard/clientes", label: "Clientes", icon: UserRound },
  { href: "/dashboard/configuracion", label: "Configuración", icon: Settings },
];

type ShopProps = {
  shopName: string;
  shopArea: string;
  ownerName: string;
  slug: string;
  initialTheme: "light" | "dark";
};

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {NAV.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-white"
                : "text-stone-400 hover:bg-white/5 hover:text-white",
            )}
          >
            <item.icon
              className={cn(
                "h-[18px] w-[18px] transition-colors",
                active ? "text-gold-400" : "text-stone-500 group-hover:text-stone-300",
              )}
              strokeWidth={2}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Panel({ shop, onNavigate }: { shop: ShopProps; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-5">
      <div className="px-1">
        <Link href="/" aria-label="Navaja">
          <Logo tone="light" />
        </Link>
      </div>

      <button className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold font-display text-sm font-bold text-white">
          {shop.shopName.replace(/^Barbería\s+/i, "").charAt(0) || "N"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">
            {shop.shopName}
          </span>
          <span className="block truncate text-xs text-stone-500">{shop.shopArea}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 text-stone-500" />
      </button>

      <div className="flex-1">
        <p className="mb-2 px-3 text-[0.7rem] font-semibold uppercase tracking-wider text-stone-600">
          Gestión
        </p>
        <NavList onNavigate={onNavigate} />
      </div>

      <div className="space-y-3">
        <ThemeToggle initialTheme={shop.initialTheme} />
        <Link
          href={`/${shop.slug}`}
          className="flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2.5 text-sm font-semibold text-gold-300 transition-colors hover:bg-gold/15"
        >
          <ExternalLink className="h-4 w-4" />
          Ver página de reservas
        </Link>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-2.5">
          <Avatar name={shop.ownerName} accent="#a16207" size={34} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">
              {shop.ownerName}
            </span>
            <span className="block truncate text-xs text-stone-500">Dueño</span>
          </span>
          <form action={logout}>
            <button
              type="submit"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export function Sidebar(props: ShopProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Desktop */}
      <aside className="sticky top-0 hidden h-dvh w-[16.5rem] shrink-0 bg-stone-950 lg:block">
        <Panel shop={props} />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-stone-200 bg-stone-950 px-4 py-3 lg:hidden">
        <Logo tone="light" />
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir menú"
          className="grid h-10 w-10 place-items-center rounded-xl text-white hover:bg-white/10"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[17rem] bg-stone-950 shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-stone-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <Panel shop={props} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
