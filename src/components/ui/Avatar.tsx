import { cn, initials } from "@/lib/utils";

/** Initials avatar with a brand tint — reliable, no external image needed. */
export function Avatar({
  name,
  accent = "#a16207",
  size = 40,
  className,
}: {
  name: string;
  accent?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-1 ring-black/5",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundImage: `linear-gradient(140deg, ${accent}, color-mix(in oklab, ${accent} 60%, #000))`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
