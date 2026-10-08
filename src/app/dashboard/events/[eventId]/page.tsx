import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getEventAccess } from "@/lib/data";
import { missing } from "@/lib/schema-check";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  eachDate,
  formatDate,
  formatDateRange,
  formatTime,
  formatTimeRange,
  utcToZonedDate,
  zoneName,
} from "@/lib/time";
import { AutoRefresh } from "@/app/e/[slug]/auto-refresh";
import { eventPhase, nextUp, onTrack, sortStations, stationTiles, type BandDay, type Checkpoint, type Stop } from "@/lib/contest-day";
import { AttentionList, DayTiles, StatusLine } from "./contest-day/on-track";
import { setEventPublished } from "../../actions";
import { ActionButton } from "./forms";
import { type Shift } from "./station-panel";
import { DemoStart } from "@/components/demo-switcher";
import { FileLinks } from "@/components/file-links";
import { PERSONAS } from "@/lib/demo";
import { filesFor, uploadedLines, type EventFile } from "@/lib/event-files";

export const metadata: Metadata = { title: "Event setup" };

type Person = { full_name: string; email: string; phone: string | null } | null;
type StaffRow = { user_id: string; role: "volunteer_director" | "section_lead"; created_at: string; profiles: Person };
type HostRow = { user_id: string; role: "owner" | "admin"; created_at: string; profiles: Person };
type Invitation = {
  id: string;
  email: string;
  role: "volunteer_director" | "section_lead" | null;
  as_host: boolean;
  station_id: string | null;
  token: string;
  expires_at: string;
};

const ROLE_LABEL = { volunteer_director: "Volunteer Lead", section_lead: "Section Lead" } as const;

