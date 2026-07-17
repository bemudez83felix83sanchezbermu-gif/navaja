"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock, XCircle } from "lucide-react";
import { getPaymentReturnStatus } from "@/app/actions/payment-status";
import { Button } from "@/components/ui/Button";
import type { AppointmentStatus } from "@/lib/data/types";

/**
 * Página de retorno de Mercado Pago. NO confiamos en los query params del
 * redirect (MP los expone al cliente y son manipulables) — el único hecho
 * legítimo es lo que dice la base de datos, que el webhook actualizó.
 *
 * Estados terminales: confirmada / cancelada / no encontrada. Mientras siga
 * en 'pendiente_pago', pollamos cada 3s hasta agotar el hold (~15 min);
 * después el pg_cron cancelará y el próximo tick lo verá.
 */
type Props = {
  shopSlug: string;
  appointmentId: string;
  /** ISO — hold inicial, para el countdown. Se refresca en cada poll por si el server sabe algo distinto. */
  initialExpiresAt: string | null;
  initialStatus: AppointmentStatus;
};

const POLL_MS = 3000;

export function PaymentReturn({
  shopSlug,
  appointmentId,
  initialExpiresAt,
  initialStatus,
}: Props) {
  const [status, setStatus] = useState<AppointmentStatus>(initialStatus);
  const [expiresAt, setExpiresAt] = useState<string | null>(initialExpiresAt);
  const [pollError, setPollError] = useState<string | null>(null);
  const stopped = useRef(false);

  // Polling: cada 3s hasta que el estado deje de ser 'pendiente_pago' o el
  // hold caduque (evita colgarse indefinidamente si algo raro pasa).
  useEffect(() => {
    stopped.current = false;
    if (status !== "pendiente_pago") return;

    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (stopped.current) return;
      try {
        const res = await getPaymentReturnStatus(shopSlug, appointmentId);
        if (stopped.current) return;
        if (res.ok) {
          setStatus(res.status);
          setExpiresAt(res.paymentExpiresAt);
          setPollError(null);
        } else {
          setPollError(res.error);
        }
      } catch {
        if (!stopped.current) setPollError("No pudimos verificar el pago.");
      }
      if (!stopped.current) timer = setTimeout(tick, POLL_MS);
    };

    timer = setTimeout(tick, POLL_MS);
    return () => {
      stopped.current = true;
      clearTimeout(timer);
    };
  }, [status, shopSlug, appointmentId]);

  // Countdown del hold: cuenta atrás visible mientras seguimos esperando.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status !== "pendiente_pago") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [status]);

  const secondsLeft = useMemo(() => {
    if (!expiresAt) return 0;
    return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
  }, [expiresAt, now]);

  if (status === "confirmada") {
    return (
      <Card
        tone="ok"
        icon={<Check className="h-8 w-8" strokeWidth={3} />}
        title="¡Pago confirmado!"
        message="Recibimos tu anticipo y tu cita quedó confirmada. Te avisaremos por WhatsApp o correo si hubiera algún cambio."
        cta={<HomeLink shopSlug={shopSlug} label="Volver a la barbería" />}
      />
    );
  }

  if (status === "cancelada") {
    return (
      <Card
        tone="warn"
        icon={<XCircle className="h-8 w-8" />}
        title="El pago no llegó a tiempo"
        message="Tu hold expiró y liberamos el horario. Si aún quieres esa cita, vuelve a reservar."
        cta={<HomeLink shopSlug={shopSlug} label="Reservar otra vez" />}
      />
    );
  }

  // Aquí queda 'pendiente_pago' (y por completitud otros estados de espera).
  return (
    <Card
      tone="info"
      icon={<Clock className="h-8 w-8 animate-pulse" />}
      title="Estamos confirmando tu pago"
      message="Puede tomar unos segundos. No cierres esta ventana hasta ver la confirmación."
      cta={
        <div className="text-sm text-stone-500">
          {secondsLeft > 0 ? (
            <>
              Tienes <span className="font-semibold text-stone-800">{fmtTime(secondsLeft)}</span> para completar el pago.
            </>
          ) : (
            "Verificando…"
          )}
          {pollError && (
            <div className="mt-3 text-xs text-red-600">{pollError}</div>
          )}
        </div>
      }
    />
  );
}

function Card({
  tone,
  icon,
  title,
  message,
  cta,
}: {
  tone: "ok" | "warn" | "info";
  icon: React.ReactNode;
  title: string;
  message: string;
  cta: React.ReactNode;
}) {
  const ring =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-sky-50 text-sky-700 ring-sky-200";
  return (
    <div className="mx-auto max-w-md text-center">
      <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full ring-2 ${ring}`}>
        {icon}
      </div>
      <h1 className="mt-6 font-display text-2xl font-semibold text-ink sm:text-3xl">
        {title}
      </h1>
      <p className="mt-3 text-stone-600">{message}</p>
      <div className="mt-8">{cta}</div>
    </div>
  );
}

function HomeLink({ shopSlug, label }: { shopSlug: string; label: string }) {
  return (
    <Link href={`/${shopSlug}`}>
      <Button variant="primary" size="lg">
        {label}
      </Button>
    </Link>
  );
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
