import { getMembers } from "@/lib/data/queries";
import { TeamPanel } from "@/components/settings/TeamPanel";

export default async function EquipoPage() {
  return <TeamPanel members={await getMembers()} />;
}
