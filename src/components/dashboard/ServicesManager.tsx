"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Pencil, Plus, Scissors, Trash2, TriangleAlert } from "lucide-react";
import type { Barber, Service } from "@/lib/data/types";
import { removeService, saveService, toggleService } from "@/app/actions/catalog";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Input, Labeled, Select, Textarea } from "@/components/ui/Input";
import { Toggle } from "@/components/ui/Toggle";
import { cn, formatDuration, formatPrice } from "@/lib/utils";

const DURATIONS = [15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120];

type FormState = {
  id?: string;
  name: string;
  description: string;
  durationMin: number;
  priceMxn: string; // en pesos para el input; se convierte a centavos al guardar
  popular: boolean;
};

const empty: FormState = {
  name: "",
  description: "",
  durationMin: 30,
  priceMxn: "",
  popular: false,
};

/** Catálogo de servicios con CRUD completo (crear, editar, activar, borrar). */
export function ServicesManager({
  services,
  barbers,
}: {
  services: Service[];
  barbers: Barber[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const openNew = () => {
    setError(null);
    setConfirmDelete(false);
    setForm(empty);
  };
  const openEdit = (s: Service) => {
    setError(null);
    setConfirmDelete(false);
    setForm({
      id: s.id,
      name: s.name,
      description: s.description,
      durationMin: s.durationMin,
      priceMxn: String(Math.round(s.priceCents / 100)),
      popular: s.popular ?? false,
    });
  };

  async function submit() {
    if (!form) return;
    setSaving(true);
    setError(null);
    const price = Number(form.priceMxn);
    const res = await saveService({
      id: form.id,
      name: form.name,
      description: form.description,
      durationMin: form.durationMin,
      priceCents: Number.isFinite(price) ? Math.round(price * 100) : -1,
      popular: form.popular,
    });
    setSaving(false);
    if (res.ok) {
      setForm(null);
      setNotice(res.message ?? null);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  async function onDelete() {
    if (!form?.id) return;
    setSaving(true);
    setError(null);
    const res = await removeService(form.id);
    setSaving(false);
    if (res.ok) {
      setForm(null);
      setNotice(res.message ?? null);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  async function onToggle(s: Service) {
    setNotice(null);
    const res = await toggleService({ id: s.id, active: !s.active });
    setNotice(res.ok ? (res.message ?? null) : res.error);
    if (res.ok) router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Servicios"
        subtitle="El menú que tus clientes ven al reservar."
        actions={
          <Button size="md" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nuevo servicio
          </Button>
        }
      />

      {notice && (
        <p className="mb-4 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-600">
          {notice}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((s) => {
          const team = barbers.filter((b) => b.active && b.serviceIds.includes(s.id));
          return (
            <Card key={s.id} className={cn("flex flex-col p-5", !s.active && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-stone-900 text-gold-400">
                  <Scissors className="h-5 w-5" />
                </span>
                <div className="flex items-center gap-2">
                  {!s.active && (
                    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-500">
                      Inactivo
                    </span>
                  )}
                  {s.popular && s.active && (
                    <span className="rounded-full bg-gold/12 px-2 py-0.5 text-xs font-semibold text-gold">
                      Popular
                    </span>
                  )}
                  <button
                    onClick={() => openEdit(s)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 text-stone-400 transition-colors hover:border-stone-400 hover:text-ink"
                    aria-label={`Editar ${s.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="mt-4 text-lg font-semibold text-ink">{s.name}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-stone-500">
                {s.description}
              </p>

              <div className="mt-4 flex items-center gap-4 border-t border-stone-100 pt-4">
                <span className="font-display text-xl font-semibold text-ink tnum">
                  {formatPrice(s.priceCents)}
                </span>
                <span className="flex items-center gap-1.5 text-sm text-stone-500">
                  <Clock className="h-4 w-4" /> {formatDuration(s.durationMin)}
                </span>
                <div className="ml-auto flex -space-x-2">
                  {team.slice(0, 3).map((b) => (
                    <Avatar
                      key={b.id}
                      name={b.name}
                      accent={b.accent}
                      size={26}
                      className="ring-2 ring-white"
                    />
                  ))}
                  {team.length > 3 && (
                    <span className="grid h-[26px] w-[26px] place-items-center rounded-full bg-stone-100 text-[0.65rem] font-semibold text-stone-500 ring-2 ring-white">
                      +{team.length - 3}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => onToggle(s)}
                className={cn(
                  "mt-3 self-start text-sm font-medium transition-colors",
                  s.active
                    ? "text-stone-400 hover:text-destructive"
                    : "text-success hover:text-success",
                )}
              >
                {s.active ? "Desactivar" : "Reactivar"}
              </button>
            </Card>
          );
        })}
      </div>

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? "Editar servicio" : "Nuevo servicio"}
      >
        {form && (
          <div className="space-y-4">
            <Labeled label="Nombre">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Corte clásico"
                autoFocus
              />
            </Labeled>
            <Labeled label="Descripción" hint="Se muestra en la página de reservas.">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Tijera y máquina, lavado y peinado."
              />
            </Labeled>
            <div className="grid grid-cols-2 gap-4">
              <Labeled label="Duración">
                <Select
                  value={form.durationMin}
                  onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {formatDuration(d)}
                    </option>
                  ))}
                </Select>
              </Labeled>
              <Labeled label="Precio (MXN)">
                <Input
                  value={form.priceMxn}
                  onChange={(e) =>
                    setForm({ ...form, priceMxn: e.target.value.replace(/[^\d]/g, "") })
                  }
                  inputMode="numeric"
                  placeholder="250"
                />
              </Labeled>
            </div>
            <Toggle
              checked={form.popular}
              onChange={(v) => setForm({ ...form, popular: v })}
              label="Marcar como popular"
              description="Muestra la etiqueta “Top” al reservar."
            />

            {error && (
              <p
                role="alert"
                className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive-bg px-3.5 py-2.5 text-sm font-medium text-destructive"
              >
                <TriangleAlert className="h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-stone-100 pt-4">
              {form.id ? (
                confirmDelete ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={onDelete}
                    className="text-destructive hover:bg-destructive-bg"
                  >
                    <Trash2 className="h-4 w-4" /> ¿Seguro? Eliminar
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    className="text-stone-400 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar
                  </Button>
                )
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="md" onClick={() => setForm(null)}>
                  Cancelar
                </Button>
                <Button size="md" onClick={submit} disabled={saving || !form.name.trim()}>
                  {saving ? "Guardando…" : form.id ? "Guardar cambios" : "Crear servicio"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
