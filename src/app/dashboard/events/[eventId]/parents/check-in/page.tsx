import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { hasParents } from "@/lib/event-types";
import { formatPhone } from "@/lib/phone";
import type { Child, OtherAdult } from "@/lib/parents";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, utcToZonedDate } from "@/lib/time";
import { setParentCheckedIn } from "../actions";
import { Door, type DoorParent } from "../door";

export const metadata: Metadata = { title: "Parent check-in" };

/**
 * School visitor events: the door. Each adult is checked in on their own,
 * after their photo ID. Its own page, like volunteer check-in, so it's all
 * there is on the phone or tablet at the door. Hosts and the event's team.
 */
export default async function ParentCheckInPage({ params }: PageProps<"/dashboard/events/[eventId]/parents/check-in">) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [{ data: event }, { data: allowed }] = await Promise.all([
    supabase.from("events").select("id, name, event_type, timezone, starts_on, ends_on, parent_walk_ins_allowed").eq("id", eventId).maybeSingle(),
    supabase.rpc("can_check_in_parents", { ev: eventId }),
  ]);
  if (!event) missing();
  if (!hasParents(event.event_type) || !allowed) redirect(`/dashboard/events/${eventId}`);

  const { data } = await supabase
    .from("parent_registrations")
    .select("id, parent_name, email, phone, children, other_adults, checked_in_at")
    .eq("event_id", eventId)
    .order("parent_name");
  const parents: DoorParent[] = (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    phone: r.phone,
    phoneDisplay: r.phone ? formatPhone(r.phone) : null,
    children: (r.children ?? []) as Child[],
    // The registering parent first, then everyone they named, each checked in on their own.
    adults: [
      { index: 0, name: r.parent_name, checkedIn: Boolean(r.checked_in_at) },
      ...((r.other_adults ?? []) as OtherAdult[]).map((a, i) => ({ index: i + 1, name: a.name, checkedIn: Boolean(a.checked_in_at) })),
    ],
  }));
  const childCount = parents.reduce((n, p) => n + p.children.length, 0);
  const adultCount = parents.reduce((n, p) => n + p.adults.length, 0);

  const today = utcToZonedDate(new Date().toISOString(), event.timezone);
  const over = today > event.ends_on;
  const isEventDay = today >= event.starts_on && !over;
  // Check-in buttons from the day before (a practice run) through the event, not weeks ahead.
  const checkInOpen = today >= addDays(event.starts_on, -1) && !over;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Parent check-in</h1>
      {isEventDay && <AutoRefresh seconds={10} status className="mt-1" />}
      <p className="mt-2 text-sm text-muted">
        {parents.length} {parents.length === 1 ? "family" : "families"} · {adultCount} {adultCount === 1 ? "adult" : "adults"} · {childCount}{" "}
        {childCount === 1 ? "child" : "children"}
      </p>
      <p className="mt-4 mb-4 leading-7 text-muted">
        Check each adult&apos;s <strong className="text-foreground">photo ID</strong> matches their name, then tap{" "}
        <strong className="text-foreground">Check in</strong>.{" "}
        {event.parent_walk_ins_allowed
          ? "Not on the list? Walk-ins are allowed: send them through the school's visitor process."
          : "Not on the list? Send them through the school's visitor process."}
      </p>
      <Door parents={parents} open={checkInOpen} opensOn={formatDate(addDays(event.starts_on, -1))} toggle={setParentCheckedIn.bind(null, eventId)} />
    </div>
  );
}

function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
