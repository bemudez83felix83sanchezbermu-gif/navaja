import {
  appointmentsInRange,
  getBarbers,
  getInvoices,
  getSubscription,
} from "@/lib/data/queries";
import { PLANS } from "@/lib/data/plans";
import { PlanPanel } from "@/components/settings/PlanPanel";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { checkout } = await searchParams;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [subscription, invoices, barbers, monthAppts] = await Promise.all([
    getSubscription(),
    getInvoices(),
    getBarbers(),
    appointmentsInRange(monthStart, nextMonth),
  ]);

  return (
    <PlanPanel
      plans={PLANS}
      subscription={subscription}
      usage={{
        barbers: barbers.length,
        appointmentsThisMonth: monthAppts.filter((a) => a.status !== "cancelada").length,
      }}
      invoices={invoices}
      checkoutNotice={
        checkout === "exito" || checkout === "cancelado" ? checkout : undefined
      }
    />
  );
}
