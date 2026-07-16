import { getNotifications, getRecentNotifications } from "@/lib/data/queries";
import { NotificationsForm } from "@/components/settings/NotificationsForm";

export default async function NotificacionesPage() {
  const [settings, recent] = await Promise.all([
    getNotifications(),
    getRecentNotifications(),
  ]);
  return <NotificationsForm settings={settings} recent={recent} />;
}
