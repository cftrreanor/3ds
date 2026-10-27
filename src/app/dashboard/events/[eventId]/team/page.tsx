import { redirect } from "next/navigation";
import { getEventAccess } from "@/lib/data";

/**
 * The team now lives where it's set up: co-hosts and Volunteer Leads in Edit
 * details → Team setup, and Section Leads in Volunteer Setup. Old links land
 * in the right place.
 */
export default async function TeamPage({ params, searchParams }: PageProps<"/dashboard/events/[eventId]/team">) {
  const { eventId } = await params;
  const { tab } = await searchParams;
  const access = await getEventAccess(eventId);
  if (!access.canManage) redirect(`/dashboard/events/${eventId}`);
  if (tab === "section-leads" || !access.isHost) redirect(`/dashboard/events/${eventId}/volunteering#section-leads`);
  redirect(`/dashboard/events/${eventId}/edit?section=team${typeof tab === "string" ? `&tab=${encodeURIComponent(tab)}` : ""}`);
}
