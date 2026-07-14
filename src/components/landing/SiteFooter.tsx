import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { BarberPole } from "@/components/brand/BarberPole";

const cols = [
  {
    title: "Producto",
    links: [
      { label: "Funciones", href: "#funciones" },
      { label: "Precios", href: "#precios" },
      { label: "Demo de reserva", href: "/el-filo" },
      { label: "Panel demo", href: "/dashboard" },
    ],
  },
  {
    title: "Recursos",
    links: [
      { label: "Centro de ayuda", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Estado del sistema", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacidad", href: "#" },
      { label: "Términos", href: "#" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="relative bg-stone-950 text-stone-400">
      <BarberPole />
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Logo tone="light" />
          <p className="mt-4 text-sm leading-relaxed text-stone-500">
            La agenda sin fricción para barberías modernas. Menos llamadas, menos
            huecos, más cortes.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <h4 className="text-sm font-semibold text-white">{c.title}</h4>
            <ul className="mt-4 space-y-3 text-sm">
              {c.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/5">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-stone-500 sm:flex-row sm:px-8">
          <p>© {new Date().getFullYear()} Navaja. Hecho para barberos.</p>
          <p>Diseñado en México · es-MX</p>
        </div>
      </div>
    </footer>
  );
}
