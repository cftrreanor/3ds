import type { Metadata } from "next";
import Link from "next/link";
import { SuccessToast } from "@/components/toaster";
import { redirect } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getEventAccess, getOrigin } from "@/lib/data";
import QRCode from "qrcode";
import { CopyLink } from "@/components/copy-link";
import { RememberedPanel } from "@/components/remembered-panel";
import { missing } from "@/lib/schema-check";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  eachDate,
  formatDate,
  formatDateRange,
  formatTime,
  formatTimeRange,
  utcToZonedDate,
  utcToZonedTime,
  zoneName,
} from "@/lib/time";
import { AutoRefresh } from "@/app/e/[slug]/auto-refresh";
import { eventPhase, nextUp, onTrack, sortStations, stationTiles, type BandDay, type Checkpoint, type Stop } from "@/lib/contest-day";
import { AttentionList, DayTiles, StatusLine } from "./contest-day/on-track";
import { deleteEvent, setEventPublished } from "../../actions";
import { DeleteEventButton } from "./delete-event";
import { ActionButton } from "./forms";
import { type Shift } from "./station-panel";
import { DemoStart } from "@/components/demo-switcher";
import { EventBannerSlot } from "@/components/event-banner-slot";
import { BoothsCard } from "./booths/booths-card";
import { FileLinks } from "@/components/file-links";
import { PERSONAS } from "@/lib/demo";
import { eventTypeLabel, groupWords, hasBands, hasBooths, hasConferences, hasEnsembles, hasParents, hasRooms, leadWords } from "@/lib/event-types";
import { meetingStarts, meetingSummary, modeLabel, notReady, SETTINGS_COLUMNS, type ConferenceSettings } from "@/lib/conferences";
import { groupDay, groupDaySummary, type GroupCheckin, type GroupSlot } from "@/lib/group-day";
import { closesAtLabel, parentRegistrationClosed } from "@/lib/parents";
import { parentStats, type ParentStats } from "@/lib/parent-stats";
import { filesFor, uploadedLines, type EventFile } from "@/lib/event-files";
import { publishEffects, setupChecklist, type SetupFacts } from "@/lib/setup-checklist";
import { SetupGuide } from "@/components/setup-guide";

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

