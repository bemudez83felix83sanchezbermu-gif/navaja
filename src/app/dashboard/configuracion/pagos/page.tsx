import { getPaymentAccount, getPaymentSettings, getPlan } from "@/lib/data/queries";
import { PagosPanel } from "@/components/settings/PagosPanel";

export default async function PagosPage() {
  const [settings, account, plan] = await Promise.all([
    getPaymentSettings(),
    getPaymentAccount(),
    getPlan(),
  ]);
  return (
    <PagosPanel
      settings={settings}
      account={account}
      planAllowsPayments={plan.payments}
    />
  );
}
