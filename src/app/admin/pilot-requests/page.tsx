import { redirect } from "next/navigation";

/** Pilot requests are now the admin CRM's pipeline; old links still work. */
export default function PilotRequestsPage() {
  redirect("/admin/pipeline");
}
