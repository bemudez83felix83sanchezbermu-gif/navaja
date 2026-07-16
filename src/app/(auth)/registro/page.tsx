import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Crea tu barbería" };

export default function RegistroPage() {
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
        Crea tu barbería
      </h1>
      <p className="mt-2 mb-7 text-sm text-stone-400">
        En menos de un minuto tienes tu página de reservas y tu agenda.
      </p>
      <SignupForm />
    </>
  );
}
