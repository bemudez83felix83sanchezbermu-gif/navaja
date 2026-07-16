/**
 * Helpers de fecha compartidos entre servidor y cliente.
 * (Antes vivían en el mock; ahora la capa de datos es Supabase y estos
 * utilitarios puros se quedan aquí, importables desde client components.)
 */

export const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const addMinutes = (d: Date, n: number) => new Date(d.getTime() + n * 60000);

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Lunes como primer día de la semana. */
export const startOfWeek = (d: Date) => {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7; // 0 = lunes
  return addDays(x, -day);
};

/** `2026-07-14` en hora local — clave estable para URLs (?d=) y agrupaciones. */
export const toDayKey = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Parsea `2026-07-14` a medianoche local; null si es inválida. */
export const fromDayKey = (s: string | undefined | null): Date | null => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
};
