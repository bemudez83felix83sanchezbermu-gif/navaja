import { BARBERS, appointmentsInRange, startOfDay } from "@/lib/data/mock";
import { PLANS, getInvoices, getSubscription } from "@/lib/data/store";
import { PlanPanel } from "@/components/settings/PlanPanel";

export default function PlanPage() {
  const now = new Date();
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const appointmentsThisMonth = appointmentsInRange(monthStart, nextMonth).filter(
    (a) => a.status !== "cancelada",
  ).length;

  return (
    <PlanPanel
      plans={PLANS}
      subscription={{ ...getSubscription() }}
      usage={{
        barbers: BARBERS.filter((b) => b.active).length,
        appointmentsThisMonth,
      }}
      invoices={getInvoices().map((i) => ({ ...i }))}
    />
  );
}