export default async function EventPage({ params, searchParams }: PageProps<"/dashboard/events/[eventId]">) {
  const { eventId } = await params;
  // Back from demo mode (demo-actions backToMe).
  const demoEnded = (await searchParams).demo === "ended";
  const user = await requireUser();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, organization_id, slug, name, status, event_type, ready_minutes_before, volunteer_signup_open, parent_registration_open, parent_registration_closes_at, timezone, starts_on, ends_on, window_start, window_end, venue_name, venue_address, venue_place_id, band_registration_open, performance_order_published, director_info, finals_published, finalists_revealed",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();
  const bandsHere = hasBands(event.event_type);
  // Band contests and group events both take registrations; groups move through rooms.
  const groupsHere = hasEnsembles(event.event_type);
  const roomsHere = hasRooms(event.event_type);
  const conferenceHere = hasConferences(event.event_type);
  const words = groupWords(event.event_type);

  const access = await getEventAccess(eventId);
  // Only the event's hosts and team: anyone else (even signed in) goes back to their own dashboard.
  if (!access.isHost && !(await supabase.rpc("is_event_staff", { ev: eventId })).data) redirect("/dashboard");
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
    ...staffRows.map((s) => ({ ...s, label: s.role === "section_lead" ? leadWords(event.event_type).one : ROLE_LABEL[s.role] })),
  ]
    .filter((j) => new Date(j.created_at) >= weekAgo && j.user_id !== user.id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);
  const teamUpdates: TeamUpdate[] = [
    ...(unled.length
      ? [
          {
            tone: "warn" as const,
            text: `${unled.length === 1 ? "1 station needs" : `${unled.length} stations need`} a ${leadWords(event.event_type).one}: ${unled.map((s) => s.name).join(", ")}`,
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
  // Group events: who's arrived and who's running over (the Event day page has the details).
  const groupStatus = roomsHere
    ? await Promise.all([
        supabase.from("room_slots").select("room_id, band_id, starts_at, ends_at").eq("event_id", eventId),
        supabase.from("group_checkins").select("band_id, room_id, created_at, actor_name").eq("event_id", eventId),
      ]).then(([{ data: gs }, { data: gc }]) =>
        (gs ?? []).length ? groupDaySummary(groupDay((gs ?? []) as GroupSlot[], (gc ?? []) as GroupCheckin[], now, isEventDay)) : null,
      )
    : null;
  const groupName = (id: string) => dayBands.find((b) => b.id === id)?.band_name ?? "A group";
  const [{ count: volunteerCount }, { data: checkins }] = access.canManage
    ? await Promise.all([
        supabase.from("volunteers").select("id", { count: "exact", head: true }).eq("event_id", eventId),
        isEventDay
          ? supabase.from("volunteer_assignments").select("checked_in_at, shifts!inner(event_id)").eq("shifts.event_id", eventId)
          : Promise.resolve({ data: [] }),
      ])
    : [{ count: 0 }, { data: [] }];
  // School visitor events: parents registered and checked in at the door.
  const parentsHere = hasParents(event.event_type);
  const parentRows = parentsHere
    ? ((await supabase.from("parent_registrations").select("created_at, checked_in_at, adult_count, other_adults, children").eq("event_id", eventId)).data ?? [])
    : [];
  const parentNumbers = parentStats(parentRows);
  // Section Leads see children's details (and work the door) on event day only.
  const doorLocked = parentsHere && !access.canManage && !isEventDay;
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

  // The public event page, with a QR code to download for flyers, emails and slides.
  const publicUrl = `${await getOrigin()}/e/${event.slug}`;
  const publicQr =
    event.status === "published"
      ? await Promise.all([
          QRCode.toString(publicUrl, { type: "svg", margin: 1, width: 112 }),
          QRCode.toDataURL(publicUrl, { margin: 2, width: 1024 }),
        ])
      : null;

  // Conferences: meeting times and where they meet (hosts and the team can read them).
  const conference = conferenceHere
    ? (((await supabase.from("conference_settings").select(SETTINGS_COLUMNS).eq("event_id", eventId).maybeSingle()).data ??
        null) as ConferenceSettings | null)
    : null;
  const conferenceBooked = conferenceHere
    ? ((await supabase.from("conference_bookings").select("id", { count: "exact", head: true }).eq("event_id", eventId)).count ?? 0)
    : 0;

  // Hosts: the setup checklist and what publishing will do.
  const setup: SetupFacts | null = access.isHost
    ? {
        eventId,
        eventType: event.event_type,
        published: event.status === "published",
        stations: stations.length,
        shifts: (shifts ?? []).length,
        checkInStops: path.length,
        team: staffRows.length + openInvites.length + hosts.filter((h) => h.role === "admin").length,
        files: files.length,
        volunteerSignupOpen: event.volunteer_signup_open,
        bandRegistrationOpen: Boolean(event.band_registration_open),
        scheduleShared: Boolean(event.performance_order_published),
        finalsSlots:
          event.event_type === "band_contest"
            ? ((await supabase.from("finals_slots").select("event_id", { count: "exact", head: true }).eq("event_id", eventId)).count ?? 0)
            : 0,
        finalsPublished: Boolean(event.finals_published),
        finalistsRevealed: Boolean(event.finalists_revealed),
        directorInfo: Boolean(event.director_info?.trim()),
        pathRooms: roomsHere
          ? ((await supabase.from("rooms").select("id", { count: "exact", head: true }).eq("event_id", eventId).not("path_order", "is", null)).count ?? 0)
          : 0,
        booths: hasBooths(event.event_type)
          ? ((await supabase.from("fair_booths").select("id", { count: "exact", head: true }).eq("event_id", eventId)).count ?? 0)
          : 0,
        parentRegistrationOpen: event.parent_registration_open,
        parentClosesAt: Boolean(event.parent_registration_closes_at),
        conferenceMissing: conferenceHere ? notReady(conference, event.venue_address) : null,
      }
    : null;
  const checklist = setup ? setupChecklist(setup) : null;

  return (
    <div className={checklist ? "pb-24 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:pb-0" : undefined}>
      {demoEnded && <SuccessToast message="You're back on your own account. The demo people and sample data are gone." />}
      {checklist && <SetupGuide checklist={checklist} />}
      <div className="min-w-0">
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← All events
      </Link>

      {/* Name and details on the left; Edit details with Delete Event beneath it, top right. */}
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">{event.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge tone={event.status === "published" ? "live" : "neutral"}>
              {event.status === "published" ? "Published" : "Draft: only your team can see this"}
            </Badge>
            <Badge tone="info">{eventTypeLabel(event.event_type)}</Badge>
          </div>
          <p className="mt-3 text-muted">
            {formatDateRange(event.starts_on, event.ends_on)} · {windowLabel}
          </p>
          <p className="mt-1 text-sm text-muted">All times are {zoneName(tz)}.</p>
          {event.venue_address && (
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
          )}
        </div>
        <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:items-stretch">
          {access.isHost && (
            <Link
              href={`/dashboard/events/${eventId}/edit`}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-background"
            >
              Edit details
            </Link>
          )}
          {access.isHost && <DeleteEventButton name={event.name} action={deleteEvent.bind(null, eventId)} />}
        </div>
      </div>

      <EventBannerSlot eventId={eventId} audience="section_leads" tz={tz} className="mt-6" />

      {setup && checklist && <PublishPanel facts={setup} remaining={checklist.remaining} />}

      <PublicPageCard url={publicUrl} published={event.status === "published"} slug={event.slug} qr={publicQr} />

      {/* Event day comes first after publishing, so it's easy to find on the day. */}
      {bandsHere && (access.canManage || myStations.length > 0) && (
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
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/events/${eventId}/announcements`}
                      className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
                    >
                      Broadcast Message
                    </Link>
                    <Link
                      href={`/dashboard/events/${eventId}/contest-day`}
                      className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
                    >
                      Open contest day
                    </Link>
                  </div>
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
                  {myStations.length > 0 ? (
                    <p>
                      <span className="font-medium">You lead {myStations.map((s) => s.name).join(", ")}.</span>{" "}
                      <span className="text-muted">
                        {myVolunteers} {myVolunteers === 1 ? "volunteer" : "volunteers"} signed up.
                      </span>
                    </p>
                  ) : (
                    <p className="text-muted">No bands registered yet. Live progress shows here once they do.</p>
                  )}
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
                <div className="flex flex-wrap gap-2">
                  {access.canManage && (
                    <Link
                      href={`/dashboard/events/${eventId}/announcements`}
                      className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
                    >
                      Broadcast Message
                    </Link>
                  )}
                  <Link
                    href={`/dashboard/events/${eventId}/contest-day`}
                    className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
                  >
                    Open contest day
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </section>
      )}

      {roomsHere && groupStatus && (
        <section className="mt-10" aria-labelledby="group-day-heading">
          <h2 id="group-day-heading" className="text-xl font-semibold">
            Event day
          </h2>
          <Card className="mt-4 flex flex-wrap items-center justify-between gap-4">
            {isEventDay && <AutoRefresh seconds={30} />}
            <div className="space-y-1 text-sm leading-6">
              <p>
                <span className="font-medium">
                  {groupStatus.here} of {groupStatus.total} groups here
                </span>
                {groupStatus.finished > 0 && <span className="text-muted"> · {groupStatus.finished} finished every room</span>}
              </p>
              {groupStatus.late.length > 0 && (
                <p className="text-danger">Not here yet: {groupStatus.late.map((d) => groupName(d.bandId)).join(", ")}</p>
              )}
              {groupStatus.behind.length > 0 && (
                <p className="text-danger">Running over: {[...new Set(groupStatus.behind.map((b) => groupName(b.bandId)))].join(", ")}</p>
              )}
              {!isEventDay && <p className="text-muted">Check groups in and track each room on {formatDate(event.starts_on, { year: undefined })}.</p>}
            </div>
            <Link
              href={`/dashboard/events/${eventId}/event-day`}
              className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
            >
              Open event day
            </Link>
          </Card>
        </section>
      )}

      {conferenceHere && access.isHost && (
        <section className="mt-10" aria-labelledby="conference-heading">
          <h2 id="conference-heading" className="text-xl font-semibold">
            Conference Setup
          </h2>
          <Card className="mt-4">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
              <div className="space-y-1 text-sm leading-6">
                {conference?.times_saved_at ? (
                  <p className="font-medium">
                    {event.status === "published"
                      ? `${conferenceBooked} of ${meetingStarts(utcToZonedTime(event.window_start, tz), utcToZonedTime(event.window_end, tz), conference).length} times booked`
                      : meetingSummary(
                          meetingStarts(utcToZonedTime(event.window_start, tz), utcToZonedTime(event.window_end, tz), conference),
                          conference.meeting_minutes,
                        )}
                    {conference.meeting_mode && ` · ${modeLabel(conference.meeting_mode)}`}
                  </p>
                ) : (
                  <p className="font-medium">Set your meeting length, breaks, and your room or video link.</p>
                )}
                <p className="text-muted">
                  {notReady(conference, event.venue_address) ??
                    (event.status === "published" ? "Families book from your public page link." : "Ready to publish.")}
                </p>
              </div>
              <Link
                href={`/dashboard/events/${eventId}/conferences`}
                className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
              >
                {notReady(conference, event.venue_address) ? "Set up conferences" : "Manage conferences"}
              </Link>
            </div>
          </Card>
        </section>
      )}

      {!bandsHere && !conferenceHere && (access.canManage || myStations.length > 0) && (
        <section className={roomsHere && groupStatus ? "mt-4" : "mt-10"} aria-labelledby={roomsHere && groupStatus ? "group-day-heading" : "day-heading"}>
          {!(roomsHere && groupStatus) && (
            <h2 id="day-heading" className="text-xl font-semibold">
              Event day
            </h2>
          )}
          <Card className={roomsHere && groupStatus ? "" : "mt-4"}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1 text-sm leading-6">
                {access.canManage ? (
                  <p>
                    {isEventDay ? (
                      <span className="font-medium">
                        {checkedIn.done} of {checkedIn.of} volunteers checked in.
                      </span>
                    ) : (
                      <>
                        <span className="font-medium">Check volunteers in at the desk on {formatDate(event.starts_on, { year: undefined })}.</span>{" "}
                        <span className="text-muted">Walk-ups can fill open spots, and you can release no-shows.</span>
                      </>
                    )}
                  </p>
                ) : null}
                {myStations.length > 0 && (
                  <p>
                    <span className="font-medium">You lead {myStations.map((s) => s.name).join(", ")}.</span>{" "}
                    <span className="text-muted">
                      {myVolunteers} {myVolunteers === 1 ? "volunteer" : "volunteers"} signed up.
                    </span>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {myStations.length > 0 && (
                  <Link
                    href={`/dashboard/events/${eventId}/contest-day`}
                    className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
                  >
                    My stations
                  </Link>
                )}
                {parentsHere && !doorLocked && (
                  <Link
                    href={`/dashboard/events/${eventId}/parents#door-check-in`}
                    className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
                  >
                    Parent door check-in
                  </Link>
                )}
                {hasBooths(event.event_type) && (
                  <Link
                    href={`/dashboard/events/${eventId}/booths`}
                    className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
                  >
                    Partner check-in
                  </Link>
                )}
                {access.canManage && (
                  <Link
                    href={`/dashboard/events/${eventId}/announcements`}
                    className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
                  >
                    Broadcast Message
                  </Link>
                )}
                {access.canManage && (
                  <Link
                    href={`/dashboard/events/${eventId}/volunteers`}
                    className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
                  >
                    Volunteer Check-in
                  </Link>
                )}
              </div>
            </div>
          </Card>
        </section>
      )}


      {!conferenceHere && (files.length > 0 || access.isHost) && (
        <section className="mt-10" aria-labelledby="files-heading">
          <h2 id="files-heading" className="text-xl font-semibold">
            Maps &amp; documents
          </h2>
          <Card className="mt-4 space-y-5">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
              <p className="text-sm leading-6 text-muted">
                {files.length
                  ? `${files.length} ${files.length === 1 ? "file" : "files"} shared.`
                  : groupsHere
                    ? `Share a ${bandsHere ? "stadium" : "building"} map, parking map or director packet with the public, ${words.one} directors, volunteers or your team.`
                    : "Share a site map, parking map or volunteer guide with the public, volunteers or your team."}
              </p>
              {access.isHost && (
                <Link
                  href={`/dashboard/events/${eventId}/edit?step=files`}
                  className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
                >
                  {files.length ? "Manage maps & documents" : "Add a map or document"}
                </Link>
              )}
            </div>
            <FileLinks files={files} details={uploaded} />
          </Card>
        </section>
      )}

      {hasBooths(event.event_type) && <BoothsCard eventId={eventId} isDay={isEventDay} />}

      {parentsHere && (
        <section className="mt-10" aria-labelledby="parents-heading">
          <h2 id="parents-heading" className="text-xl font-semibold">
            {access.isHost ? "Parent Registration" : "Parent check-in"}
          </h2>
          <Card className="mt-4">
            {isEventDay && <AutoRefresh seconds={30} />}
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
              <div className="space-y-1 text-sm leading-6">
                <p className="font-medium">
                  {doorLocked
                    ? "Door check-in opens on event day."
                    : isEventDay
                      ? `${parentNumbers.adultsArrived} of ${parentNumbers.adults} adults checked in.`
                      : `${parentNumbers.families} ${parentNumbers.families === 1 ? "family" : "families"} registered.`}
                </p>
                <p className="text-muted">
                  {event.status !== "published"
                    ? "Parents can register once the event is published."
                    : !parentRegistrationClosed(event)
                      ? `Registration is open${event.parent_registration_closes_at ? ` until ${closesAtLabel(event.parent_registration_closes_at, event.timezone)}` : ""}. Parents are reminded to bring a photo ID.`
                      : "Registration is closed."}
                </p>
                <p className="text-muted">
                  {doorLocked
                    ? `🔒 Children's details open for Section Leads on event day (${formatDate(event.starts_on, { year: undefined })}), for door check-in.`
                    : "🔒 Children's details are seen only by your team (Section Leads on event day) and deleted 30 days after the event."}
                </p>
              </div>
              {!doorLocked && (
                <Link
                  href={`/dashboard/events/${eventId}/parents`}
                  className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
                >
                  {access.isHost ? "Registration & door check-in" : "Open door check-in"}
                </Link>
              )}
            </div>
            {!doorLocked && parentNumbers.families > 0 && <ParentNumbers stats={parentNumbers} eventDay={isEventDay} />}
          </Card>
        </section>
      )}

      {access.canManage && !conferenceHere && (
        <section className="mt-10" aria-labelledby="team-heading">
          <h2 id="team-heading" className="text-xl font-semibold">
            Team
          </h2>
          <Card className="mt-4 space-y-5">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
              <p className="text-sm leading-6 text-muted">Hosts, Volunteer Leads and {leadWords(event.event_type).many}, and their invitations.</p>
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
                { label: leadWords(event.event_type).many, value: leads.length, tab: "section-leads" },
                { label: "Waiting to accept", value: openInvites.length, tab: null },
              ]}
              updates={teamUpdates}
            />
          </Card>
        </section>
      )}


      {groupsHere && (
      <section className="mt-10" aria-labelledby="bands-heading">
        <h2 id="bands-heading" className="text-xl font-semibold">
          {access.isHost ? `${words.One} Registration` : words.Many}
        </h2>
        <Card className="mt-4 space-y-5">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
            <p className="text-sm leading-6 text-muted">
              {bands.length
                ? `${bands.length} ${bands.length === 1 ? words.one : words.many} registered.`
                : `No ${words.many} registered yet.`}{" "}
              {access.isHost
                ? `Settings, opening registration and inviting ${words.one} directors.`
                : roomsHere
                  ? "See each group's times in every room."
                  : "See the performance order and each band's status on the day."}
            </p>
            <div className="flex flex-wrap gap-2">
              {roomsHere && !access.isHost && (
                <Link
                  href={`/dashboard/events/${eventId}/rooms`}
                  className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
                >
                  Room schedule
                </Link>
              )}
              {(access.isHost || !roomsHere) && (
                <Link
                  href={`/dashboard/events/${eventId}/${access.isHost ? "bands" : "schedule"}`}
                  className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
                >
                  {access.isHost ? `Manage ${words.many}` : "Band schedule"}
                </Link>
              )}
            </div>
          </div>
          {access.canManage && bands.length > 0 && <LogisticsTotals bands={bands} noTrucks={roomsHere} />}
        </Card>
      </section>
      )}

      {groupsHere && access.isHost && (
        <section className="mt-10" aria-labelledby="schedule-heading">
          <h2 id="schedule-heading" className="text-xl font-semibold">
            {roomsHere ? "Rooms & Schedule Setup" : "Performance Schedule Setup"}
          </h2>
          <Card className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={event.performance_order_published ? "success" : "neutral"}>
                {event.performance_order_published ? "Published" : "Not published"}
              </Badge>
              <span className="text-sm text-muted">
                {roomsHere
                  ? "Your rooms, the path every group follows, and each group's times."
                  : "The running order, breaks and finals. Directors are emailed their times when you publish."}
              </span>
            </div>
            <Link
              href={`/dashboard/events/${eventId}/${roomsHere ? "rooms" : "schedule"}`}
              className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
            >
              {roomsHere ? "Set up rooms & schedule" : "Set up the schedule"}
            </Link>
          </Card>
        </section>
      )}

      {access.canManage && !conferenceHere && (
        <section className="mt-10" aria-labelledby="volunteers-heading">
          <h2 id="volunteers-heading" className="text-xl font-semibold">
            Volunteer Setup
          </h2>
          <Card className="mt-4 space-y-5">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
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

      {demo && !conferenceHere && (
        <section className="mt-10" aria-labelledby="demo-heading">
          <h2 id="demo-heading" className="text-xl font-semibold">
            Demo this event
          </h2>
          <Card className="mt-4 space-y-3">
            <p className="text-sm leading-6 text-muted">
              See this event the way each person does, without switching emails. Tap a role and this browser signs in as
              a demo person in that role: a co-host, a Volunteer Lead, a Section Lead (of the first stations),
              {groupsHere && <> the director of &ldquo;Demo High School&rdquo;,</>} a volunteer with a shift, or a parent
              looking at the public page.
              A bar at the top switches roles; <strong className="text-foreground">Back to me</strong> takes the demo
              people and sample data back off and returns you here, still signed in.
            </p>
            <p className="text-sm leading-6 text-muted">
              The first time, the event also fills with sample data for its kind: stations and shifts with a dozen
              volunteers (two of them students signed up by a parent){bandsHere ? ", six bands" : groupsHere ? ", five groups and three rooms" : ""}
              {event.event_type === "school_visit" ? ", eight parent registrations" : ""}
              {event.event_type === "fair" ? ", eight booths across four zones" : ""}. Sample people never get emails, and{" "}
              <strong className="text-foreground">Remove demo people</strong> takes all of it back off.
            </p>
            <p className="text-sm leading-6 text-muted">
              Use a practice event: the demo people really are on this event (in its lists and counts), and as Host
              you can do anything a host can, including emailing its {groupsHere ? `${words.many} and volunteers` : "volunteers"}. Demo people never get
              emails.
            </p>
            <DemoStart eventId={eventId} personas={groupsHere ? PERSONAS : PERSONAS.filter((p) => p.value !== "director")} active={demo.active} />
          </Card>
        </section>
      )}
      </div>
    </div>
  );
}

/**
 * Publish or unpublish, with what that does in plain words, so hosts know
 * when they're ready and that nothing is sent or locked in.
 */
function PublishPanel({ facts, remaining }: { facts: SetupFacts; remaining: ReturnType<typeof setupChecklist>["remaining"] }) {
  const words = groupWords(facts.eventType);
  if (facts.published) {
    // Each thing people can use or see, whether it's on, and where to change it.
    type Live = { label: string; on: boolean; onText: string; offText: string; href: string; note?: string };
    const open = (label: string, on: boolean, href: string): Live => ({ label, on, onText: "Open", offText: "Closed", href });
    const shown = (label: string, on: boolean, href: string, note?: string): Live => ({
      label,
      on,
      onText: "Viewable",
      offText: "Not published",
      href,
      note,
    });
    const live: Live[] = [
      ...(facts.stations > 0 || facts.eventType === "volunteer" ? [open("Volunteer sign-up", facts.volunteerSignupOpen, "volunteering")] : []),
      ...(hasEnsembles(facts.eventType) ? [open(`${words.One} registration`, facts.bandRegistrationOpen, "bands")] : []),
      ...(facts.eventType === "band_contest" ? [shown("Performance schedule", facts.scheduleShared, "schedule")] : []),
      ...(facts.eventType === "band_contest" && facts.finalsSlots > 0
        ? [
            shown(
              "Finals schedule",
              facts.finalsPublished,
              "schedule",
              facts.finalsPublished && !facts.finalistsRevealed ? "Finalist names not revealed yet" : undefined,
            ),
          ]
        : []),
      ...(hasRooms(facts.eventType) ? [shown("Room schedule", facts.scheduleShared, "rooms#order-heading")] : []),
      ...(hasParents(facts.eventType) ? [open("Parent registration", facts.parentRegistrationOpen, "parents")] : []),
    ];
    return (
      <Card id="publish" className="mt-6 scroll-mt-6">
        <h2 className="text-lg font-semibold">Your event is live</h2>
        <p className="mt-1 text-sm text-muted">Your public page is online. Here&apos;s what people can use and see right now:</p>
        {live.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm">
            {live.map((l) => (
              <li key={l.label} className="flex flex-wrap items-center gap-2">
                <Badge tone={l.on ? "success" : "neutral"}>{l.on ? l.onText : l.offText}</Badge>
                <span>{l.label}</span>
                {l.note && <span className="text-muted">· {l.note}</span>}
                <Link href={`/dashboard/events/${facts.eventId}/${l.href}`} className="font-medium text-brand underline-offset-4 hover:underline">
                  {l.on ? "Manage" : l.offText === "Closed" ? "Open it" : "Publish it"}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t border-border pt-4">
          <ActionButton
            action={setEventPublished.bind(null, facts.eventId, false)}
            variant="stop"
            confirmMessage="Unpublish? The public pages will be hidden and volunteer sign-up will close. You can publish again anytime."
          >
            Unpublish event
          </ActionButton>
        </div>
      </Card>
    );
  }
  return (
    <Card id="publish" className="mt-6 scroll-mt-6">
      <h2 className="text-lg font-semibold">{remaining.length ? "Almost ready to publish" : "Ready to publish"}</h2>
      {remaining.length ? (
        <div className="mt-3 rounded-md bg-warning-soft p-3 text-sm">
          <p className="font-medium">We recommend finishing {remaining.length === 1 ? "this" : "these"} first:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {remaining.map((r) => (
              <li key={r.id}>
                <Link href={r.href} className="font-medium text-brand underline-offset-4 hover:underline">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-2 flex items-center gap-2 text-sm font-medium text-success">
          <span aria-hidden>✓</span> Everything your event needs is set up.
        </p>
      )}
      <p className="mt-4 text-sm font-semibold">When you publish:</p>
      <ul className="mt-2 space-y-1.5 text-sm text-muted">
        {publishEffects(facts).map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden className="text-success">✓</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5">
        <ActionButton action={setEventPublished.bind(null, facts.eventId, true)} variant="go" pendingText="Publishing…">
          Publish event
        </ActionButton>
      </div>
    </Card>
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

function PublicPageCard({ url, published, slug, qr }: { url: string; published: boolean; slug: string; qr: [string, string] | null }) {
  const display = url.replace(/^https?:\/\//, "");
  if (!published || !qr) {
    return (
      <Card className="mt-6 text-sm leading-6">
        <p className="font-medium">Public page</p>
        <p className="text-muted">
          Goes live at <span className="font-mono text-foreground">{display}</span> when you publish, with a QR code to share.
        </p>
      </Card>
    );
  }
  return (
    <RememberedPanel
      id="public-page"
      defaultOpen={false}
      className="mt-6"
      showLabel="Show QR code"
      hideLabel="Hide QR code"
      header={
        <div className="text-sm leading-6">
          <span className="font-medium">Public page</span>
          <span className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <a href={url} target="_blank" rel="noreferrer" className="break-all font-mono text-brand underline-offset-4 hover:underline">
              {display} ↗
            </a>
            <CopyLink url={url} className="font-medium text-brand underline-offset-4 hover:underline" />
          </span>
        </div>
      }
    >
      <div className="flex flex-wrap items-center gap-4">
        <div
          className="shrink-0 rounded-md border border-border bg-white p-1"
          aria-label="QR code for the public event page"
          role="img"
          dangerouslySetInnerHTML={{ __html: qr[0] }}
        />
        <div className="min-w-0 flex-1 space-y-2 text-sm leading-6">
          <p className="text-muted">Share the link or QR code in emails, flyers and slides.</p>
          <a href={qr[1]} download={`${slug}-qr.png`} className="inline-block font-medium text-brand underline-offset-4 hover:underline">
            Download QR code
          </a>
        </div>
      </div>
    </RememberedPanel>
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

/** The Parent registration card's numbers. On the event day, who's arrived and who's still to come. */
function ParentNumbers({ stats, eventDay }: { stats: ParentStats; eventDay: boolean }) {
  const tiles: [string, string | number][] = eventDay
    ? [
        ["Adults checked in", `${stats.adultsArrived} / ${stats.adults}`],
        ["Adults still to arrive", stats.adults - stats.adultsArrived],
        ["Families here", `${stats.familiesArrived} / ${stats.families}`],
        ["Children", stats.children],
      ]
    : [
        ["Families", stats.families],
        ["Adults coming", stats.adults],
        ["Children", stats.children],
        ["New this week", stats.newThisWeek],
      ];
  return (
    <div className="mt-5 border-t border-border pt-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-background px-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-sm">
        <span className="text-muted">{eventDay ? "Arrived by grade: " : "Children by grade: "}</span>
        {stats.byGrade.map((g) => `${g.grade}: ${eventDay ? `${g.arrived} of ${g.children}` : g.children}`).join(" · ")}
      </p>
      <p className="mt-1 text-sm">
        <span className="text-muted">Children by teacher: </span>
        {stats.byTeacher.map((t) => `${t.name}: ${t.children}`).join(" · ")}
      </p>
    </div>
  );
}

/** Headcounts and vehicles across every registered band, for parking and planning. */
function LogisticsTotals({ bands, noTrucks = false }: { bands: BandTotals[]; noTrucks?: boolean }) {
  const total = (k: Exclude<keyof BandTotals, "classification">) => bands.reduce((n, b) => n + Number(b[k] ?? 0), 0);
  const byClass = bands.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.classification]: (acc[b.classification] ?? 0) + 1 }), {});
  return (
    <div className="border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Logistics totals</h3>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(
          [
            [noTrucks ? "Participants" : "Students", total("student_count")],
            ["Chaperones", total("chaperone_count")],
            ["Buses", total("bus_count")],
            // Group events don't ask about trucks.
            ...(noTrucks
              ? []
              : ([
                  ["Box trucks", total("box_truck_count")],
                  ["Truck + trailers", total("truck_trailer_count")],
                  ["Semi trucks", total("semi_truck_count")],
                ] as const)),
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

/** The Volunteer Setup card's numbers: how full the day is and where help is needed. */
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
