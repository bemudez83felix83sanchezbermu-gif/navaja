"use client";

import { Check, Download } from "lucide-react";
import type { Invoice, Plan, PlanId, Subscription } from "@/lib/data/types";
import { changePlan } from "@/app/actions/settings";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ResultNotice, useSettingsAction } from "./shared";
import { cn, formatPrice } from "@/lib/utils";

function Meter({ label, used, max }: { label: string; used: number; max: number }) {
  const pct = Math.min(100, Math.round((used / max) * 100));
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-medium text-stone-600">{label}</span>
        <span className="tnum text-stone-500">
          <b className="text-ink">{used}</b> / {max}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-100">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-warning" : "bg-gold",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function PlanPanel({
  plans,
  subscription,
  usage,
  invoices,
}: {
  plans: Plan[];
  subscription: Subscription;
  usage: { barbers: number; appointmentsThisMonth: number };
  invoices: Invoice[];
}) {
  const action = useSettingsAction();
  const current = plans.find((p) => p.id === subscription.planId)!;
  const renews = new Date(subscription.renewsAt);

  return (
    <div className="space-y-5">
      {/* Current plan + usage */}
      <Card>
        <CardHeader>
          <CardTitle>Tu plan actual</CardTitle>
          <span className="rounded-full bg-success-bg px-2.5 py-1 text-xs font-semibold text-success">
            {subscription.status === "activa" ? "Activa" : subscription.status}
          </span>
        </CardHeader>
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-3xl font-semibold text-ink">
              {current.name}
            </span>
            <span className="text-stone-500">
              {formatPrice(current.priceCents)}/mes · se renueva el{" "}
              {renews.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Meter label="Barberos" used={usage.barbers} max={current.maxBarbers} />
            <Meter
              label="Citas este mes"
              used={usage.appointmentsThisMonth}
              max={current.maxAppointmentsPerMonth}
            />
          </div>
        </CardBody>
      </Card>

      {/* Plan tiers */}
      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const isCurrent = p.id === subscription.planId;
          return (
            <Card
              key={p.id}
              className={cn("flex flex-col p-5", isCurrent && "ring-2 ring-gold")}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-semibold text-ink">{p.name}</h3>
                {isCurrent && (
                  <span className="rounded-full bg-gold/12 px-2.5 py-1 text-xs font-semibold text-gold">
                    Tu plan
                  </span>
                )}
              </div>
              <p className="mt-2">
                <span className="font-display text-2xl font-semibold text-ink">
                  {formatPrice(p.priceCents)}
                </span>
                <span className="text-sm text-stone-500"> /mes</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2">
                {p.highlights.map((h) => (
                  <li key={h} className="flex gap-2 text-sm text-stone-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" strokeWidth={2.5} />
                    {h}
                  </li>
                ))}
              </ul>
              <Button
                variant={isCurrent ? "outline" : "primary"}
                size="md"
                className="mt-5"
                disabled={isCurrent || action.pending}
                onClick={() => action.run(() => changePlan(p.id as PlanId))}
              >
                {isCurrent ? "Plan actual" : `Cambiar a ${p.name}`}
              </Button>
            </Card>
          );
        })}
      </div>
      <ResultNotice result={action.result} />

      {/* Invoices */}
      <Card>
        <CardHeader>
          <CardTitle>Facturas</CardTitle>
        </CardHeader>
        <CardBody className="pt-2">
          <ul className="divide-y divide-stone-100">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 py-3 text-sm">
                <span className="tnum font-mono text-xs text-stone-500">{inv.id}</span>
                <span className="text-stone-500">
                  {new Date(inv.date).toLocaleDateString("es-MX", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                <span className="ml-auto font-semibold text-ink tnum">
                  {formatPrice(inv.amountCents)}
                </span>
                <span className="rounded-full bg-success-bg px-2.5 py-0.5 text-xs font-semibold text-success">
                  {inv.status}
                </span>
                <button
                  type="button"
                  aria-label={`Descargar factura ${inv.id}`}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 text-stone-400 transition-colors hover:border-stone-400 hover:text-ink"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
