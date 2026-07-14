import { getMembers } from "@/lib/data/store";
import { TeamPanel } from "@/components/settings/TeamPanel";

export default function EquipoPage() {
  return <TeamPanel members={getMembers().map((m) => ({ ...m }))} />;
}
