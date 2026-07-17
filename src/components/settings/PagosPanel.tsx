"use client";

import { useState } from "react";
import {
  BadgeCheck,
  CreditCard,
  Info,
  Lock,
  Plug,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { PaymentAccount, PaymentMode, PaymentSettings } from "@/lib/data/types";
import { savePaymentRules } from "@/app/actions/settings";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Labeled, Select } from "@/components/ui/Input";
import { SaveRow, useSettingsAction } from "./shared";
import { cn, formatPrice } from "@/lib/utils";

/**
 * Configuración → Pagos: conectar Mercado Pago y elegir cómo cobrar el
 * anticipo. Gate por plan (Pro/Estudio) — la UI candada Esencial, pero la
 * autoridad es `savePaymentRules` en el servidor. La conexión OAuth y el
 * webhook llegan en el siguiente entregable; hoy el botón queda como
 * placeholder (no muestra URL de autorización aún).
 */

const MODE_OPTIONS: { value: PaymentMode; label: string; hint: string }[] = [
  { value: "off",            label: "Sin cobro",         hint: "El cliente reserva sin pagar. Pagará en la barbería." },
  { value: "anticipo_fijo",  label: "Anticipo fijo",     hint: "Un monto igual para todas las reservas (mínimo $20 MXN)." },
  { value: "porcentaje",     label: "Porcentaje",        hint: "Un % del precio del servicio (útil si tus precios varían)." },
  { value: "total",          label: "Total por adelantado", hint: "El cliente paga el 100% al reservar." },
];

