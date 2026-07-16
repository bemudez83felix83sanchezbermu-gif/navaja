# Seguridad · Navaja

Postura de seguridad **defense-in-depth** (en capas). Ninguna capa es perfecta; juntas elevan mucho el costo de un ataque. Este documento es la fuente de verdad técnica; la versión narrada vive en la bóveda de Obsidian (sección _Seguridad_).

> Honestidad: "seguridad absoluta" no existe. Esto cubre las clases de riesgo comunes de una app web y deja el camino trazado para el resto.

## 1. Modelo de amenazas (resumen)

| Activo | Amenaza | Mitigación | Dónde |
|---|---|---|---|
| Datos de clientes (PII) | Acceso entre tenants | RLS por `barbershop_id` | `supabase/policies.sql` |
| Citas | Doble reserva / manipulación | RPC validado + `EXCLUDE` constraint | `supabase/*.sql` |
| Formulario de reserva | Spam / bots | Rate-limit + honeypot + timing + Zod | `src/lib/security/`, `actions/book.ts` |
| Cuentas de dueños | Credential stuffing / fuerza bruta | Rate-limit por IP + mensajes no reveladores | `actions/auth.ts` |
| Panel (dashboard) | Acceso sin sesión / entre tenants | Guard optimista en proxy + `requireMembership()` en la capa de datos | `src/proxy.ts`, `lib/auth.ts` |
| Toda la app | XSS | CSP con nonce + `strict-dynamic` | `src/proxy.ts`, `lib/security/csp.ts` |
| Toda la app | Clickjacking | `frame-ancestors 'none'` + `X-Frame-Options` | `csp.ts` |
| Sesión | CSRF | Server Actions (Origin check) + cookies `SameSite=Lax` httpOnly | `actions/*.ts`, `@supabase/ssr` |
| Secretos | Fuga al cliente / repo | `.env*` ignorado, validación de env, server-only | `.gitignore`, `lib/security/env.ts` |
| Transporte | Downgrade / sniffing | HSTS + `upgrade-insecure-requests` (prod) | `csp.ts` |
| Errores | Fuga de stack/internos | Boundaries sin detalle, sólo `digest` | `app/error.tsx`, `global-error.tsx` |

## 2. Controles implementados

### Autenticación y autorización (`src/lib/auth.ts`, `actions/auth.ts`, `src/proxy.ts`)
- **Supabase Auth con cookies** (`@supabase/ssr`): httpOnly, `SameSite=Lax`; el token se refresca en el proxy (los Server Components no pueden escribir cookies).
- **Dos capas** (patrón recomendado por Next): el proxy hace el chequeo *optimista* (redirige `/dashboard` → `/login` sin sesión) y la capa de datos hace el chequeo *seguro*: toda query del panel sin slug explícito resuelve el tenant vía `requireMembership()` (sesión verificada con `auth.getUser()` + fila en `memberships`). Sin membresía no hay datos.
- **Registro** crea usuario + barbería + membresía + prueba de 14 días con rollback si falla a medias; el consentimiento (versión y fecha de Términos/Aviso) queda en `app_metadata`, que el usuario **no** puede editar (evidencia LFPDPPP).
- **Login/recuperación**: mensajes genéricos (no revelan si un correo existe), rate-limit por IP (8/min login, 5/10 min registro, 3/10 min reset), reset por enlace PKCE (`/auth/callback` con anti open-redirect).
- Slugs reservados (`login`, `registro`, `legal`, `auth`, …) para que ningún tenant tape rutas de la app.

### Cabeceras HTTP de seguridad (`src/proxy.ts` + `lib/security/csp.ts`)
- **Content-Security-Policy** con **nonce por petición** y `'strict-dynamic'` en producción (sin `'unsafe-inline'` en scripts). En desarrollo se relaja para HMR/Turbopack.
- `Strict-Transport-Security` (prod), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (cámara/micro/geo deshabilitados), `Cross-Origin-Opener-Policy` y `Cross-Origin-Resource-Policy: same-origin`.
- `X-Powered-By` desactivado y sin source maps de navegador en prod (`next.config.ts`).

