"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  Copy,
  Globe,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { DomainStatus, ShopDomain } from "@/lib/data/types";
import {
  addDomain,
  removeDomain,
  setPrimaryDomain,
  updateSlug,
  verifyDomain,
} from "@/app/actions/settings";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ResultNotice, useSettingsAction } from "./shared";
import { cn } from "@/lib/utils";

const STATUS: Record<
  DomainStatus,
  { label: string; className: string; icon: typeof Globe }
> = {
  activo: {
    label: "Activo · SSL",
    className: "bg-success-bg text-success",
    icon: ShieldCheck,
  },
  pendiente_dns: {
    label: "Esperando DNS",
    className: "bg-warning-bg text-warning",
    icon: RefreshCw,
  },
  verificando: {
    label: "Emitiendo certificado…",
    className: "bg-stone-100 text-info",
    icon: Loader2,
  },
  error: {
    label: "Error de verificación",
    className: "bg-destructive-bg text-destructive",
    icon: TriangleAlert,
  },
};

function StatusChip({ status }: { status: DomainStatus }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        s.className,
      )}
    >
      <s.icon className={cn("h-3.5 w-3.5", status === "verificando" && "animate-spin")} />
      {s.label}
    </span>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard unavailable — value is visible anyway */
        }
      }}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-stone-100 px-2 py-1 font-mono text-xs text-ink transition-colors hover:bg-stone-200"
      title="Copiar"
    >
      <span className="truncate">{value}</span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-success" strokeWidth={3} />
      ) : (
        <Copy className="h-3 w-3 shrink-0 text-stone-400" />
      )}
    </button>
  );
}

