import { cn } from "@/lib/utils";

/**
 * Navaja brand mark — a stylised straight-razor (navaja) inside a gold badge,
 * paired with a Playfair wordmark. Pure SVG, scales crisply, theme-aware.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("h-9 w-9", className)}
      role="img"
      aria-label="Navaja"
    >
      <defs>
        <linearGradient id="nav-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8c986" />
          <stop offset="0.5" stopColor="#ca8a04" />
          <stop offset="1" stopColor="#a16207" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="40" height="40" rx="11" fill="#1c1917" />
      <rect x="1" y="1" width="38" height="38" rx="10" fill="none" stroke="url(#nav-gold)" strokeOpacity="0.5" />
      <g transform="rotate(-38 20 20)">
        {/* blade */}
        <rect x="7" y="17.5" width="19" height="5.4" rx="2.7" fill="url(#nav-gold)" />
        {/* spine highlight */}
        <rect x="8" y="18.4" width="16.5" height="1.2" rx="0.6" fill="#fff" fillOpacity="0.55" />
        {/* tang / handle */}
        <rect x="25" y="18" width="9" height="4.4" rx="2.2" fill="#57534e" />
        {/* pivot */}
        <circle cx="26.4" cy="20.2" r="1.3" fill="#e8c986" />
      </g>
    </svg>
  );
}

export function Logo({
  className,
  tone = "dark",
  withWordmark = true,
}: {
  className?: string;
  tone?: "dark" | "light";
  withWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      {withWordmark && (
        <span
          className={cn(
            "font-display text-[1.45rem] font-semibold leading-none tracking-tight",
            tone === "light" ? "text-white" : "text-ink",
          )}
        >
          Navaja
        </span>
      )}
    </span>
  );
}
