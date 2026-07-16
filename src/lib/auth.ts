import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { dbAdmin } from "@/lib/db";
import type { MemberRole } from "@/lib/data/types";

/**
 * Autenticación (Supabase Auth con cookies vía @supabase/ssr).
 *
 * Esta es la Data Access Layer de identidad: TODO chequeo de sesión del
 * dashboard pasa por aquí. El proxy hace además un chequeo optimista (y
 * refresca el token), pero la última palabra la tiene este módulo, pegado a
 * los datos — como recomienda la guía de auth de Next.
 *
 *  - `supabaseServer()` — cliente ligado a las cookies del request. Con la
 *    llave ANON: solo sirve para identidad (getUser/signIn/signOut); los datos
 *    del dashboard siguen yendo por dbAdmin() + membership.
 *  - `getUser()` — usuario verificado contra Supabase (no confía en el JWT
 *    local). Cacheado por render.
 *  - `requireMembership()` — usuario + su barbería (tabla memberships).
 *    Redirige a /login si no hay sesión o la cuenta quedó sin barbería.
 */

export async function supabaseServer() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Faltan variables de Supabase (ver .env.example)");

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Un Server Component no puede escribir cookies; el refresh de
          // sesión lo hace el proxy. Ignorar es el patrón documentado.
        }
      },
    },
  });
}

/** Usuario autenticado (verificado con Supabase) o null. Cacheado por render. */
export const getUser = cache(async (): Promise<User | null> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

export interface Membership {
  user: User;
  barbershopId: string;
  slug: string;
  role: MemberRole;
}

/**
 * Sesión + membresía o redirect a /login. Es el candado real del dashboard:
 * las queries resuelven el tenant con este slug, así que ninguna página ni
 * Server Action puede tocar datos sin pasar por aquí.
 */
export const requireMembership = cache(async (): Promise<Membership> => {
  const user = await getUser();
  if (!user) redirect("/login");

  const { data, error } = await dbAdmin()
    .from("memberships")
    .select("barbershop_id, role, barbershops!inner(slug)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`[db:membership] ${error.message}`);

  if (!data) {
    // Registro que quedó a medias (usuario sin barbería). El login muestra
    // el aviso; no hay loop porque el proxy no redirige /login → /dashboard.
    redirect("/login?aviso=cuenta-incompleta");
  }

  const shop = data.barbershops as unknown as { slug: string };
  return {
    user,
    barbershopId: data.barbershop_id,
    slug: shop.slug,
    role: data.role as MemberRole,
  };
});
