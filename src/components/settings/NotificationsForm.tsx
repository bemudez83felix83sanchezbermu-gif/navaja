"use client";

import { useState } from "react";
import type { NotificationSettings } from "@/lib/data/types";
import { updateNotifications } from "@/app/actions/settings";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Labeled } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { SaveRow, useSettingsAction } from "./shared";

export function NotificationsForm({ settings }: { settings: NotificationSettings }) {
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
            description="Recibe un correo cada vez que alguien agenda una cita."
          />
          <div className="border-t border-stone-100 pt-4 pb-2">
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

      <SaveRow pending={pending} result={result} />
    </form>
  );
}
