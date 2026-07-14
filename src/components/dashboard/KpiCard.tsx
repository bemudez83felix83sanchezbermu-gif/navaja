import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  trend?: { value: string; up: boolean };
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-stone-900 text-gold-400">
          <Icon className="h-5 w-5" strokeWidth={2} />
        </span>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
              trend.up ? "bg-success-bg text-success" : "bg-destructive-bg text-destructive",
            )}
          >
            {trend.up ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {trend.value}
          </span>
        )}
      </div>
      <p className="mt-4 text-sm text-stone-500">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink tnum">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-stone-400">{hint}</p>}
    </Card>
  );
}
