import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Shared field chrome — matches the booking wizard inputs. */
const field =
  "w-full rounded-xl border border-stone-200 bg-white text-[0.95rem] text-ink outline-none placeholder:text-stone-400 transition-colors focus:border-gold focus:ring-1 focus:ring-gold disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(field, "h-11 px-3.5", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(field, "h-11 appearance-none px-3.5 pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(field, "min-h-[5.5rem] px-3.5 py-2.5 leading-relaxed", className)}
      {...props}
    />
  );
}

/** Label + control + optional hint, stacked. */
export function Labeled({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("block", className)}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-stone-600">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-stone-400">{hint}</p>}
    </div>
  );
}
