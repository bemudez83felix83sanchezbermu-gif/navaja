"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ActionResult } from "@/app/actions/settings";

/**
 * Shared plumbing for every settings form: run a Server Action with a pending
 * state and surface its typed result inline (success or error).
 */
export function useSettingsAction() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function run(action: () => Promise<ActionResult>) {
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await action());
      } catch {
        setResult({ ok: false, error: "Algo salió mal. Inténtalo de nuevo." });
      }
    });
  }

  return { pending, result, run, clear: () => setResult(null) };
}

export function ResultNotice({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-xl border border-success/20 bg-success-bg px-3.5 py-2.5 text-sm font-medium text-success"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {result.message ?? "Guardado."}
      </p>
    );
  }
  return (
    <p
      role="alert"
      className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive-bg px-3.5 py-2.5 text-sm font-medium text-destructive"
    >
      <TriangleAlert className="h-4 w-4 shrink-0" />
      {result.error}
    </p>
  );
}

/** Footer row used by every form: notice on the left, save on the right. */
export function SaveRow({
  pending,
  result,
  label = "Guardar cambios",
}: {
  pending: boolean;
  result: ActionResult | null;
  label?: string;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-5">
      <div className="min-w-0 flex-1">
        <ResultNotice result={result} />
      </div>
      <Button type="submit" size="md" disabled={pending}>
        {pending ? "Guardando…" : label}
      </Button>
    </div>
  );
}
