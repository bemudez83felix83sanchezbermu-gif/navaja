import { getDomains, getPlan, getShop } from "@/lib/data/store";
import { ROOT_DOMAIN } from "@/lib/tenant";
import { DomainsPanel } from "@/components/settings/DomainsPanel";

export default function DominioPage() {
  return (
    <DomainsPanel
      domains={getDomains().map((d) => ({ ...d }))}
      slug={getShop().slug}
      rootDomain={ROOT_DOMAIN}
      planAllowsCustom={getPlan().customDomain}
    />
  );
}
