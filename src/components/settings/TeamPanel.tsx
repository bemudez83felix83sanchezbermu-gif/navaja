"use client";

import { useState } from "react";
import { Crown, MailPlus, Trash2 } from "lucide-react";
import type { Member } from "@/lib/data/types";
import { inviteMember, removeMember } from "@/app/actions/settings";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Labeled, Select } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { ResultNotice, useSettingsAction } from "./shared";
import { cn } from "@/lib/utils";

export function TeamPanel({ members }: { members: Member[] }) {
  const [invite, setInvite] = useState({ name: "", email: "", role: "staff" as Member["role"] });
  const inviteAction = useSettingsAction();
  const removeAction = useSettingsAction();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Personas con acceso al panel</CardTitle>
        </CardHeader>
        <CardBody className="py-2">
          <ul className="divide-y divide-stone-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <Avatar name={m.name} accent={m.role === "owner" ? "#a16207" : "#57534e"} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-ink">
                    {m.name}
                    {m.role === "owner" && (
                      <Crown className="h-3.5 w-3.5 shrink-0 fill-gold-300 text-gold" />
                    )}
                  </p>
                  <p className="truncate text-sm text-stone-500">{m.email}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    m.role === "owner"
                      ? "bg-gold/12 text-gold"
                      : "bg-stone-100 text-stone-500",
                  )}
                >
                  {m.role === "owner" ? "Dueño" : "Staff"}
                </span>
                {m.status === "invitado" && (
                  <span className="rounded-full bg-warning-bg px-2.5 py-1 text-xs font-semibold text-warning">
                    Invitación enviada
                  </span>
                )}
                {m.role !== "owner" && (
                  <button
                    type="button"
                    aria-label={`Quitar acceso a ${m.name}`}
                    onClick={() => removeAction.run(() => removeMember(m.id))}
                    disabled={removeAction.pending}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 text-stone-400 transition-colors hover:border-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="pb-2">
            <ResultNotice result={removeAction.result} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invitar a alguien</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-4 text-sm leading-relaxed text-stone-500">
            El <b>staff</b> gestiona agenda y citas. Solo el <b>dueño</b> puede tocar
            configuración, dominios y facturación.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              inviteAction.run(async () => {
                const r = await inviteMember(invite);
                if (r.ok) setInvite({ name: "", email: "", role: "staff" });
                return r;
              });
            }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Labeled label="Nombre" htmlFor="inv-name">
              <Input
                id="inv-name"
                value={invite.name}
                onChange={(e) => setInvite({ ...invite, name: e.target.value })}
                required
                minLength={2}
                maxLength={80}
              />
            </Labeled>
            <Labeled label="Correo" htmlFor="inv-email">
              <Input
                id="inv-email"
                type="email"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
                required
                maxLength={120}
              />
            </Labeled>
            <Labeled label="Rol" htmlFor="inv-role">
              <Select
                id="inv-role"
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value as Member["role"] })}
              >
                <option value="staff">Staff — agenda y citas</option>
                <option value="owner">Dueño — acceso total</option>
              </Select>
            </Labeled>
            <div className="flex items-end">
              <Button type="submit" size="md" disabled={inviteAction.pending}>
                <MailPlus className="h-4 w-4" />
                {inviteAction.pending ? "Enviando…" : "Enviar invitación"}
              </Button>
            </div>
          </form>
          <div className="mt-3">
            <ResultNotice result={inviteAction.result} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
