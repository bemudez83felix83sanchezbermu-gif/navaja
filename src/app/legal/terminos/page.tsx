import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_ENTITY, LEGAL_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description: "Condiciones de uso del servicio de agendamiento Navaja.",
};

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 font-display text-2xl font-semibold tracking-tight text-white">
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 leading-relaxed text-stone-300">{children}</p>;
}
function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-6 leading-relaxed text-stone-300 marker:text-gold-400">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  );
}

export default function TerminosPage() {
  return (
    <article>
      <p className="text-sm font-semibold uppercase tracking-widest text-gold-400">Legal</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-white">
        Términos y Condiciones
      </h1>
      <p className="mt-3 text-sm text-stone-500">Última actualización: {LEGAL_VERSION}</p>

      <P>
        Estos términos regulan el uso de la plataforma de agendamiento{" "}
        {LEGAL_ENTITY.name} («el Servicio»). Al crear una cuenta aceptas estos
        términos y el{" "}
        <Link href="/legal/privacidad" className="text-gold-300 underline-offset-2 hover:underline">
          Aviso de Privacidad
        </Link>
        . Si no estás de acuerdo, no uses el Servicio.
      </P>

      <H2>1. El Servicio</H2>
      <P>
        Navaja es una plataforma en línea para que barberías administren su agenda:
        página pública de reservas, calendario por barbero, fichas de clientes,
        recordatorios y reportes. El Servicio se ofrece bajo suscripción por planes.
      </P>

      <H2>2. Tu cuenta</H2>
      <UL
        items={[
          "Debes ser mayor de edad y proporcionar información veraz al registrarte.",
          "Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada con tu cuenta.",
          "Una cuenta corresponde a una barbería; puedes invitar a tu equipo con los roles que el plan permita.",
          "Avísanos de inmediato a soporte@navaja.app si detectas un acceso no autorizado.",
        ]}
      />

      <H2>3. Planes, prueba gratuita y pagos</H2>
      <UL
        items={[
          "Al registrarte obtienes un periodo de prueba de 14 días sin costo y sin tarjeta.",
          "Al terminar la prueba, para seguir usando el Servicio deberás contratar un plan de pago; los precios vigentes se muestran en la página de precios y en tu panel.",
          "Los precios pueden actualizarse; te avisaremos con al menos 30 días de anticipación y aplicarán a partir de tu siguiente ciclo de facturación.",
          "Puedes cancelar en cualquier momento; la cancelación surte efecto al final del ciclo pagado y no genera reembolsos parciales.",
        ]}
      />

      <H2>4. Tus datos y los de tus clientes</H2>
      <UL
        items={[
          "Los datos que cargas (servicios, precios, clientes, citas) son tuyos. Navaja no los vende ni los usa para fines distintos a operar el Servicio.",
          "Respecto de los datos personales de tus clientes finales, tú eres el responsable del tratamiento y Navaja actúa como encargado: los procesamos solo siguiendo tus instrucciones a través de la plataforma.",
          "Te obligas a usar los datos de tus clientes conforme a la ley aplicable (LFPDPPP) y a atender sus solicitudes de derechos ARCO.",
          "Si cierras tu cuenta puedes solicitar la exportación de tus datos; después de un periodo razonable serán eliminados de nuestros sistemas.",
        ]}
      />

      <H2>5. Uso aceptable</H2>
      <P>No está permitido:</P>
      <UL
        items={[
          "Usar el Servicio para actividades ilícitas, spam o envío de mensajes no solicitados.",
          "Intentar vulnerar la seguridad, acceder a datos de otras barberías o sobrecargar la plataforma.",
          "Revender o sublicenciar el Servicio sin autorización escrita.",
        ]}
      />
      <P>
        Podemos suspender cuentas que violen estos términos, previa notificación
        cuando sea razonable.
      </P>

      <H2>6. Disponibilidad y soporte</H2>
      <P>
        Trabajamos para mantener el Servicio disponible de forma continua, pero se
        ofrece «tal cual» y puede haber interrupciones por mantenimiento o causas
        fuera de nuestro control. Realizamos respaldos periódicos; aun así, te
        recomendamos exportar tu información importante.
      </P>

      <H2>7. Limitación de responsabilidad</H2>
      <P>
        En la medida permitida por la ley, la responsabilidad total de Navaja frente
        a ti por cualquier reclamación derivada del Servicio se limita al monto que
        pagaste por el Servicio en los tres meses anteriores al hecho que la origine.
        Navaja no responde por daños indirectos ni por la relación comercial entre la
        barbería y sus clientes (citas no atendidas, calidad del servicio prestado,
        etcétera).
      </P>

      <H2>8. Propiedad intelectual</H2>
      <P>
        La plataforma, su marca, diseño y código son propiedad de{" "}
        {LEGAL_ENTITY.name}. Te otorgamos una licencia de uso limitada, no exclusiva
        e intransferible mientras tu suscripción esté activa.
      </P>

      <H2>9. Modificaciones</H2>
      <P>
        Podemos actualizar estos términos. Los cambios sustanciales se notificarán al
        correo de tu cuenta con anticipación razonable; seguir usando el Servicio
        después de la fecha de entrada en vigor implica su aceptación.
      </P>

      <H2>10. Ley aplicable</H2>
      <P>
        Estos términos se rigen por las leyes de {LEGAL_ENTITY.jurisdiction}. Para
        cualquier controversia, las partes se someten a los tribunales competentes de
        la Ciudad de México, renunciando a cualquier otro fuero.
      </P>

      <H2>Contacto</H2>
      <P>
        Preguntas sobre estos términos: soporte@navaja.app · Privacidad:{" "}
        {LEGAL_ENTITY.email}
      </P>
    </article>
  );
}
