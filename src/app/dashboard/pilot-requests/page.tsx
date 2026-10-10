import { redirect } from "next/navigation";

/** Pilot requests moved into the admin dashboard. */
export default function OldPilotRequestsPage() {
  redirect("/admin/pipeline");
}
