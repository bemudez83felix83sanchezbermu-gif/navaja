import { getShop } from "@/lib/data/store";
import { ProfileForm } from "@/components/settings/ProfileForm";

export default function NegocioPage() {
  return <ProfileForm shop={{ ...getShop() }} />;
}
