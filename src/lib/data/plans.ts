import type { Plan } from "./types";

/**
 * Catálogo de planes. Datos estáticos de producto (no viven en la DB):
 * cambiarlos es un deploy, igual que cambiar precios en la landing.
 * La suscripción de cada barbería sí vive en la tabla `subscriptions`.
 */
export const PLANS: Plan[] = [
  {
    id: "esencial",
    name: "Esencial",
    priceCents: 24900,
    maxBarbers: 2,
    maxAppointmentsPerMonth: 200,
    customDomain: false,
    whatsapp: false,
    highlights: [
      "Agenda y reservas ilimitadas por web",
      "Hasta 2 barberos",
      "Subdominio incluido",
      "Recordatorios por email",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceCents: 49900,
    maxBarbers: 8,
    maxAppointmentsPerMonth: 1000,
    customDomain: true,
    whatsapp: true,
    highlights: [
      "Todo lo de Esencial",
      "Hasta 8 barberos",
      "Dominio propio con SSL automático",
      "Recordatorios por WhatsApp",
      "Reportes de ocupación y no-shows",
    ],
  },
  {
    id: "estudio",
    name: "Estudio",
    priceCents: 89900,
    maxBarbers: 20,
    maxAppointmentsPerMonth: 5000,
    customDomain: true,
    whatsapp: true,
    highlights: [
      "Todo lo de Pro",
      "Hasta 20 barberos y multi-sucursal",
      "Roles y permisos avanzados",
      "Soporte prioritario",
    ],
  },
];
