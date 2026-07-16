import { getDomains, getPlan, getShop } from "@/lib/data/queries";
import { ROOT_DOMAIN } from "@/lib/tenant";
import { DomainsPanel } from "@/components/settings/DomainsPanel";

export default async function DominioPage() {
  const [domains, shop, plan] = await Promise.all([
    getDomains(),
    getShop(),
    getPlan(),
  ]);
  return (
    <DomainsPanel
      domains={domains}
      slug={shop.slug}
      rootDomain={ROOT_DOMAIN}
      planAllowsCustom={plan.customDomain}
    />
  );
}
