"use client";

import { useState } from "react";
import type { Barbershop } from "@/lib/data/types";
import { updateProfile } from "@/app/actions/settings";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Labeled, Select } from "@/components/ui/Input";
import { SaveRow, useSettingsAction } from "./shared";
import { cn } from "@/lib/utils";

const DAYS = [
  { n: 0, label: "D" },
  { n: 1, label: "L" },
  { n: 2, label: "M" },
  { n: 3, label: "M" },
  { n: 4, label: "J" },
  { n: 5, label: "V" },
  { n: 6, label: "S" },
];

const TIMEZONES = [
  "America/Mexico_City",
  "America/Tijuana",
  "America/Monterrey",
  "America/Cancun",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Argentina/Buenos_Aires",
  "America/Guatemala",
  "Europe/Madrid",
];

const HOURS = Array.from({ length: 25 }, (_, h) => h);

export function ProfileForm({ shop }: { shop: Barbershop }) {
  const [form, setForm] = useState({
    name: shop.name,
    tagline: shop.tagline,
    address: shop.address,
    phone: shop.phone,
    timezone: shop.timezone,
    openDays: shop.openDays,
    openHour: shop.openHour,
    closeHour: shop.closeHour,
  });
  const { pending, result, run } = useSettingsAction();

  function toggleDay(n: number) {
    setForm((f) => ({
      ...f,
      openDays: f.openDays.includes(n)
        ? f.openDays.filter((d) => d !== n)
        : [...f.openDays, n].sort(),
    }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => updateProfile(form));
      }}
      className="space-y-5"
    >
      <Card>
        <CardHeader>
          <CardTitle>Datos del negocio</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Nombre" htmlFor="shop-name" className="sm:col-span-2">
            <Input
              id="shop-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              minLength={2}
              maxLength={80}
            />
          </Labeled>
          <Labeled
            label="Lema"
            htmlFor="shop-tagline"
            hint="Aparece bajo el nombre en tu página de reservas."
            className="sm:col-span-2"
          >
            <Input
              id="shop-tagline"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              maxLength={120}
            />
          </Labeled>
          <Labeled label="Teléfono" htmlFor="shop-phone">
            <Input
              id="shop-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              inputMode="tel"
              required
            />
          </Labeled>
          <Labeled label="Zona horaria" htmlFor="shop-tz">
            <Select
              id="shop-tz"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace("America/", "").replace("Europe/", "").replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </Labeled>
          <Labeled label="Dirección" htmlFor="shop-address" className="sm:col-span-2">
            <Input
              id="shop-address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              maxLength={160}
            />
          </Labeled>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horario</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-stone-600">Días abiertos</p>
            <div className="flex gap-2">
              {DAYS.map((d) => {
                const on = form.openDays.includes(d.n);
                return (
                  <button
                    key={d.n}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(d.n)}
                    className={cn(
                      "grid h-10 w-10 place-items-center rounded-xl border text-sm font-semibold transition-colors",
                      on
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-200 bg-white text-stone-400 hover:border-stone-400",
                    )}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled label="Abre a las" htmlFor="shop-open">
              <Select
                id="shop-open"
                value={form.openHour}
                onChange={(e) => setForm({ ...form, openHour: Number(e.target.value) })}
              >
                {HOURS.slice(0, 24).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </Select>
            </Labeled>
            <Labeled label="Cierra a las" htmlFor="shop-close">
              <Select
                id="shop-close"
                value={form.closeHour}
                onChange={(e) => setForm({ ...form, closeHour: Number(e.target.value) })}
              >
                {HOURS.slice(1).map((h) => (
                  <option key={h} value={h}>
                    {String(h).padStart(2, "0")}:00
                  </option>
                ))}
              </Select>
            </Labeled>
          </div>
        </CardBody>
      </Card>

      <SaveRow pending={pending} result={result} />
    </form>
  );
}