/** DNS records the owner must create at their registrar. */
function DnsInstructions({ rootDomain }: { rootDomain: string }) {
  const rows = [
    { type: "CNAME", name: "www", value: `dominios.${rootDomain}` },
    { type: "A", name: "@", value: "203.0.113.24" },
  ];
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-stone-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <th className="px-3 py-2 font-semibold">Tipo</th>
            <th className="px-3 py-2 font-semibold">Nombre</th>
            <th className="px-3 py-2 font-semibold">Valor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.type} className="border-b border-stone-100 last:border-0">
              <td className="px-3 py-2.5 font-mono text-xs font-semibold text-ink">{r.type}</td>
              <td className="px-3 py-2.5 font-mono text-xs text-stone-600">{r.name}</td>
              <td className="px-3 py-2.5">
                <CopyValue value={r.value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function DomainsPanel({
  domains,
  slug,
  rootDomain,
  planAllowsCustom,
}: {
  domains: ShopDomain[];
  slug: string;
  rootDomain: string;
  planAllowsCustom: boolean;
}) {
  const subdomain = domains.find((d) => d.kind === "subdominio");
  const customs = domains.filter((d) => d.kind === "propio");

  const [slugDraft, setSlugDraft] = useState(slug);
  const [newDomain, setNewDomain] = useState("");
  const slugAction = useSettingsAction();
  const domainAction = useSettingsAction();

  return (
    <div className="space-y-5">
      {/* ---- Managed subdomain ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Tu dirección en Navaja</CardTitle>
          {subdomain?.isPrimary && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/12 px-2.5 py-1 text-xs font-semibold text-gold">
              <Star className="h-3 w-3 fill-gold" /> Principal
            </span>
          )}
        </CardHeader>
        <CardBody>
          <p className="mb-3 text-sm leading-relaxed text-stone-500">
            Incluida con tu cuenta, lista desde el primer día con SSL. Cámbiala cuando
            quieras — los enlaces anteriores dejarán de funcionar.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              slugAction.run(() => updateSlug(slugDraft));
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-xl border border-stone-200 bg-white focus-within:border-gold focus-within:ring-1 focus-within:ring-gold">
              <input
                value={slugDraft}
                onChange={(e) => setSlugDraft(e.target.value.toLowerCase())}
                aria-label="Subdominio"
                className="h-11 min-w-0 flex-1 bg-transparent px-3.5 text-[0.95rem] text-ink outline-none placeholder:text-stone-400"
                placeholder="tu-barberia"
                pattern="[a-z0-9][a-z0-9-]{0,38}[a-z0-9]"
                minLength={2}
                maxLength={40}
                required
              />
              <span className="shrink-0 border-l border-stone-200 bg-stone-50 px-3.5 py-2.5 font-mono text-sm text-stone-500">
                .{rootDomain}
              </span>
            </div>
            <Button type="submit" size="md" variant="dark" disabled={slugAction.pending || slugDraft === slug}>
              {slugAction.pending ? "Guardando…" : "Guardar"}
            </Button>
          </form>
          <div className="mt-3">
            <ResultNotice result={slugAction.result} />
          </div>
          {subdomain && (
            <a
              href={`https://${subdomain.domain}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold hover:underline"
            >
              {subdomain.domain} <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
        </CardBody>
      </Card>

      {/* ---- Custom domains ---- */}
      <Card>
        <CardHeader>
          <CardTitle>Dominio propio</CardTitle>
        </CardHeader>
        <CardBody>
          {planAllowsCustom ? (
            <>
              <p className="mb-4 text-sm leading-relaxed text-stone-500">
                Conecta el dominio de tu barbería (p. ej.{" "}
                <span className="font-mono text-xs text-ink">mibarberia.com</span>). El
                certificado SSL se emite y renueva automáticamente — tú solo apuntas el
                DNS una vez.
              </p>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  domainAction.run(async () => {
                    const r = await addDomain(newDomain);
                    if (r.ok) setNewDomain("");
                    return r;
                  });
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <Input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value.toLowerCase())}
                  placeholder="mibarberia.com"
                  aria-label="Dominio propio"
                  className="min-w-0 flex-1 font-mono text-sm"
                  required
                />
                <Button type="submit" size="md" disabled={domainAction.pending}>
                  {domainAction.pending ? "Agregando…" : "Conectar dominio"}
                </Button>
              </form>
              <div className="mt-3">
                <ResultNotice result={domainAction.result} />
              </div>

              {customs.length > 0 && (
                <ul className="mt-5 space-y-4">
                  {customs.map((d) => (
                    <DomainRow key={d.id} domain={d} rootDomain={rootDomain} />
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
              <p className="text-sm leading-relaxed text-stone-500">
                El dominio propio está disponible desde el plan <b>Pro</b>. Tu página
                sigue funcionando perfecto en tu subdominio Navaja.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* ---- How it works ---- */}
      <Card>
        <CardHeader>
          <CardTitle>¿Cómo funciona?</CardTitle>
        </CardHeader>
        <CardBody>
          <ol className="space-y-3">
            {[
              ["Conecta tu dominio", "Escríbelo arriba tal como lo compraste, sin https ni www."],
              ["Apunta el DNS", "Crea los dos registros que te mostramos en el panel de tu proveedor (GoDaddy, Namecheap, Hostinger…)."],
              ["Listo — SSL automático", "Detectamos los registros, emitimos el certificado y tu dominio queda sirviendo tu página de reservas. Sin técnicos, sin tickets."],
            ].map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-stone-900 text-xs font-bold text-gold-400">
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{title}</p>
                  <p className="text-sm leading-relaxed text-stone-500">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DomainRow({ domain, rootDomain }: { domain: ShopDomain; rootDomain: string }) {
  const action = useSettingsAction();
  const needsDns = domain.status === "pendiente_dns" || domain.status === "error";

  return (
    <li className="rounded-2xl border border-stone-200 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Globe className="h-4 w-4 text-stone-400" />
        <span className="font-mono text-sm font-semibold text-ink">{domain.domain}</span>
        <StatusChip status={domain.status} />
        {domain.isPrimary && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/12 px-2.5 py-1 text-xs font-semibold text-gold">
            <Star className="h-3 w-3 fill-gold" /> Principal
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          {domain.status !== "activo" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => action.run(() => verifyDomain(domain.id))}
              disabled={action.pending}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", action.pending && "animate-spin")} />
              {domain.status === "verificando" ? "Comprobar" : "Verificar"}
            </Button>
          )}
          {domain.status === "activo" && !domain.isPrimary && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => action.run(() => setPrimaryDomain(domain.id))}
              disabled={action.pending}
            >
              <BadgeCheck className="h-3.5 w-3.5" /> Hacer principal
            </Button>
          )}
          <button
            type="button"
            aria-label={`Eliminar ${domain.domain}`}
            onClick={() => action.run(() => removeDomain(domain.id))}
            disabled={action.pending}
            className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 text-stone-400 transition-colors hover:border-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {domain.status === "error" && domain.errorDetail && (
        <p className="mt-2 text-sm text-destructive">{domain.errorDetail}</p>
      )}

      {needsDns && (
        <div className="mt-3">
          <p className="text-sm text-stone-500">
            Crea estos registros en tu proveedor de dominio y luego pulsa{" "}
            <b>Verificar</b> (la propagación puede tardar hasta 24 h, normalmente
            minutos):
          </p>
          <DnsInstructions rootDomain={rootDomain} />
        </div>
      )}

      <div className="mt-3">
        <ResultNotice result={action.result} />
      </div>
    </li>
  );
}
