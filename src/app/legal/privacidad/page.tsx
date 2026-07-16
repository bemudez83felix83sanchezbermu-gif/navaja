import type { Metadata } from "next";
import { LEGAL_ENTITY, LEGAL_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Aviso de Privacidad",
  description:
    "Cómo Navaja recaba, usa y protege tus datos personales, y cómo ejercer tus derechos ARCO.",
};

/** Bloques tipográficos locales: suficiente para un documento legal sin
 *  arrastrar un plugin de prosa. */
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

export default function PrivacidadPage() {
  return (
    <article>
      <p className="text-sm font-semibold uppercase tracking-widest text-gold-400">Legal</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-white">
        Aviso de Privacidad
      </h1>
      <p className="mt-3 text-sm text-stone-500">
        Última actualización: {LEGAL_VERSION} · Versión aplicable a cuentas creadas a
        partir de esa fecha.
      </p>

      <P>
        {LEGAL_ENTITY.name} (en adelante, «Navaja», «nosotros») es responsable del
        tratamiento de los datos personales que se describen en este aviso, en
        términos de la Ley Federal de Protección de Datos Personales en Posesión de
        los Particulares (LFPDPPP) y su Reglamento. Puedes contactarnos en{" "}
        <a href={`mailto:${LEGAL_ENTITY.email}`} className="text-gold-300 underline-offset-2 hover:underline">
          {LEGAL_ENTITY.email}
        </a>
        .
      </P>

      <H2>1. A quién aplica este aviso</H2>
      <P>Este aviso cubre dos tipos de personas:</P>
      <UL
        items={[
          <>
            <strong className="text-white">Dueños y personal de barberías</strong> que
            crean una cuenta en Navaja para administrar su negocio.
          </>,
          <>
            <strong className="text-white">Clientes finales</strong> que reservan una
            cita en la página pública de una barbería que usa Navaja.
          </>,
        ]}
      />
      <P>
        Importante: cuando reservas una cita, la barbería es la responsable de tus
        datos y Navaja actúa como <em>encargado</em> del tratamiento — procesamos tus
        datos únicamente por cuenta de la barbería para gestionar tu reserva. Para
        finalidades propias de la barbería (por ejemplo, sus promociones), consulta
        directamente con ella.
      </P>

      <H2>2. Datos que recabamos</H2>
      <UL
        items={[
          <>
            <strong className="text-white">Cuenta del negocio:</strong> nombre del
            titular, correo electrónico y contraseña (almacenada cifrada; nunca en
            texto plano).
          </>,
          <>
            <strong className="text-white">Datos del negocio:</strong> nombre de la
            barbería, dirección, teléfono, horarios, servicios y equipo de trabajo.
          </>,
          <>
            <strong className="text-white">Reservas (clientes finales):</strong>{" "}
            nombre, teléfono, correo electrónico (opcional) y notas que decidas
            agregar a tu cita.
          </>,
          <>
            <strong className="text-white">Datos técnicos:</strong> dirección IP y
            registros básicos de acceso, usados para seguridad (por ejemplo, limitar
            intentos de acceso automatizados).
          </>,
        ]}
      />
      <P>No recabamos datos personales sensibles ni datos financieros en esta etapa.</P>

      <H2>3. Finalidades del tratamiento</H2>
      <P>Finalidades primarias (necesarias para el servicio):</P>
      <UL
        items={[
          "Crear y administrar tu cuenta y tu barbería en la plataforma.",
          "Gestionar reservas: agendar, confirmar, recordar, reagendar o cancelar citas.",
          "Enviar notificaciones operativas (confirmaciones y recordatorios por correo o WhatsApp, según la configuración de la barbería).",
          "Mantener la seguridad de la plataforma y prevenir fraude o abuso.",
          "Cumplir obligaciones legales aplicables.",
        ]}
      />
      <P>
        Finalidades secundarias (puedes negarte sin afectar el servicio escribiendo a{" "}
        {LEGAL_ENTITY.email}): estadísticas agregadas de uso y comunicaciones sobre
        mejoras del producto.
      </P>

      <H2>4. Transferencias y encargados</H2>
      <P>
        No vendemos tus datos. Solo los compartimos con proveedores que necesitamos
        para operar, bajo contratos que los obligan a protegerlos:
      </P>
      <UL
        items={[
          "Infraestructura de base de datos y autenticación (Supabase).",
          "Alojamiento del servicio (servidores propios en un proveedor de nube).",
          "Proveedores de mensajería (correo/WhatsApp) para confirmaciones y recordatorios.",
        ]}
      />
      <P>
        Algunos proveedores pueden ubicarse fuera de {LEGAL_ENTITY.jurisdiction}; en
        esos casos exigimos medidas de protección equivalentes a las de este aviso.
      </P>

      <H2>5. Derechos ARCO y revocación</H2>
      <P>
        Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte al tratamiento de
        tus datos (derechos ARCO), así como a revocar tu consentimiento. Para
        ejercerlos, escribe a {LEGAL_ENTITY.email} desde el correo asociado a tu
        cuenta, indicando qué derecho quieres ejercer. Responderemos en los plazos
        que marca la LFPDPPP. Si eres cliente final de una barbería, también puedes
        dirigir tu solicitud a la barbería (responsable) y nosotros la apoyaremos
        como encargado.
      </P>

      <H2>6. Cookies</H2>
      <P>
        Usamos únicamente cookies esenciales: la cookie de sesión que te mantiene
        dentro de tu cuenta y una cookie de preferencia de tema (claro/oscuro). No
        usamos cookies de publicidad ni rastreadores de terceros. Puedes borrarlas
        desde tu navegador; la de sesión es necesaria para usar el panel.
      </P>

      <H2>7. Conservación y seguridad</H2>
      <P>
        Conservamos los datos mientras la cuenta esté activa y el tiempo necesario
        para cumplir obligaciones legales. Aplicamos medidas de seguridad
        administrativas y técnicas: cifrado en tránsito (TLS), contraseñas con hash,
        aislamiento por barbería a nivel de base de datos y acceso restringido a
        datos de clientes.
      </P>

      <H2>8. Cambios a este aviso</H2>
      <P>
        Si modificamos este aviso de forma sustancial, lo publicaremos aquí con una
        nueva fecha de versión y, cuando el cambio lo amerite, te lo notificaremos al
        correo de tu cuenta. La versión que aceptaste al registrarte queda asociada a
        tu cuenta.
      </P>

      <H2>9. Contacto</H2>
      <P>
        Dudas sobre privacidad y protección de datos: {LEGAL_ENTITY.email}. Si
        consideras que tu derecho a la protección de datos fue vulnerado, puedes
        acudir al Instituto Nacional de Transparencia, Acceso a la Información y
        Protección de Datos Personales (INAI).
      </P>
    </article>
  );
}
