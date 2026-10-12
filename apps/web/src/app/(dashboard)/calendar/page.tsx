import { redirect } from "next/navigation";

// The calendar view lives inside the Appointments page.
export default function CalendarPage() {
  redirect("/appointments");
}
