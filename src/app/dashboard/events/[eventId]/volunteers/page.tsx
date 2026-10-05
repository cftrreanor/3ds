import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getEventAccess } from "@/lib/data";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";
import { setCheckedIn } from "./actions";
import { CheckInList, type RosterRow } from "./check-in-list";

export const metadata: Metadata = { title: "Volunteers & check-in" };

type Row = {
  id: string;
  checked_in_at: string | null;
  volunteers: { full_name: string; email: string; phone: string } | null;
  shifts: { id: string; title: string; starts_at: string; ends_at: string; stations: { name: string } | null } | null;
};

export default async function VolunteersPage({ params }: PageProps<"/dashboard/events/[eventId]/volunteers">) {
  const { eventId } = await params;
  const access = await getEventAccess(eventId);
  if (!access.canManage) redirect(`/dashboard/events/${eventId}`);

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, name, timezone, starts_on, ends_on")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();

  const { data } = await supabase
    .from("volunteer_assignments")
    .select(
      "id, checked_in_at, volunteers(full_name, email, phone), shifts!inner(id, title, starts_at, ends_at, event_id, stations(name))",
    )
    .eq("shifts.event_id", eventId);

  const tz = event.timezone;
  const multiDay = event.starts_on !== event.ends_on;
  const rows: RosterRow[] = ((data ?? []) as unknown as Row[])
    .filter((r) => r.volunteers && r.shifts)
    .map((r) => ({
      assignmentId: r.id,
      name: r.volunteers!.full_name,
      email: r.volunteers!.email,
      phone: r.volunteers!.phone,
      phoneDisplay: formatPhone(r.volunteers!.phone),
      station: r.shifts!.stations?.name ?? "Station",
      shiftId: r.shifts!.id,
      shiftLabel: `${multiDay ? `${formatDate(utcToZonedDate(r.shifts!.starts_at, tz), { year: undefined })} · ` : ""}${formatTimeRange(r.shifts!.starts_at, r.shifts!.ends_at, tz)}`,
      startsAt: r.shifts!.starts_at,
      checkedIn: Boolean(r.checked_in_at),
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.station.localeCompare(b.station) || a.name.localeCompare(b.name));

  return (
    <div>
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Volunteers &amp; check-in</h1>
      <p className="mt-1 mb-6 text-muted">
        Tap <strong className="text-foreground">Check in</strong> as people arrive at the volunteer desk. Their
        section lead sees it on their station page.
      </p>
      <CheckInList rows={rows} toggle={setCheckedIn.bind(null, eventId)} />
    </div>
  );
}
