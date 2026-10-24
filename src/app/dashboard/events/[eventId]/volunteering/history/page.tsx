import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getEventAccess } from "@/lib/data";
import { isSchemaError, missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { removeFromVolunteerHistory } from "@/app/dashboard/volunteer-history-actions";
import { HistoryTable, type HistoryRow } from "./history-table";

export const metadata: Metadata = { title: "Volunteer history" };

/**
 * Every adult who has volunteered at the account's events: shifts signed up,
 * shifts checked in, and the share they showed up for. For hosts and
 * Volunteer Leads (supabase/migrations/20261221000000_volunteer_history.sql).
 */
export default async function VolunteerHistoryPage({ params }: PageProps<"/dashboard/events/[eventId]/volunteering/history">) {
  const { eventId } = await params;
  const access = await getEventAccess(eventId);
  if (!access.canManage) redirect(`/dashboard/events/${eventId}`);
  const supabase = await createClient();
  const { data: event } = await supabase.from("events").select("id, name, organization_id").eq("id", eventId).maybeSingle();
  if (!event) missing();
  const { data, error } = await supabase.rpc("volunteer_report", { p_org: event.organization_id });
  if (error && isSchemaError(error)) missing();
  if (error) console.error("volunteer_report failed", error);
  const rows = ((data ?? []) as HistoryRow[]).map((r) => ({ ...r, email: r.email.toLowerCase() }));

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/dashboard/events/${eventId}/volunteering`} className="text-sm text-muted hover:text-foreground">
        ← Back to Volunteer Setup
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Volunteer history</h1>
      <p className="mt-2 max-w-3xl leading-7 text-muted">
        Everyone who has volunteered at your account&apos;s events, with the shifts they signed up for and checked in to.
        Use it to put your most dependable volunteers first, like for chaperone spots. Shifts count once they&apos;re over.
      </p>
      {error ? (
        <p className="mt-6 text-danger">We couldn&apos;t load your volunteer history. Please try again.</p>
      ) : (
        <div className="mt-6">
          <HistoryTable rows={rows} remove={access.isHost ? removeFromVolunteerHistory.bind(null, eventId) : undefined} />
        </div>
      )}
      <p className="mt-8 max-w-3xl text-sm text-muted">
        🔒 Only your Hosts, Co-hosts, and Volunteer Leads see this. Names, emails, and shift counts are kept for 2 years after
        someone&apos;s last event; phone numbers are deleted 10 days after each event, and under-18 helpers aren&apos;t included.
        {access.isHost ? " If someone asks to be forgotten, use Remove next to their name." : ""}
      </p>
    </div>
  );
}
