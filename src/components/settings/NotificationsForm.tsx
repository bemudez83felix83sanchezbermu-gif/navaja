"use client";

import { useState } from "react";
import { MessageCircle, Mail } from "lucide-react";
import type { NotificationEntry, NotificationSettings } from "@/lib/data/types";
import { updateNotifications } from "@/app/actions/settings";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Labeled } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { formatDayShort, formatTime } from "@/lib/utils";
import { SaveRow, useSettingsAction } from "./shared";

export function NotificationsForm({
  settings,
  recent = [],
}: {
  settings: NotificationSettings;
  /** últimos avisos registrados en notifications_log */
  recent?: NotificationEntry[];
}) {
  const [form, setForm] = useState<NotificationSettings>({ ...settings });
  const { pending, result, run } = useSettingsAction();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateNotifications(form));
      }}
      className="space-y-5"
    >
      <Card>
        <CardHeader>
          <CardTitle>Mensajes al cliente</CardTitle>
        </CardHeader>
        <CardBody className="divide-y divide-stone-100 py-2">
          <Toggle
            checked={form.confirmationEmail}
            onChange={(v) => setForm({ ...form, confirmationEmail: v })}
            label="Confirmación al reservar"
            description="Correo inmediato con el detalle de la cita y el folio."
          />
          <Toggle
            checked={form.reminder24h}
            onChange={(v) => setForm({ ...form, reminder24h: v })}
            label="Recordatorio 24 horas antes"
            description="Reduce los no-shows hasta un 40%."
          />
          <Toggle
            checked={form.reminder2h}
            onChange={(v) => setForm({ ...form, reminder2h: v })}
            label="Recordatorio 2 horas antes"
            description="Un último aviso el mismo día."
          />
          <Toggle
            checked={form.whatsappChannel}
            onChange={(v) => setForm({ ...form, whatsappChannel: v })}
            label="También por WhatsApp"
            description="Envía confirmaciones y recordatorios por WhatsApp además del correo (plan Pro)."
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avisos para ti</CardTitle>
        </CardHeader>
        <CardBody className="py-2">
          <Toggle
            checked={form.ownerNewBookingEmail}
            onChange={(v) => setForm({ ...form, ownerNewBookingEmail: v })}
            label="Nueva reserva"
            description="Recibe un aviso cada vez que alguien agenda una cita."
          />
          <div className="space-y-4 border-t border-stone-100 pt-4 pb-2">
            <Labeled
              label="WhatsApp para recibir reservas"
              htmlFor="notif-phone"
              hint="A este número llega el aviso de cada reserva nueva (nombre, servicio, horario y teléfono del cliente)."
            >
              <Input
                id="notif-phone"
                value={form.ownerPhone}
                onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })}
                placeholder="+52 55 1234 5678"
                inputMode="tel"
                maxLength={20}
              />
            </Labeled>
            <Labeled
              label="Nombre del remitente"
              htmlFor="notif-sender"
              hint="Así aparecerás en los correos y mensajes que reciben tus clientes."
            >
              <Input
                id="notif-sender"
                value={form.senderName}
                onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                required
                minLength={2}
                maxLength={60}
              />
            </Labeled>
          </div>
        </CardBody>
      </Card>

      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Últimos avisos</CardTitle>
            <span className="text-xs text-stone-400">
              Se envían automáticamente al conectar un proveedor (Twilio / Resend)
            </span>
          </CardHeader>
          <div className="mt-2 divide-y divide-stone-100">
            {recent.map((n) => (
              <div key={n.id} className="flex items-center gap-3 px-5 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-500">
                  {n.channel === "whatsapp" ? (
                    <MessageCircle className="h-4 w-4" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{n.subject}</p>
                  <p className="truncate text-xs text-stone-500">
                    {n.audience === "dueno" ? "Para ti" : "Para el cliente"} ·{" "}
                    <span className="tnum">{n.recipient}</span>
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-xs text-stone-400">
                    {formatDayShort(new Date(n.createdAt))} ·{" "}
                    {formatTime(new Date(n.createdAt))}
                  </p>
                  <span className="mt-0.5 inline-block rounded-full bg-warning-bg px-2 py-0.5 text-[0.65rem] font-semibold text-warning">
                    {n.status === "pendiente_envio" ? "Pendiente de envío" : n.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <SaveRow pending={pending} result={result} />
    </form>
  );
}
