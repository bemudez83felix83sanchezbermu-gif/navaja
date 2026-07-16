import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { ResetPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Nueva contraseña" };

/**
 * Aterrizaje del enlace de recuperación: /auth/callback canjea el código y
 * redirige aquí ya con sesión. Sin sesión (enlace caducado o URL directa),
 * de vuelta a pedir otro correo.
 */
export default async function RestablecerPage() {
  const user = await getUser();
  if (!user) redirect("/recuperar");

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
        Nueva contraseña
      </h1>
      <p className="mt-2 mb-7 text-sm text-stone-400">
        Elige tu nueva contraseña para {user.email}.
      </p>
      <ResetPasswordForm />
    </>
  );
}
