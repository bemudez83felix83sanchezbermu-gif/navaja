import { getBookingRules } from "@/lib/data/store";
import { BookingRulesForm } from "@/components/settings/BookingRulesForm";

export default function ReservasPage() {
  return <BookingRulesForm rules={{ ...getBookingRules() }} />;
}
