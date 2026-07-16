import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/auth";

/**
 * Callback de enlaces de correo (recuperación de contraseña, y en el futuro
 * confirmaciones/invitaciones): canjea el `code` PKCE por una sesión en
 * cookies y redirige a `next`. Los Route Handlers SÍ pueden escribir cookies,
 * por eso el canje vive aquí y no en una página.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/dashboard";
  // Solo rutas internas: evita open-redirect (p. ej. next=https://evil.com).
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/recuperar", url.origin));
}
