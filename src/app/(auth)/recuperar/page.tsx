import type { Metadata } from "next";
import { RecoverForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecuperarPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
        Recuperar contraseña
      </h1>
      <p className="mt-2 mb-7 text-sm text-stone-400">
        Dinos tu correo y te mandamos un enlace seguro.
      </p>
      <RecoverForm />
    </>
  );
}
