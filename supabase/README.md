# Supabase — backend seguro de Navaja

SQL listo para aplicar. Implementa el modelo de datos multi-tenant con **Row Level Security** y una vía de reserva segura para clientes anónimos.

## Orden de aplicación
1. `schema.sql` — tablas, enums, índices y la restricción anti-doble-reserva.
2. `policies.sql` — RLS, vista pública sin PII y la función `book_appointment`.

```bash
# con la CLI de Supabase
supabase db execute --file supabase/schema.sql
supabase db execute --file supabase/policies.sql
# o pega cada archivo en el SQL Editor del dashboard.
```

## Modelo de seguridad (resumen)

| Rol | Puede | No puede |
|---|---|---|
| `anon` (cliente) | Leer barberías/servicios/barberos activos; ver horarios ocupados (sin PII); **reservar vía `book_appointment`** | Leer clientes/citas; tocar tablas directamente; ver datos de otra barbería |
| `authenticated` (dueño/staff) | CRUD **solo de su barbería** (vía `memberships`) | Acceder a datos de otro tenant |
| `service_role` (backend) | Todo (salta RLS) | — úsala solo en el servidor, nunca en el cliente |

## Por qué es robusto
- **Aislamiento por tenant**: cada política filtra por `app_is_member(barbershop_id)`. Un dueño nunca ve otra barbería.
- **PII protegida**: `clients` y `appointments` son inaccesibles para `anon` (políticas + `REVOKE`).
- **Escritura anónima controlada**: el cliente no inserta en tablas; llama a `book_appointment` (SECURITY DEFINER con `search_path` fijo), que valida servicio, barbero, horario y hace upsert del cliente.
- **Anti doble-reserva a nivel BD**: `EXCLUDE USING gist` impide solapes del mismo barbero aunque la app tenga una condición de carrera.
- **Sin fuga de horarios con PII**: `busy_slots` expone solo barbero + rango.

## Integración en la app
Hoy la UI usa la [capa mock](../src/lib/data/mock.ts). Para migrar:
1. Pon las llaves en `.env.local` (ver [`.env.example`](../.env.example)).
2. Crea el cliente Supabase (anon en el navegador; service_role solo en server).
3. Reescribe las funciones de `mock.ts` como consultas (`select … ` ya filtradas por RLS).
4. En el [Server Action de reserva](../src/app/actions/book.ts), reemplaza el TODO por `rpc('book_appointment', …)`.

Ver el modelo de amenazas completo en [`../SECURITY.md`](../SECURITY.md).
