import { cn } from "@/lib/utils";

/** Thin animated barber-pole stripe — a brand accent for section edges. */
export function BarberPole({
  className,
  vertical = false,
}: {
  className?: string;
  vertical?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "block overflow-hidden",
        vertical ? "w-1.5" : "h-1.5 w-full",
        className,
      )}
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, var(--color-gold) 0 8px, #ffffff 8px 16px, var(--color-stone-900) 16px 24px, #ffffff 24px 32px)",
        backgroundSize: vertical ? "auto 45px" : "45px auto",
        animation: "navPole 1.4s linear infinite",
      }}
    />
  );
}
