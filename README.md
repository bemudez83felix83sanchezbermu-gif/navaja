# Navaja · Agenda sin fricción para barberías

SaaS multi-tenant de **agendamiento de citas** para barberías. Tres superficies:

1. **Landing** (`/`) — marketing premium, oscuro y cinematográfico.
2. **Reserva pública** (`/[barberia]`, p. ej. `/el-filo`) — wizard de 4 pasos para que el cliente agende en ~30 s.
3. **Panel del dueño** (`/dashboard`) — resumen, agenda visual, citas, servicios, barberos y clientes.

> Proyecto de portafolio. La capa de datos es un mock tipado **listo para Supabase** (ver abajo).

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
├─ proxy.ts                    # 🔒 CSP con nonce + cabeceras de seguridad (Next 16)
├─ app/
│  ├─ layout.tsx              # fuentes, metadata, force-dynamic (nonce CSP)
│  ├─ page.tsx                # Landing
│  ├─ error.tsx · global-error.tsx · not-found.tsx   # 🔒 boundaries sin fugas
│  ├─ robots.ts              # 🔒 bloquea /dashboard en buscadores
│  ├─ actions/book.ts        # 🔒 Server Action: rate-limit + Zod + honeypot
│  ├─ [shop]/page.tsx         # Reserva pública (valida slug → 404)
│  └─ dashboard/             # layout + resumen, agenda, citas, servicios, barberos, clientes
├─ components/
│  ├─ brand/ · ui/ · landing/ · booking/ · dashboard/
└─ lib/
   ├─ utils.ts                # cn + formateadores es-MX
   ├─ data/                   # types.ts (modelo) + mock.ts (datos + queries)
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
