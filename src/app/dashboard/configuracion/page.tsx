import { getShop } from "@/lib/data/queries";
import { ProfileForm } from "@/components/settings/ProfileForm";

export default async function NegocioPage() {
  return <ProfileForm shop={await getShop()} />;
}