> Nota documentada: `style-src` mantiene `'unsafe-inline'` porque la UI usa atributos `style={...}` (no admiten nonce). Riesgo bajo (no ejecuta scripts).
>
> Trade-off del nonce: el nonce por petición exige **render dinámico**, por eso el layout raíz fija `export const dynamic = "force-dynamic"`. Verificado en build de producción: el nonce de la cabecera coincide con el del HTML y la app hidrata sin violaciones de CSP.

El proxy de seguridad vive en `src/proxy.ts` (convención de Next 16; reemplaza al antiguo `middleware.ts`).

### Validación de entrada (`src/lib/security/validation.ts`)
- Esquemas **Zod** con `.strict()` (rechaza claves extra → anti mass-assignment), longitudes acotadas, formato de teléfono/email, y validación de fecha futura.
- Es el **límite de confianza**: el servidor revalida todo, no confía en el cliente.

### Anti-abuso (`actions/book.ts`, `validation.ts`, `rate-limit.ts`)
- **Rate limiting** por IP (5/min en reservas).
- **Honeypot** (campo oculto `company`) + **umbral de tiempo** mínimo de llenado (`MIN_FILL_MS`).
- Toda la reserva pasa por un **Server Action** (POST, protección CSRF por Origin de Next).

### Seguridad de datos (`supabase/`)
- **RLS** activa en todas las tablas (deny-by-default), aislada por tenant.
- PII (`clients`/`appointments`) inaccesible para anónimos.
- Reserva anónima solo vía `book_appointment` (SECURITY DEFINER, `search_path` fijo).
- Anti doble-reserva a nivel BD (`EXCLUDE USING gist`).
- Detalle en [`supabase/README.md`](./supabase/README.md).

### Secretos y entorno
- `.env*` en `.gitignore`; solo `.env.example` (sin valores) se versiona.
- `src/lib/security/env.ts` valida el entorno con Zod y **falla en arranque** si algo falta en producción.
- La llave `service_role` es solo-servidor y nunca lleva prefijo `NEXT_PUBLIC_`.

### Manejo de errores
- Boundaries (`error.tsx`, `global-error.tsx`, `not-found.tsx`) sin exponer stack ni mensajes internos; solo un `digest` citable.

## 3. Dependencias
- Ejecuta `npm audit` en cada cambio de dependencias. (Estado inicial: 2 vulnerabilidades moderadas heredadas de la cadena de build; revisar con `npm audit`.)
- Mantén el lockfile commiteado y actualiza con criterio (Dependabot/renovate recomendado).

## 4. Pendiente / no cubierto aún (honesto)
- **MFA** para dueños (Supabase lo soporta; falta UI).
- **Confirmación de correo** en el alta (hoy `email_confirm: true` vía admin para no depender de SMTP; activar al configurar un remitente propio).
- **Rate limit distribuido** (Upstash/Redis) — el actual es por instancia.
- WAF/anti-DDoS perimetral (Vercel/Cloudflare).
- Registro de auditoría y alertas.
- Pruebas de seguridad automatizadas (SAST/DAST) en CI.

## 5. Checklist de despliegue
- [ ] `npm audit` sin vulnerabilidades altas/críticas.
- [ ] Variables en `.env.local`/secrets del hosting (nunca en el repo).
- [ ] `schema.sql` + `policies.sql` aplicados; probar acceso cruzado entre tenants (debe fallar).
- [ ] Supabase Auth: configurar **Site URL + Redirect URLs** (si no, el email de recuperación no vuelve a la app) y SMTP propio (el default limita ~3 correos/hora).
- [ ] Probar `/dashboard` sin sesión (debe redirigir a `/login`) y login con credenciales malas (mensaje genérico + rate-limit).
- [ ] Verificar cabeceras en prod (`curl -I`): CSP, HSTS, nosniff, frame-ancestors.
- [ ] Probar el flujo de reserva con honeypot lleno (debe rechazar).
- [ ] Revisar textos de `/legal/*` con abogado y sustituir la razón social placeholder (`src/lib/legal.ts`).
- [ ] HTTPS forzado en el hosting.

## 6. Reporte de vulnerabilidades
Si encuentras un problema de seguridad, repórtalo en privado a `seguridad@navaja.app` (placeholder). No abras un issue público. Damos acuse en 72 h.
