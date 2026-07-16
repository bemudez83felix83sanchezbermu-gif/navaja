"use client";

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import {
  login,
  signup,
  requestPasswordReset,
  updatePassword,
  type AuthState,
} from "@/app/actions/auth";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Formularios de cuenta (login / registro / recuperación). Client components
 * con useActionState → Server Actions; la validación de verdad vive en el
 * servidor (Zod), aquí solo hay atributos HTML para feedback inmediato.
 */

const inputCls =
  "h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 text-[0.95rem] text-white placeholder:text-stone-500 outline-none transition-colors focus:border-gold/60 focus:bg-white/[0.06]";

function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.ComponentProps<"input">) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-300">
        {label}
      </label>
      <input id={id} className={inputCls} {...props} />
      {hint && <p className="mt-1.5 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

function PasswordField({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.ComponentProps<"input">) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-stone-300">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          className={cn(inputCls, "pr-11")}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-stone-500 hover:text-stone-300"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

function FormAlert({ state }: { state: AuthState }) {
  if (!state?.error) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      {state.error}
    </p>
  );
}

/* ------------------------------------------------------------------ */

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      {notice && (
        <p className="rounded-xl border border-gold/25 bg-gold/10 px-3.5 py-2.5 text-sm text-gold-300">
          {notice}
        </p>
      )}
      <FormAlert state={state} />
      <Field
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="tu@correo.com"
        required
      />
      <div>
        <PasswordField
          label="Contraseña"
          name="password"
          autoComplete="current-password"
          required
        />
        <div className="mt-2 text-right">
          <Link
            href="/recuperar"
            className="text-xs font-medium text-stone-400 transition-colors hover:text-gold-300"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
      </div>
      <Button type="submit" disabled={pending} className="w-full rounded-xl">
        {pending ? "Entrando…" : "Entrar al panel"}
      </Button>
      <p className="text-center text-sm text-stone-400">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-gold-300 hover:text-gold-200">
          Crea tu barbería gratis
        </Link>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormAlert state={state} />
      <Field
        label="Tu nombre"
        name="ownerName"
        autoComplete="name"
        placeholder="Ej. Marco Ríos"
        minLength={2}
        maxLength={80}
        required
      />
      <Field
        label="Nombre de tu barbería"
        name="shopName"
        placeholder="Ej. Barbería El Filo"
        hint="Con esto creamos tu página de reservas; podrás cambiarla después."
        minLength={2}
        maxLength={80}
        required
      />
      <Field
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="tu@correo.com"
        required
      />
      <PasswordField
        label="Contraseña"
        name="password"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres, con al menos una letra y un número."
        minLength={8}
        maxLength={72}
        required
      />
      <label className="flex items-start gap-2.5 text-sm text-stone-400">
        <input
          type="checkbox"
          name="acceptTerms"
          required
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 accent-[#a16207]"
        />
        <span>
          Acepto los{" "}
          <Link
            href="/legal/terminos"
            target="_blank"
            className="font-medium text-gold-300 underline-offset-2 hover:underline"
          >
            Términos y Condiciones
          </Link>{" "}
          y el{" "}
          <Link
            href="/legal/privacidad"
            target="_blank"
            className="font-medium text-gold-300 underline-offset-2 hover:underline"
          >
            Aviso de Privacidad
          </Link>
          .
        </span>
      </label>
      <Button type="submit" disabled={pending} className="w-full rounded-xl">
        {pending ? "Creando tu barbería…" : "Crear cuenta gratis"}
      </Button>
      <p className="text-center text-xs text-stone-500">
        14 días de prueba · Sin tarjeta · Cancela cuando quieras
      </p>
      <p className="text-center text-sm text-stone-400">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-gold-300 hover:text-gold-200">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */

export function RecoverForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  if (state?.ok) {
    return (
      <div className="space-y-4 text-center">
        <p className="flex items-start gap-2 rounded-xl border border-gold/25 bg-gold/10 px-3.5 py-2.5 text-left text-sm text-gold-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          Si ese correo tiene una cuenta, te enviamos un enlace para restablecer
          tu contraseña. Revisa también el spam.
        </p>
        <Link href="/login" className="text-sm font-semibold text-gold-300 hover:text-gold-200">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <FormAlert state={state} />
      <Field
        label="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="tu@correo.com"
        hint="Te enviaremos un enlace para crear una contraseña nueva."
        required
      />
      <Button type="submit" disabled={pending} className="w-full rounded-xl">
        {pending ? "Enviando…" : "Enviar enlace"}
      </Button>
      <p className="text-center text-sm text-stone-400">
        <Link href="/login" className="font-semibold text-gold-300 hover:text-gold-200">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}

/* ------------------------------------------------------------------ */

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="space-y-4">
      <FormAlert state={state} />
      <PasswordField
        label="Nueva contraseña"
        name="password"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres, con al menos una letra y un número."
        minLength={8}
        maxLength={72}
        required
      />
      <PasswordField
        label="Confirma la contraseña"
        name="confirm"
        autoComplete="new-password"
        minLength={8}
        maxLength={72}
        required
      />
      <Button type="submit" disabled={pending} className="w-full rounded-xl">
        {pending ? "Guardando…" : "Guardar y entrar"}
      </Button>
    </form>
  );
}
