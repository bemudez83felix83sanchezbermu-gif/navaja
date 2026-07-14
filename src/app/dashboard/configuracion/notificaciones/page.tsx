import { getNotifications } from "@/lib/data/store";
import { NotificationsForm } from "@/components/settings/NotificationsForm";

export default function NotificacionesPage() {
  return <NotificationsForm settings={{ ...getNotifications() }} />;
}
