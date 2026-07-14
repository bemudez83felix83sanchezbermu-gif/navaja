# Navaja · Agenda sin fricción para barberías

SaaS multi-tenant de **agendamiento de citas** para barberías. Tres superficies:

1. **Landing** (`/`) — marketing premium, oscuro y cinematográfico.
2. **Reserva pública** — cada barbería vive en **su propio dominio**: `{slug}.navaja.app` automático o su dominio propio (`barberiaelfilo.com`), con fallback por path (`/el-filo`). Wizard de 4 pasos para agendar en ~30 s.
3. **Panel del dueño** (`/dashboard`) — resumen, agenda visual, citas, servicios, barberos, clientes y **configuración auto-servicio completa**.

> Proyecto de portafolio. La capa de datos es un mock tipado **listo para Supabase** (ver abajo).

## Auto-servicio (cero tickets de soporte)

Todo se configura desde `/dashboard/configuracion`, sin tocar código ni contactar a nadie:

- **Negocio** — nombre, lema, teléfono, dirección, zona horaria, días y horario.
- **Reservas** — intervalo de horarios, anticipación mínima, horizonte máximo,
  confirmación automática, elección de barbero, correo obligatorio, ventana de
  cancelación. Las reglas gobiernan el wizard público en vivo.
- **Dominio** — subdominio `{slug}.navaja.app` editable + conexión de dominio
  propio: instrucciones DNS (CNAME/A), verificación y SSL automático
  (Caddy `on_demand_tls` en producción). El proxy resuelve el tenant por `Host`.
- **Notificaciones** — confirmaciones, recordatorios 24 h/2 h, WhatsApp, avisos al dueño.
- **Equipo** — invitaciones por correo con roles dueño/staff.
- **Plan y facturación** — planes Esencial/Pro/Estudio, medidores de uso, facturas.

En dev el routing multi-tenant funciona sin configurar nada: `el-filo.localhost:3000`.

## Stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4** (tokens en `@theme`, sin config JS)
- **lucide-react** para iconografía (SVG, cero emojis como íconos)
- Fuentes vía `next/font`: **Playfair Display** (display) · **Inter** (UI) · **JetBrains Mono** (cifras)

## Cómo correrlo

```bash
npm install
npm run dev
# http://localhost:3000
```

Rutas: `/` · `/el-filo` · `/dashboard` · `/dashboard/agenda` · `/dashboard/citas` · `/dashboard/servicios` · `/dashboard/barberos` · `/dashboard/clientes`

## Arquitectura

```
src/
├─ proxy.ts                    # 🔒 CSP con nonce + cabeceras + routing multi-tenant por Host
├─ app/
│  ├─ layout.tsx              # fuentes, metadata, force-dynamic (nonce CSP)
│  ├─ page.tsx                # Landing
│  ├─ error.tsx · global-error.tsx · not-found.tsx   # 🔒 boundaries sin fugas
│  ├─ robots.ts              # 🔒 bloquea /dashboard en buscadores
│  ├─ actions/book.ts        # 🔒 Server Action: rate-limit + Zod + honeypot
│  ├─ actions/settings.ts    # 🔒 Server Actions de configuración (mismo pipeline)
│  ├─ [shop]/page.tsx         # Reserva pública (valida slug → 404)
│  └─ dashboard/             # resumen, agenda, citas, servicios, barberos, clientes
│     └─ configuracion/      # negocio · reservas · dominio · notificaciones · equipo · plan
├─ components/
│  ├─ brand/ · ui/ · landing/ · booking/ · dashboard/ · settings/
└─ lib/
   ├─ utils.ts                # cn + formateadores es-MX
   ├─ tenant.ts               # resolución host → tenant (subdominios y dominios propios)
   ├─ data/                   # types.ts (modelo) + mock.ts (queries) + store.ts (settings)
   └─ security/               # 🔒 csp.ts · validation.ts · rate-limit.ts · env.ts
supabase/                     # 🔒 schema.sql + policies.sql (RLS) + README
SECURITY.md                   # 🔒 modelo de amenazas + controles + checklist
.env.example                  # plantilla de variables (sin secretos)
```

## Capa de datos · lista para Supabase

`src/lib/data/types.ts` modela las tablas como un esquema Postgres multi-tenant:

```
barbershops 1─┬─< barbers
              ├─< services
              ├─< clients
              └─< appointments >── barber · service · client
```

`mock.ts` expone la misma superficie de _queries_ que tendría el backend real
(`appointmentsOn`, `availability`, `kpisForToday`, …). Para conectar Supabase basta
reemplazar esas funciones por consultas SQL/RLS sin tocar la UI. El generador de
citas se ancla a "hoy", así que la agenda siempre se ve viva.

## Seguridad

Postura **defense-in-depth**, verificada en build de producción. Detalle completo en
[`SECURITY.md`](./SECURITY.md). En resumen:

- **CSP con nonce por petición** (`'strict-dynamic'`) + cabeceras (HSTS, nosniff,
  `frame-ancestors 'none'`, Referrer/Permissions-Policy, COOP/CORP) en `src/proxy.ts`.
- **Validación Zod** estricta + **rate-limiting** + **honeypot** y umbral de tiempo en el
  Server Action de reserva (`src/app/actions/book.ts`).
- **RLS multi-tenant** y reserva anónima vía RPC seguro (`supabase/`).
- **Secretos** fuera del repo (`.gitignore` + `.env.example` + validación de entorno).
- **Errores** sin fuga de stack (`error.tsx` / `global-error.tsx`).

## Sistema de diseño

Ver [`DESIGN.md`](./DESIGN.md). Resumen: identidad **premium oscuro + acento dorado**,
minimalismo suizo en el panel, todo con tokens semánticos en `src/app/globals.css`.
