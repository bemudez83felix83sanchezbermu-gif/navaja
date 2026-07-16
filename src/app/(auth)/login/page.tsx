import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Iniciar sesión" };

const NOTICES: Record<string, string> = {
  "cuenta-incompleta":
    "Tu cuenta no tiene una barbería asociada. Escribe a soporte@navaja.app para resolverlo.",
  "cuenta-creada":
    "Tu cuenta quedó lista. Inicia sesión para entrar a tu panel.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
        Bienvenido de vuelta
      </h1>
      <p className="mt-2 mb-7 text-sm text-stone-400">
        Entra a tu panel para ver tu agenda de hoy.
      </p>
      <LoginForm notice={aviso ? NOTICES[aviso] : undefined} />
    </>
  );
}
