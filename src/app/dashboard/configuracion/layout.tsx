import type { Metadata } from "next";
import { PageShell, PageHeader } from "@/components/dashboard/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";

export const metadata: Metadata = {
  title: "Configuración",
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <PageHeader
        title="Configuración"
        subtitle="Todo tu negocio, bajo tu control — sin depender de nadie."
      />
      <SettingsNav />
      <div className="max-w-3xl">{children}</div>
    </PageShell>
  );
}
