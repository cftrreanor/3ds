import { redirect } from "next/navigation";
import { getEventAccess } from "@/lib/data";

/**
 * The team now lives in Edit details → Team setup (hosts only); Volunteer
 * Leads add Coordinators from each sign-up in Volunteer Setup. Old links land
 * in the right place.
 */
export default async function TeamPage({ params, searchParams }: PageProps<"/dashboard/events/[eventId]/team">) {
  const { eventId } = await params;
  const { tab } = await searchParams;
  const access = await getEventAccess(eventId);
  if (!access.canManage) redirect(`/dashboard/events/${eventId}`);
  if (!access.isHost) redirect(`/dashboard/events/${eventId}/volunteering`);
  redirect(`/dashboard/events/${eventId}/edit?section=team${typeof tab === "string" ? `&tab=${encodeURIComponent(tab)}` : ""}`);
}