/* -------- Bloqueo por plan Esencial -------- */
function PlanLock() {
  return (
    <Card>
      <CardBody className="flex items-start gap-3 py-5">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
        <div className="text-sm leading-relaxed text-stone-500">
          <p className="font-semibold text-ink">Disponible en Pro y Estudio</p>
          <p className="mt-1">
            Cobrar un anticipo al reservar reduce los no-shows y da certeza al
            barbero. Actívalo mejorando tu plan — sin comisiones por
            transacción, el 100% del cobro llega a tu cuenta de Mercado Pago.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

/* -------- Estado de la conexión MP -------- */
function AccountCard({ account }: { account: PaymentAccount | null }) {
  if (!account) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Conectar Mercado Pago</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm leading-relaxed text-stone-500">
            Vinculamos tu cuenta de Mercado Pago para que cobres los anticipos
            directo — el dinero cae en tu cuenta, no pasa por Navaja.
            <b className="text-ink"> No cobramos comisión por transacción.</b>
          </p>
          <Button
            type="button"
            size="md"
            variant="dark"
            disabled
            title="La conexión se habilita en el siguiente entregable"
          >
            <Plug className="h-4 w-4" />
            Conectar Mercado Pago (próximamente)
          </Button>
          <ul className="space-y-2 text-sm text-stone-500">
            {[
              "Tus clientes pagan en el entorno de Mercado Pago",
              "Nunca vemos ni guardamos datos de tarjeta",
              "Puedes desconectar la cuenta cuando quieras",
            ].map((text) => (
              <li key={text} className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                {text}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    );
  }

  const isError = account.status === "error_refresh";
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mercado Pago</CardTitle>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
            isError ? "bg-destructive-bg text-destructive" : "bg-success-bg text-success",
          )}
        >
          {isError ? (
            <>
              <TriangleAlert className="h-3.5 w-3.5" />
              Reconectar
            </>
          ) : (
            <>
              <BadgeCheck className="h-3.5 w-3.5" />
              Conectada
            </>
          )}
        </span>
      </CardHeader>
      <CardBody>
        {isError ? (
          <p className="text-sm leading-relaxed text-destructive">
            La conexión con Mercado Pago dejó de funcionar. Los cobros nuevos
            no se pueden procesar hasta que reconectes la cuenta.
          </p>
        ) : (
          <p className="text-sm leading-relaxed text-stone-500">
            Los cobros llegan a la cuenta MP <span className="font-mono text-xs text-ink">#{account.mpUserId}</span>
            {!account.liveMode && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning">
                Modo prueba
              </span>
            )}
            .
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/* -------- Formulario del modo y monto -------- */
export function PagosPanel({
  settings,
  account,
  planAllowsPayments,
}: {
  settings: PaymentSettings;
  account: PaymentAccount | null;
  planAllowsPayments: boolean;
}) {
  const [form, setForm] = useState<PaymentSettings>(settings);
  const { pending, result, run } = useSettingsAction();

  if (!planAllowsPayments) {
    return (
      <div className="space-y-5">
        <PlanLock />
        <AccountCard account={null} />
      </div>
    );
  }

  const disabledForm = !account || account.status !== "activa";

  return (
    <div className="space-y-5">
      <AccountCard account={account} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(() => savePaymentRules(form));
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Cómo cobrar el anticipo</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            {disabledForm && (
              <p className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-500">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
                Conecta tu cuenta de Mercado Pago para activar los cobros. Puedes
                dejar preparado el modo desde ahora.
              </p>
            )}

            <Labeled label="Modo de cobro" htmlFor="pago-modo">
              <Select
                id="pago-modo"
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value as PaymentMode })}
              >
                {MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
                {MODE_OPTIONS.find((o) => o.value === form.mode)?.hint}
              </p>
            </Labeled>

            {form.mode === "anticipo_fijo" && (
              <Labeled label="Monto del anticipo (MXN)" htmlFor="pago-fijo">
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-stone-400">
                    $
                  </span>
                  <Input
                    id="pago-fijo"
                    type="number"
                    inputMode="numeric"
                    min={20}
                    step={10}
                    className="pl-7"
                    value={form.depositCents / 100}
                    onChange={(e) =>
                      setForm({ ...form, depositCents: Math.round(Number(e.target.value) * 100) })
                    }
                  />
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
                  Mínimo $20. El cobro es igual para cualquier servicio; el resto se
                  paga en la sucursal. Ejemplo: {formatPrice(form.depositCents || 5000)}.
                </p>
              </Labeled>
            )}

            {form.mode === "porcentaje" && (
              <Labeled label="Porcentaje del servicio" htmlFor="pago-pct">
                <div className="relative">
                  <Input
                    id="pago-pct"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    step={5}
                    className="pr-8"
                    value={form.percent}
                    onChange={(e) =>
                      setForm({ ...form, percent: Math.max(1, Math.min(100, Number(e.target.value))) })
                    }
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-stone-400">
                    %
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
                  Se calcula sobre el precio del servicio elegido. Ejemplo: 30% de
                  $250 = $75.
                </p>
              </Labeled>
            )}

            {form.mode === "total" && (
              <p className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm leading-relaxed text-stone-500">
                El cliente paga el precio completo del servicio al reservar. Ideal
                para servicios cortos donde el cobro es el mismo online que en
                sucursal.
              </p>
            )}

            <SaveRow pending={pending} result={result} />
          </CardBody>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>¿Cómo funciona?</CardTitle>
        </CardHeader>
        <CardBody>
          <ol className="space-y-3">
            {[
              ["Conecta tu cuenta MP", "Un solo click. Autorizas a Navaja a cobrar en tu nombre — sin darnos tu contraseña ni datos de tarjeta."],
              ["Elige el modo de cobro", "Anticipo fijo, porcentaje del servicio o total. El cliente paga al terminar de reservar."],
              ["Nosotros hacemos el resto", "El pago se procesa en Mercado Pago, la cita queda confirmada y el dinero llega directo a tu cuenta."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stone-900 text-xs font-bold text-gold-400">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="text-sm leading-relaxed text-stone-500">{body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3 text-xs leading-relaxed text-stone-500">
            <CreditCard className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" />
            Navaja no cobra comisión por transacción — solo tu suscripción
            mensual. Las comisiones estándar de Mercado Pago sí aplican.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

