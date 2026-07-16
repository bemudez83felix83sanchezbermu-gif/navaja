"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  Pencil,
  Plus,
  Scissors,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { Barber, Service } from "@/lib/data/types";
import { removeBarber, saveBarber, toggleBarber } from "@/app/actions/catalog";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Input, Labeled, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

/** Acentos de marca disponibles para teñir avatar y columna de agenda. */
const ACCENTS = [
  "#a16207", "#0369a1", "#047857", "#7c2d12",
  "#6d28d9", "#b91c1c", "#0f766e", "#4338ca",
];

type FormState = {
  id?: string;
  name: string;
  role: string;
  bio: string;
  specialtiesText: string; // separadas por coma en el input
  accent: string;
  serviceIds: string[];
};

const empty: FormState = {
  name: "",
  role: "",
  bio: "",
  specialtiesText: "",
  accent: ACCENTS[0],
  serviceIds: [],
};

/** Equipo de barberos con CRUD completo y asignación de servicios. */
export function BarbersManager({
  barbers,
  services,
  todayCounts,
}: {
  barbers: Barber[];
  services: Service[];
  /** citas de hoy (no canceladas) por barbero */
  todayCounts: Record<string, number>;
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
  const openEdit = (b: Barber) => {
    setError(null);
    setConfirmDelete(false);
    setForm({
      id: b.id,
      name: b.name,
      role: b.role,
      bio: b.bio,
      specialtiesText: b.specialties.join(", "),
      accent: b.accent,
      serviceIds: b.serviceIds,
    });
  };

  async function submit() {
    if (!form) return;
    setSaving(true);
    setError(null);
    const res = await saveBarber({
      id: form.id,
      name: form.name,
      role: form.role,
      bio: form.bio,
      specialties: form.specialtiesText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 8),
      accent: form.accent,
      serviceIds: form.serviceIds,
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
    const res = await removeBarber(form.id);
    setSaving(false);
    if (res.ok) {
      setForm(null);
      setNotice(res.message ?? null);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  async function onToggle(b: Barber) {
    setNotice(null);
    const res = await toggleBarber({ id: b.id, active: !b.active });
    setNotice(res.ok ? (res.message ?? null) : res.error);
    if (res.ok) router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Barberos"
        subtitle="Tu equipo y lo que cada uno atiende."
        actions={
          <Button size="md" onClick={openNew}>
            <Plus className="h-4 w-4" /> Agregar barbero
          </Button>
        }
      />

      {notice && (
        <p className="mb-4 rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-600">
          {notice}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {barbers.map((b) => {
          const count = b.serviceIds.length;
          return (
            <Card key={b.id} className={cn("p-5", !b.active && "opacity-70")}>
              <div className="flex items-center gap-3">
                <Avatar name={b.name} accent={b.accent} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{b.name}</p>
                  <p className="text-sm text-stone-500">{b.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-1 text-xs font-semibold text-ink">
                    <Star className="h-3 w-3 fill-gold-400 text-gold-400" />
                    {b.rating}
                  </span>
                  <button
                    onClick={() => openEdit(b)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-stone-200 text-stone-400 transition-colors hover:border-stone-400 hover:text-ink"
                    aria-label={`Editar ${b.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-stone-500">{b.bio}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {b.specialties.map((sp) => (
                  <span
                    key={sp}
                    className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600"
                  >
                    {sp}
                  </span>
                ))}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 text-sm">
                <span className="flex items-center gap-2 text-stone-500">
                  <Scissors className="h-4 w-4 text-stone-400" />
                  <span className="tnum font-semibold text-ink">{count}</span> servicios
                </span>
                <span className="flex items-center gap-2 text-stone-500">
                  <CalendarDays className="h-4 w-4 text-stone-400" />
                  <span className="tnum font-semibold text-ink">
                    {todayCounts[b.id] ?? 0}
                  </span>{" "}
                  citas hoy
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 text-sm font-medium",
                    b.active ? "text-success" : "text-stone-400",
                  )}
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      b.active ? "bg-success" : "bg-stone-300",
                    )}
                  />
                  {b.active ? "Activo" : "Inactivo"}
                </span>
                <button
                  onClick={() => onToggle(b)}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    b.active
                      ? "text-stone-500 hover:text-destructive"
                      : "text-success hover:text-success",
                  )}
                >
                  {b.active ? "Desactivar" : "Reactivar"}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? "Editar barbero" : "Agregar barbero"}
        wide
      >
        {form && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Labeled label="Nombre">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Marco Salinas"
                  autoFocus
                />
              </Labeled>
              <Labeled label="Rol">
                <Input
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  placeholder="Barbero senior"
                />
              </Labeled>
            </div>
            <Labeled label="Bio" hint="Se muestra en su tarjeta del equipo.">
              <Textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                placeholder="Especialista en fade y diseño…"
              />
            </Labeled>
            <Labeled
              label="Especialidades"
              hint="Separadas por coma, p. ej. Fade, Barba, Clásico."
            >
              <Input
                value={form.specialtiesText}
                onChange={(e) => setForm({ ...form, specialtiesText: e.target.value })}
                placeholder="Fade, Diseño, Clásico"
              />
            </Labeled>

            <div>
              <p className="mb-1.5 text-sm font-medium text-stone-600">Color de marca</p>
              <div className="flex flex-wrap gap-2">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, accent: c })}
                    aria-label={`Color ${c}`}
                    aria-pressed={form.accent === c}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full transition-transform",
                      form.accent === c && "scale-110 ring-2 ring-offset-2 ring-stone-900",
                    )}
                    style={{ backgroundColor: c }}
                  >
                    {form.accent === c && (
                      <Check className="h-4 w-4 text-white" strokeWidth={3} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-stone-600">
                Servicios que realiza
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {services.map((s) => {
                  const checked = form.serviceIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          serviceIds: checked
                            ? form.serviceIds.filter((id) => id !== s.id)
                            : [...form.serviceIds, s.id],
                        })
                      }
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border p-3 text-left text-sm transition-all",
                        checked
                          ? "border-gold bg-gold/[0.06] ring-1 ring-gold"
                          : "border-stone-200 bg-white hover:border-stone-400",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 shrink-0 place-items-center rounded-md border",
                          checked ? "border-gold bg-gold text-white" : "border-stone-300",
                        )}
                      >
                        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">
                        {s.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {form.serviceIds.length === 0 && (
                <p className="mt-1.5 text-xs text-warning">
                  Sin servicios asignados este barbero no aparecerá al reservar.
                </p>
              )}
            </div>

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
                  {saving ? "Guardando…" : form.id ? "Guardar cambios" : "Agregar barbero"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
