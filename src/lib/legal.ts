/**
 * Constantes legales compartidas (páginas /legal, registro y reservas).
 *
 * `LEGAL_VERSION` se guarda como evidencia de consentimiento en el
 * `app_metadata` del usuario al registrarse (solo editable con service_role,
 * a diferencia de user_metadata que el propio usuario puede cambiar). Si los
 * textos legales cambian de fondo, sube la versión: permite saber qué versión
 * aceptó cada cuenta.
 */
export const LEGAL_VERSION = "2026-07-14";

/** Datos del responsable mostrados en los avisos. TODO: razón social real. */
export const LEGAL_ENTITY = {
  name: "Navaja",
  email: "privacidad@navaja.app",
  jurisdiction: "México",
};
