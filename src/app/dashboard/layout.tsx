import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getShop } from "@/lib/data/queries";
import { Sidebar } from "@/components/dashboard/Sidebar";

export const metadata: Metadata = {
  title: "Panel",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shop, cookieStore] = await Promise.all([getShop(), cookies()]);
  const theme =
    cookieStore.get("navaja-theme")?.value === "dark" ? "dark" : "light";
  return (
    <div className="flex min-h-dvh flex-col bg-cream lg:flex-row">
      <Sidebar
        shopName={shop.name}
        shopArea={shop.address.split(",")[1]?.trim() ?? shop.address}
        ownerName={shop.ownerName ?? "Propietario"}
        slug={shop.slug}
        initialTheme={theme}
      />
      {/* .theme-scope: aquí (y solo aquí) aplican los tokens de modo oscuro */}
      <main className="theme-scope min-w-0 flex-1 bg-cream">{children}</main>
    </div>
  );
}
