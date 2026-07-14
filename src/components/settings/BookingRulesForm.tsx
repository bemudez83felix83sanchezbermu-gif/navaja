"use client";

import { useState } from "react";
import type { BookingRules } from "@/lib/data/types";
import { updateBookingRules } from "@/app/actions/settings";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Labeled, Select } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { SaveRow, useSettingsAction } from "./shared";

const NOTICE_OPTIONS = [
  { value: 0, label: "Sin anticipación mínima" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 240, label: "4 horas antes" },
  { value: 1440, label: "1 día antes" },
];

const ADVANCE_OPTIONS = [7, 14, 30, 60, 90];
const CANCEL_OPTIONS = [0, 1, 3, 6, 12, 24, 48];

export function BookingRulesForm({ rules }: { rules: BookingRules }) {
  const [form, setForm] = useState<BookingRules>({ ...rules });
  const { pending, result, run } = useSettingsAction();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateBookingRules(form));
      }}
      className="space-y-5"
    >
      <Card>
        <CardHeader>
          <CardTitle>Horarios ofrecidos</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Labeled
            label="Intervalo entre horarios"
            htmlFor="rules-step"
            hint="Cada cuánto se ofrecen horas de inicio en tu página."
          >
            <Select
              id="rules-step"
              value={form.slotStepMin}
              onChange={(e) =>
                setForm({ ...form, slotStepMin: Number(e.target.value) as BookingRules["slotStepMin"] })
              }
            >
              {[15, 20, 30, 60].map((v) => (
                <option key={v} value={v}>
                  Cada {v} minutos
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled
            label="Anticipación mínima"
            htmlFor="rules-notice"
            hint="Evita reservas de último minuto que no alcanzas a ver."
          >
            <Select
              id="rules-notice"
              value={form.minNoticeMin}
              onChange={(e) => setForm({ ...form, minNoticeMin: Number(e.target.value) })}
            >
              {NOTICE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled
            label="Reservas hasta con"
            htmlFor="rules-advance"
            hint="Qué tan lejos en el futuro pueden agendar tus clientes."
          >
            <Select
              id="rules-advance"
              value={form.maxAdvanceDays}
              onChange={(e) => setForm({ ...form, maxAdvanceDays: Number(e.target.value) })}
            >
              {ADVANCE_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} días de anticipación
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled
            label="Cancelación permitida hasta"
            htmlFor="rules-cancel"
            hint="Después de este límite, la cita ya no se puede cancelar en línea."
          >
            <Select
              id="rules-cancel"
              value={form.cancellationWindowHours}
              onChange={(e) =>
                setForm({ ...form, cancellationWindowHours: Number(e.target.value) })
              }
            >
              {CANCEL_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h === 0 ? "En cualquier momento" : `${h} h antes de la cita`}
                </option>
              ))}
            </Select>
          </Labeled>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comportamiento</CardTitle>
        </CardHeader>
        <CardBody className="divide-y divide-stone-100 py-2">
          <Toggle
            checked={form.autoConfirm}
            onChange={(v) => setForm({ ...form, autoConfirm: v })}
            label="Confirmación automática"
            description="Las citas nuevas quedan confirmadas al instante. Si lo apagas, entran como pendientes y tú las apruebas."
          />
          <Toggle
            checked={form.allowBarberChoice}
            onChange={(v) => setForm({ ...form, allowBarberChoice: v })}
            label="Elegir barbero"
            description="Permite al cliente escoger con quién atenderse. Apagado, siempre se asigna al primero disponible."
          />
          <Toggle
            checked={form.requireEmail}
            onChange={(v) => setForm({ ...form, requireEmail: v })}
            label="Correo obligatorio"
            description="Pide el correo en el formulario de reserva (útil para recordatorios por email)."
          />
        </CardBody>
      </Card>

      <SaveRow pending={pending} result={result} />
    </form>
  );
}
