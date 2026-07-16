import { getBookingRules } from "@/lib/data/queries";
import { BookingRulesForm } from "@/components/settings/BookingRulesForm";

export default async function ReservasPage() {
  return <BookingRulesForm rules={await getBookingRules()} />;
}