export default async function EventPage({ params }: PageProps<"/dashboard/events/[eventId]">) {
  const { eventId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, organization_id, slug, name, status, ready_minutes_before, volunteer_signup_open, timezone, starts_on, ends_on, window_start, window_end, venue_name, venue_address, venue_place_id",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();

  const access = await getEventAccess(eventId);
  const [
    { data: stationData },
    { data: shifts },
    { data: staff },
    { data: invitations },
    { data: bandData },
    { data: leadRows },
    { data: hostData },
    { data: stopData },
    { data: slotData },
  ] = await Promise.all([
    supabase
      .from("stations")
      .select("id, name, checkpoint_kind, checkpoint_order, due_minutes_before_warm_up, location, instructions, lead_user_id")
      .eq("event_id", eventId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("shifts")
      .select("id, station_id, title, description, starts_at, ends_at, max_capacity, registered_count")
      .eq("event_id", eventId)
      .order("starts_at"),
    supabase.from("event_staff").select("user_id, role, created_at, profiles(full_name, email, phone)").eq("event_id", eventId),
    access.canManage
      ? supabase
          .from("invitations")
          .select("id, email, role, as_host, station_id, token, expires_at")
          .eq("event_id", eventId)
          .is("accepted_at", null)
          .order("created_at")
      : Promise.resolve({ data: [] as Invitation[] }),
    // No contact details: headcounts for hosts and Volunteer Leads, names and status for everyone on the team.
    supabase.rpc("event_bands", { ev: eventId }),
    supabase.from("station_leads").select("station_id, user_id").eq("event_id", eventId).order("created_at"),
    // Only hosts can read the organization's members.
    access.isHost
      ? supabase
          .from("organization_members")
          .select("user_id, role, created_at, profiles(full_name, email, phone)")
          .eq("organization_id", event.organization_id)
          .order("created_at")
      : Promise.resolve({ data: [] }),
    supabase.from("band_stops").select("band_id, station_id, round, performed, reached_at").eq("event_id", eventId),
    supabase.from("performance_slots").select("band_id, performance_order, warm_up_at, perform_at").eq("event_id", eventId).order("performance_order"),
  ]);
  // Each station with everyone leading it (first-added first).
  const stations = sortStations(stationData ?? []).map((st) => ({
    ...st,
    lead_ids: (leadRows ?? []).filter((l) => l.station_id === st.id).map((l) => l.user_id),
  }));
  const bands = (bandData ?? []) as BandTotals[];
  const dayBands = (bandData ?? []) as (BandDay & { school_name: string; band_name: string | null })[];
  // Contest day: are bands parked and at warm-up on time? (Hosts and Volunteer Leads.)
  const path = stations.filter((s): s is typeof s & Checkpoint => !!s.checkpoint_kind);
  const slots = new Map((slotData ?? []).map((s) => [s.band_id, s]));
  const now = new Date();
  const phase = eventPhase(event, now);
  const stops = (stopData ?? []) as Stop[];
  const status = onTrack(dayBands, stops, path, (id) => slots.get(id), event.ready_minutes_before, now, phase);
  const tiles = stationTiles(dayBands, stops, path, (id) => slots.get(id), event.ready_minutes_before, now, phase);
  const upNext =
    phase === "day"
      ? nextUp(
          (slotData ?? []).flatMap((s) => {
            const band = dayBands.find((b) => b.id === s.band_id);
            return band ? [{ band, perform_at: s.perform_at, order: s.performance_order }] : [];
          }),
          stops,
        )
      : null;
  const gate = path.find((c) => c.checkpoint_kind === "gate");

  const tz = event.timezone;
  // Maps & documents: hosts see every file (hidden ones too); the team, the ones shared with them.
  const files: EventFile[] = access.isHost
    ? (((await supabase.from("event_files").select("id, event_id, label, path, file_name, content_type, size_bytes, audiences, visible_from, uploaded_by, uploaded_at").eq("event_id", eventId).order("created_at")).data ?? []) as EventFile[])
    : await filesFor([eventId], ["public", "team"], () => tz);
  const uploaded = access.isHost ? await uploadedLines(files, tz) : undefined;
  // Demo mode, for FieldCommand admins (src/lib/demo.ts).
  const demo = (await supabase.rpc("is_platform_admin")).data
    ? {
        active: Boolean(
          (await createAdminClient().from("demo_events").select("event_id").eq("owner_id", user.id).eq("event_id", eventId).maybeSingle())
            .data,
        ),
      }
    : null;
  const days = eachDate(event.starts_on, event.ends_on);
  const multiDay = days.length > 1;
  const windowLabel = formatTimeRange(event.window_start, event.window_end, tz);

  const signedUp = (shifts ?? []).reduce((n, s) => n + s.registered_count, 0);

  // Section Leads: their stations (volunteers by shift) are on the Contest day page.
  const myStations = stations.filter((s) => s.lead_ids.includes(user.id));
  const myVolunteers = (shifts ?? [])
    .filter((sh) => myStations.some((st) => st.id === sh.station_id))
    .reduce((n, sh) => n + sh.registered_count, 0);

  const shiftsByStation = new Map<string, Shift[]>();
  for (const s of (shifts ?? []) as Shift[]) {
    shiftsByStation.set(s.station_id, [...(shiftsByStation.get(s.station_id) ?? []), s]);
  }
  const totalSlots = (shifts ?? []).reduce((n, s) => n + s.max_capacity, 0);
  const staffRows = (staff ?? []) as unknown as StaffRow[];
  const hosts = ((hostData ?? []) as unknown as HostRow[]).sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));
  const directors = staffRows.filter((s) => s.role === "volunteer_director");
  const leads = staffRows.filter((s) => s.role === "section_lead");
  const stationName = (id: string | null) => stations.find((s) => s.id === id)?.name;

  // Team card: what needs doing, then who joined this past week.
  const openInvites = (invitations ?? []) as Invitation[];
  const expiredInvites = openInvites.filter((inv) => new Date(inv.expires_at) < new Date());
  const unled = stations.filter((s) => s.lead_ids.length === 0);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const joined = [
    ...hosts.filter((h) => h.role === "admin").map((h) => ({ ...h, label: "co-host" })),
    ...staffRows.map((s) => ({ ...s, label: ROLE_LABEL[s.role] })),
  ]
    .filter((j) => new Date(j.created_at) >= weekAgo && j.user_id !== user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);
  const teamUpdates: TeamUpdate[] = [
    ...(unled.length
      ? [
          {
            tone: "warn" as const,
            text: `${unled.length === 1 ? "1 station needs" : `${unled.length} stations need`} a Section Lead: ${unled.map((s) => s.name).join(", ")}`,
            tab: "section-leads",
          },
        ]
      : []),
    ...(expiredInvites.length
      ? [
          {
            tone: "warn" as const,
            text: `${expiredInvites.length === 1 ? "1 invitation has" : `${expiredInvites.length} invitations have`} expired. Resend them from the Team page.`,
            tab: expiredInvites[0].as_host ? "hosts" : expiredInvites[0].role === "volunteer_director" ? "volunteer-leads" : "section-leads",
          },
        ]
      : []),
    ...joined.map((j) => ({
      tone: "good" as const,
      text: `${j.profiles?.full_name || j.profiles?.email || "Someone"} joined as ${j.label === "co-host" ? "a co-host" : `a ${j.label}`} · ${formatDate(utcToZonedDate(j.created_at, tz), { year: undefined })}`,
      tab: null,
    })),
  ];
  const today = utcToZonedDate(new Date().toISOString(), tz);
  const isEventDay = today >= event.starts_on && today <= event.ends_on;
  const [{ count: volunteerCount }, { data: checkins }] = access.canManage
    ? await Promise.all([
        supabase.from("volunteers").select("id", { count: "exact", head: true }).eq("event_id", eventId),
        isEventDay
          ? supabase.from("volunteer_assignments").select("checked_in_at, shifts!inner(event_id)").eq("shifts.event_id", eventId)
          : Promise.resolve({ data: [] }),
      ])
    : [{ count: 0 }, { data: [] }];
  const checkedIn = { done: (checkins ?? []).filter((c) => c.checked_in_at).length, of: (checkins ?? []).length };
  // The emptiest shifts first: where to send the next volunteers.
  const needsPeople = ((shifts ?? []) as Shift[])
    .filter((s) => s.registered_count < s.max_capacity)
    .sort((a, b) => a.registered_count / a.max_capacity - b.registered_count / b.max_capacity || a.starts_at.localeCompare(b.starts_at))
    .slice(0, 3)
    .map((s) => ({
      id: s.id,
      label: `${stationName(s.station_id) ?? "Station"} · ${s.title}`,
      when: `${multiDay ? `${formatDate(utcToZonedDate(s.starts_at, tz), { year: undefined })} · ` : ""}${formatTimeRange(s.starts_at, s.ends_at, tz)}`,
      filled: s.registered_count,
      capacity: s.max_capacity,
    }));

  return (
    <div>
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← All events
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{event.name}</h1>
          <p className="mt-1 text-muted">
            {formatDateRange(event.starts_on, event.ends_on)} · {windowLabel}
          </p>
          <p className="mt-1 text-sm text-muted">All times are {zoneName(tz)}.</p>
          <p className="mt-1 text-sm text-muted">
            {[event.venue_name, event.venue_address].filter(Boolean).join(" · ")}
            {" · "}
            <a
              href={mapsUrl(event.venue_address, event.venue_place_id)}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Map
            </a>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Badge tone={event.status === "published" ? "brand" : "neutral"}>
              {event.status === "published" ? "Published" : "Draft: only your team can see this"}
            </Badge>
            {access.isHost &&
              (event.status !== "published" ? (
                <ActionButton action={setEventPublished.bind(null, eventId, true)} variant="go" pendingText="Publishing…">
                  Publish event
                </ActionButton>
              ) : (
                <ActionButton
                  action={setEventPublished.bind(null, eventId, false)}
                  variant="stop"
                  confirmMessage="Unpublish? The public pages will be hidden and signup will close."
                >
                  Unpublish event
                </ActionButton>
              ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {access.isHost && (
            <Link
              href={`/dashboard/events/${eventId}/edit`}
              className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-background"
            >
              Edit details
            </Link>
          )}
        </div>
      </div>

      {(access.canManage || myStations.length > 0) && (
        <section className="mt-10" aria-labelledby="day-heading">
          <h2 id="day-heading" className="text-xl font-semibold">
            Contest day
          </h2>
          <Card className="mt-4 space-y-4">
            {access.canManage && bands.length > 0 ? (
              <>
                {isEventDay && <AutoRefresh seconds={30} />}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StatusLine
                    status={status}
                    hasPath={path.length > 0}
                    dayLabel={formatDate(event.starts_on, { year: undefined })}
                    time={(iso) => formatTime(iso, tz)}
                  />
                  <Link
                    href={`/dashboard/events/${eventId}/contest-day`}
                    className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
                  >
                    Open contest day
                  </Link>
                </div>
                {phase !== "before" && path.length > 0 && (
                  <DayTiles
                    tiles={tiles}
                    next={
                      upNext && {
                        order: upNext.order,
                        school: upNext.band.school_name,
                        band: upNext.band.band_name,
                        perform_at: upNext.perform_at,
                        atGate: !!gate && stops.some((x) => x.band_id === upNext.band.id && x.station_id === gate.id && x.round === "prelims"),
                      }
                    }
                    eventId={eventId}
                    time={(iso) => formatTime(iso, tz)}
                  />
                )}
                <AttentionList status={status} eventId={eventId} limit={3} />
                {access.isHost && status.late.length > 0 && (
                  <Link
                    href={`/dashboard/events/${eventId}/contest-day?station=overview`}
                    className="inline-flex text-sm font-medium text-brand underline-offset-4 hover:underline"
                  >
                    Running behind? Push the schedule back
                  </Link>
                )}
              </>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 text-sm leading-6">
                  <p>
                    <span className="font-medium">You lead {myStations.map((s) => s.name).join(", ")}.</span>{" "}
                    <span className="text-muted">
                      {myVolunteers} {myVolunteers === 1 ? "volunteer" : "volunteers"} signed up.
                    </span>
                  </p>
                  {myStations.some((s) => s.checkpoint_kind) && (
                    <p className="text-muted">
                      {!bands.length
                        ? "No bands registered yet."
                        : phase === "day"
                          ? `${status.parked} of ${status.expected} bands parked · ${tiles.find((t) => t.label === "Performed")?.done ?? 0} of ${status.expected} performed.`
                          : `${bands.length} band${bands.length === 1 ? "" : "s"} registered.`}
                </p>
                  )}
                </div>
                <Link
                  href={`/dashboard/events/${eventId}/contest-day`}
                  className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
                >
                  Open contest day
                </Link>
              </div>
            )}
          </Card>
        </section>
      )}

      {access.canManage && (
        <section className="mt-10" aria-labelledby="team-heading">
          <h2 id="team-heading" className="text-xl font-semibold">
            Team
          </h2>
          <Card className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm leading-6 text-muted">Hosts, Volunteer Leads and Section Leads, and their invitations.</p>
              <Link
                href={`/dashboard/events/${eventId}/team`}
                className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
              >
                Manage team
              </Link>
            </div>
            <TeamStats
              eventId={eventId}
              counts={[
                ...(access.isHost ? [{ label: "Hosts", value: hosts.length, tab: "hosts" }] : []),
                { label: "Volunteer Leads", value: directors.length, tab: "volunteer-leads" },
                { label: "Section Leads", value: leads.length, tab: "section-leads" },
                { label: "Waiting to accept", value: openInvites.length, tab: null },
              ]}
              updates={teamUpdates}
            />
          </Card>
        </section>
      )}

      {(files.length > 0 || access.isHost) && (
        <section className="mt-10" aria-labelledby="files-heading">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="files-heading" className="text-xl font-semibold">
              Maps &amp; documents
            </h2>
            {access.isHost && (
              <Link href={`/dashboard/events/${eventId}/edit#files-heading`} className="text-sm font-medium text-brand underline-offset-4 hover:underline">
                {files.length ? "Manage" : "Add a map or document"}
              </Link>
            )}
          </div>
          {files.length ? (
            <FileLinks files={files} details={uploaded} className="mt-3" />
          ) : (
            <p className="mt-1 text-sm text-muted">
              Share a stadium map, parking map or director packet with the public, band directors, volunteers or your team.
            </p>
          )}
        </section>
      )}

      <section className="mt-10" aria-labelledby="bands-heading">
        <h2 id="bands-heading" className="text-xl font-semibold">
          {access.isHost ? "Band registration" : "Bands"}
        </h2>
        <Card className="mt-4 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm leading-6 text-muted">
              {bands.length
                ? `${bands.length} band${bands.length === 1 ? "" : "s"} registered.`
                : "No bands registered yet."}{" "}
              {access.isHost
                ? "Registration, the performance schedule and finals."
                : "See the performance order and each band's status on the day."}
            </p>
            <Link
              href={`/dashboard/events/${eventId}/${access.isHost ? "bands" : "schedule"}`}
              className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
            >
              {access.isHost ? "Manage bands" : "Band schedule"}
            </Link>
          </div>
          {access.canManage && bands.length > 0 && <LogisticsTotals bands={bands} />}
        </Card>
      </section>

      {access.canManage && (
        <section className="mt-10" aria-labelledby="volunteers-heading">
          <h2 id="volunteers-heading" className="text-xl font-semibold">
            Volunteer registration
          </h2>
          <Card className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={event.status === "published" && event.volunteer_signup_open ? "brand" : "neutral"}>
                  {event.status !== "published" ? "Event not published" : event.volunteer_signup_open ? "Signup open" : "Signup closed"}
                </Badge>
                <span className="text-sm text-muted">
                  {stations.length} station{stations.length === 1 ? "" : "s"} · {(shifts ?? []).length} shift
                  {(shifts ?? []).length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/events/${eventId}/volunteers`}
                  className="inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium hover:bg-background"
                >
                  Check-in
                </Link>
                <Link
                  href={`/dashboard/events/${eventId}/volunteering`}
                  className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
                >
                  Manage volunteers
                </Link>
              </div>
            </div>
            <VolunteerStats
              filled={signedUp}
              capacity={totalSlots}
              volunteers={volunteerCount ?? 0}
              checkedIn={isEventDay ? checkedIn : null}
              needs={needsPeople}
            />
          </Card>
        </section>
      )}

      {demo && (
        <section className="mt-10" aria-labelledby="demo-heading">
          <h2 id="demo-heading" className="text-xl font-semibold">
            Demo this event
          </h2>
          <Card className="mt-4 space-y-3">
            <p className="text-sm leading-6 text-muted">
              See this event the way each person does, without switching emails. Tap a role and this browser signs in as
              a demo person in that role: a co-host, a Volunteer Lead, a Section Lead (of the first stations), the
              director of &ldquo;Demo High School&rdquo;, a volunteer with a shift, or a parent looking at the public page.
              A bar at the top switches roles; <strong className="text-foreground">Back to me</strong> emails you a
              sign-in link to get back to your own account.
            </p>
            <p className="text-sm leading-6 text-muted">
              Use a practice event: the demo people really are on this event (in its lists and counts), and as Host
              you can do anything a host can, including emailing its bands and volunteers. Demo people never get
              emails.
            </p>
            <DemoStart eventId={eventId} personas={PERSONAS} active={demo.active} />
          </Card>
        </section>
      )}
    </div>
  );
}

type TeamUpdate = { tone: "warn" | "good"; text: string; tab: string | null };

/** The Team card's numbers and what's new or needs attention. */
function TeamStats({
  eventId,
  counts,
  updates,
}: {
  eventId: string;
  counts: { label: string; value: number; tab: string | null }[];
  updates: TeamUpdate[];
}) {
  const href = (tab: string | null) => `/dashboard/events/${eventId}/team${tab ? `?tab=${tab}` : ""}`;
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counts.map((c) => (
          <Link key={c.label} href={href(c.tab)} className="rounded-lg bg-background px-3 py-2 hover:ring-1 hover:ring-border">
            <dt className="text-xs text-muted">{c.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{c.value}</dd>
          </Link>
        ))}
      </dl>
      <div>
        <h3 className="text-sm font-semibold">Updates</h3>
        {updates.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {updates.map((u) => (
              <li key={u.text} className="flex gap-2 text-sm leading-6">
                <span aria-hidden className={u.tone === "warn" ? "text-danger" : "text-success"}>
                  {u.tone === "warn" ? "●" : "✓"}
                </span>
                <Link href={href(u.tab)} className="hover:underline underline-offset-4">
                  {u.text}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">Nothing new. Every station has a lead and no invitations have expired.</p>
        )}
      </div>
    </div>
  );
}

function mapsUrl(address: string, placeId: string | null) {
  const params = new URLSearchParams({ api: "1", query: address });
  if (placeId) params.set("query_place_id", placeId);
  return `https://www.google.com/maps/search/?${params}`;
}

type BandTotals = {
  classification: string;
  student_count: number;
  chaperone_count: number;
  bus_count: number;
  box_truck_count: number;
  truck_trailer_count: number;
  semi_truck_count: number;
};

/** Headcounts and vehicles across every registered band, for parking and planning. */
function LogisticsTotals({ bands }: { bands: BandTotals[] }) {
  const total = (k: Exclude<keyof BandTotals, "classification">) => bands.reduce((n, b) => n + Number(b[k] ?? 0), 0);
  const byClass = bands.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.classification]: (acc[b.classification] ?? 0) + 1 }), {});
  return (
    <div className="border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Logistics totals</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(
          [
            ["Students", total("student_count")],
            ["Chaperones", total("chaperone_count")],
            ["Buses", total("bus_count")],
            ["Box trucks", total("box_truck_count")],
            ["Truck + trailers", total("truck_trailer_count")],
            ["Semi trucks", total("semi_truck_count")],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-background px-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm">
        <span className="text-muted">By classification: </span>
        {Object.entries(byClass)
          .sort()
          .map(([c, n]) => `${c}: ${n}`)
          .join(" · ")}
      </p>
    </div>
  );
}

/** The Volunteer registration card's numbers: how full the day is and where help is needed. */
function VolunteerStats({
  filled,
  capacity,
  volunteers,
  checkedIn,
  needs,
}: {
  filled: number;
  capacity: number;
  volunteers: number;
  /** Only on event day. */
  checkedIn: { done: number; of: number } | null;
  needs: { id: string; label: string; when: string; filled: number; capacity: number }[];
}) {
  const pct = capacity ? Math.round((filled / capacity) * 100) : 0;
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">
            {filled} of {capacity} spots filled
          </p>
          <p className="text-sm tabular-nums text-muted">{pct}%</p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${pct >= 100 ? "bg-success" : "bg-brand"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-background px-3 py-2">
          <dt className="text-xs text-muted">Volunteers signed up</dt>
          <dd className="text-xl font-semibold tabular-nums">{volunteers}</dd>
        </div>
        <div className="rounded-lg bg-background px-3 py-2">
          <dt className="text-xs text-muted">{checkedIn ? "Checked in today" : "Open spots"}</dt>
          <dd className="text-xl font-semibold tabular-nums">
            {checkedIn ? `${checkedIn.done} of ${checkedIn.of}` : Math.max(capacity - filled, 0)}
          </dd>
        </div>
      </dl>
      {needs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold">Needs people</h3>
          <ul className="mt-2 space-y-1.5">
            {needs.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{n.label}</span>
                  <span className="block text-muted">{n.when}</span>
                </span>
                <span className="shrink-0 tabular-nums text-muted">
                  {n.filled} / {n.capacity}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
