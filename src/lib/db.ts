import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Clientes Supabase del lado servidor.
 *
 * Dos niveles de confianza, alineados con supabase/policies.sql:
 *
 *  - `dbAdmin()` — llave service_role: SALTA RLS. Solo para Server Components
 *    y Server Actions del dashboard (el "backend" del dueño). La autorización
 *    la aporta lib/auth.ts: toda query sin slug explícito resuelve el tenant
 *    desde la membresía del usuario autenticado (requireMembership).
 *    Nunca importar desde un client component: Next no expone la llave al
 *    navegador, pero el import fallaría en runtime con la llave vacía.
 *
 *  - `dbAnon()` — llave anon: TODO pasa por RLS. Es el mismo poder que tendría
 *    cualquier visitante. La usamos para el flujo público de reservas
 *    (vista busy_slots + RPC book_appointment) para probar ese camino tal como
 *    funcionará en producción.
 *
 * Singletons a nivel módulo: supabase-js es HTTP sin estado, una instancia por
 * proceso basta y sobrevive HMR.
 */

const url = () => {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL (ver .env.example)");
  return u;
};

let admin: SupabaseClient | undefined;
let anon: SupabaseClient | undefined;

export function dbAdmin(): SupabaseClient {
  if (!admin) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (ver .env.example)");
    admin = createClient(url(), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export function dbAnon(): SupabaseClient {
  if (!anon) {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY (ver .env.example)");
    anon = createClient(url(), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return anon;
}
