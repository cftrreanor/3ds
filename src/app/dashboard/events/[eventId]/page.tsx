import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { SuccessToast } from "@/components/toaster";
import { redirect } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getEventAccess, getOrigin } from "@/lib/data";
import QRCode from "qrcode";
import { CopyLink } from "@/components/copy-link";
import { ScrollTo } from "@/components/scroll-to";
import { RememberedPanel } from "@/components/remembered-panel";
import { missing } from "@/lib/schema-check";
import { conferenceBookedCount } from "@/lib/conference-access";
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
import { AutoRefresh } from "@/components/auto-refresh";
import { eventPhase, nextUp, onTrack, sortStations, stationTiles, type BandDay, type Checkpoint, type Stop } from "@/lib/contest-day";
import { AttentionList, DayTiles, StatusLine } from "./contest-day/on-track";
import { deleteEvent, publishAndOpen, setEventPublished } from "../../actions";
import { DeleteEventButton } from "./delete-event";
import { ActionButton } from "./forms";
import { type Shift } from "./station-panel";
import { DemoStart } from "@/components/demo-switcher";
import { EventBannerSlot } from "@/components/event-banner-slot";
import { liveEventBanners } from "@/lib/event-banners";
import { BoothsCard } from "./booths/booths-card";
import { FileLinks } from "@/components/file-links";
import { personasFor } from "@/lib/demo";
import { bookingWords, eventTypeLabel, groupWords, hasBands, hasBooths, hasConferences, hasEnsembles, hasParents, hasRooms, leadWords } from "@/lib/event-types";
import { meetingStarts, meetingSummary, modesLabel, modesOf, notReady, weeklySummary } from "@/lib/conferences";
import { loadConferenceSettings } from "@/lib/conference-settings";
import { groupDay, groupDaySummary, type GroupCheckin, type GroupSlot } from "@/lib/group-day";
import { closesAtLabel, parentRegistrationClosed } from "@/lib/parents";
import { parentStats, type ParentStats } from "@/lib/parent-stats";
import { filesFor, uploadedLines, type EventFile } from "@/lib/event-files";
import { publishEffects, setupChecklist, type SetupFacts } from "@/lib/setup-checklist";
import { SetupGuide } from "@/components/setup-guide";
import { DayRail } from "@/components/event-day-nav";
import { loadDayActions } from "@/lib/event-day-actions";
import { SavedBy } from "@/components/saved-by";
import { brand } from "@/lib/brand";
import { loadSetupFacts } from "@/lib/setup-facts";

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

const ROLE_LABEL = { volunteer_director: "Volunteer Lead", section_lead: "Coordinator" } as const;

export default async function EventPage({ params, searchParams }: PageProps<"/dashboard/events/[eventId]">) {
  const { eventId } = await params;
  // Back from demo mode (demo-actions backToMe).
  const query = await searchParams;
  const demoEnded = query.demo === "ended";
  // Just published (here or from a setup page).
  const justPublished = query.published === "1";
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
  const booking = bookingWords(event.event_type);
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

  // Coordinators: their sign-ups (volunteers by shift) are on the Contest day page.
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
            text: `${unled.length === 1 ? "1 sign-up needs" : `${unled.length} sign-ups need`} a ${leadWords(event.event_type).one}: ${unled.map((s) => s.name).join(", ")}`,
            tab: "section-leads",
          },
        ]
      : []),
    ...(expiredInvites.length
      ? [
          {
            tone: "warn" as const,
            text: `${expiredInvites.length === 1 ? "1 invitation has" : `${expiredInvites.length} invitations have`} expired. Resend them from Team setup.`,
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
  // Coordinators see children's details (and work the door) on event day only.
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
    ? (await loadConferenceSettings(supabase, eventId)).saved
    : null;
  // A count only: the bookings themselves are the teacher's alone.
  const conferenceBooked = conferenceHere ? await conferenceBookedCount(supabase, eventId) : 0;

  // On the day itself, the day's jobs take the checklist's place beside the page.
  const dayActions = await loadDayActions(eventId);
  // Hosts: the setup checklist and what publishing will do (the same facts every event page's strip uses).
  const setup: SetupFacts | null = access.isHost ? await loadSetupFacts(eventId) : null;
  const checklist = setup ? setupChecklist(setup) : null;

  const past = today > event.ends_on;
  const published = event.status === "published";
  // On the day (and once it's over), what's happening comes first; before it, setup and publishing.
  const dayFirst = isEventDay || (past && published);
  const daysToGo = Math.round((Date.parse(event.starts_on) - Date.parse(today)) / 864e5);
  const words2 = leadWords(event.event_type);

  // Hosts and Volunteer Leads: live announcements as one line (they posted them); the rest of the team sees them in full.
  const announcements = access.canManage ? await liveEventBanners(eventId, "section_leads") : [];

  // Everything that needs someone to act, in one list near the top.
  const attention: { text: string; href: string }[] = access.canManage && !conferenceHere
    ? [
        ...teamUpdates
          .filter((u) => u.tone === "warn")
          .map((u) => ({ text: u.text, href: `/dashboard/events/${eventId}/team${u.tab ? `?tab=${u.tab}` : ""}` })),
        ...(published && !past && daysToGo <= 7 && totalSlots > signedUp
          ? [
              {
                text: `${totalSlots - signedUp} volunteer ${totalSlots - signedUp === 1 ? "spot is" : "spots are"} still open`,
                href: `/dashboard/events/${eventId}/volunteering`,
              },
            ]
          : []),
      ]
    : [];

  const dayTitle = bandsHere ? "Contest day" : "Event day";
  const showDay =
    (bandsHere && (access.canManage || myStations.length > 0)) ||
    (roomsHere && !!groupStatus) ||
    (!bandsHere && !conferenceHere && (access.canManage || myStations.length > 0));

  const day = showDay ? (
    <PageSection id="day" title={dayTitle}>
      {bandsHere ? (
        <Card className={`space-y-4 ${isEventDay ? "border-brand" : ""}`}>
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
                  <Link href={`/dashboard/events/${eventId}/contest-day`} className={dayFirst ? BTN : BTN_OUTLINE}>
                    Open contest day
                  </Link>
                  {!past && (
                    <Link href={`/dashboard/events/${eventId}/announcements`} className={BTN_OUTLINE}>
                      Broadcast Message
                    </Link>
                  )}
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
                <Link href={`/dashboard/events/${eventId}/contest-day`} className={dayFirst ? BTN : BTN_OUTLINE}>
                  Open contest day
                </Link>
                {access.canManage && !past && (
                  <Link href={`/dashboard/events/${eventId}/announcements`} className={BTN_OUTLINE}>
                    Broadcast Message
                  </Link>
                )}
              </div>
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {roomsHere && groupStatus && (
            <Card className={`flex flex-wrap items-center justify-between gap-4 ${isEventDay ? "border-brand" : ""}`}>
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
              <Link href={`/dashboard/events/${eventId}/event-day`} className={dayFirst ? BTN : BTN_OUTLINE}>
                Open event day
              </Link>
            </Card>
          )}
          {(access.canManage || myStations.length > 0) && (
            <Card className={isEventDay && !(roomsHere && groupStatus) ? "border-brand" : ""}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1 text-sm leading-6">
                  {access.canManage ? (
                    <p>
                      {isEventDay ? (
                        <span className="font-medium">
                          {checkedIn.done} of {checkedIn.of} volunteers checked in.
                        </span>
                      ) : past ? (
                        <span className="font-medium">
                          {signedUp} {signedUp === 1 ? "volunteer" : "volunteers"} signed up for this event.
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
                  {/* One main button on the day (the check-in most used), the rest outlined. */}
                  {[
                    // Visitor days: the parent door is the main check-in.
                    parentsHere && !doorLocked && { href: `/dashboard/events/${eventId}/parents#door-check-in`, label: "Parent door check-in" },
                    access.canManage && { href: `/dashboard/events/${eventId}/volunteers`, label: "Volunteer Check-in" },
                    myStations.length > 0 && { href: `/dashboard/events/${eventId}/contest-day`, label: "What I lead" },
                    hasBooths(event.event_type) && { href: `/dashboard/events/${eventId}/booths`, label: "Partner check-in" },
                    access.canManage && !past && { href: `/dashboard/events/${eventId}/announcements`, label: "Broadcast Message" },
                  ]
                    .filter((l): l is { href: string; label: string } => Boolean(l))
                    .map((l, i) => (
                      <Link key={l.href} href={l.href} className={i === 0 && dayFirst && !(roomsHere && groupStatus) ? BTN : BTN_OUTLINE}>
                        {l.label}
                      </Link>
                    ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </PageSection>
  ) : null;

  // Who's coming: the sign-ups each kind of event runs on.
  const conferenceReady = !!conference?.times_saved_at && (published || conferenceBooked > 0);
  const signups = conferenceHere ? (
    access.isHost ? (
      <PageSection id="signups" title={booking.child ? "Conference setup" : "Meeting setup"} saved={<SavedBy eventId={eventId} area="conference" />}>
        <Card className={isEventDay ? "border-brand" : ""}>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
            <div className="space-y-1 text-sm leading-6">
              {conference?.times_saved_at ? (
                <p className="font-medium">
                  {conference.schedule === "weekly"
                    ? `Every week · ${published ? `${conferenceBooked} booked` : weeklySummary(conference.weekly_hours)}`
                    : published
                    ? `${conferenceBooked} of ${meetingStarts(utcToZonedTime(event.window_start, tz), utcToZonedTime(event.window_end, tz), conference).length} times booked`
                    : meetingSummary(
                        meetingStarts(utcToZonedTime(event.window_start, tz), utcToZonedTime(event.window_end, tz), conference),
                        conference.meeting_minutes,
                      )}
                  {modesOf(conference).length > 0 && ` · ${modesLabel(modesOf(conference))}`}
                </p>
              ) : (
                <p className="font-medium">Set your meeting length, breaks, and your room or video link.</p>
              )}
              <p className="text-muted">
                {notReady(conference, event.venue_address, event.event_type) ?? (published ? `${booking.Bookers} book from your public page link.` : "Ready to publish.")}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {conferenceReady && (
                <Link href={`/dashboard/events/${eventId}/conferences/meetings`} className={dayFirst ? BTN : BTN_OUTLINE}>
                  See your meetings
                </Link>
              )}
              <Link
                href={`/dashboard/events/${eventId}/conferences`}
                className={!conferenceReady && notReady(conference, event.venue_address, event.event_type) ? BTN : BTN_OUTLINE}
              >
                {notReady(conference, event.venue_address, event.event_type) ? `Set up ${booking.event}` : `Manage ${booking.event}`}
              </Link>
            </div>
          </div>
        </Card>
      </PageSection>
    ) : null
  ) : parentsHere ? (
    <PageSection id="signups" title={access.isHost ? "Parent registration" : "Parent check-in"} saved={<SavedBy eventId={eventId} area="parents" />}>
      <Card className={isEventDay ? "border-brand" : ""}>
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
              {!published
                ? "Parents can register once the event is published."
                : !parentRegistrationClosed(event)
                  ? `Registration is open${event.parent_registration_closes_at ? ` until ${closesAtLabel(event.parent_registration_closes_at, event.timezone)}` : ""}. Parents are reminded to bring a photo ID.`
                  : "Registration is closed."}
            </p>
            <p className="text-muted">
              {doorLocked
                ? `🔒 Children's details open for ${words2.many} on event day (${formatDate(event.starts_on, { year: undefined })}), for door check-in.`
                : `🔒 Children's details are seen only by your team (${words2.many} on event day) and deleted 30 days after the event.`}
            </p>
          </div>
          {!doorLocked && (
            <Link href={`/dashboard/events/${eventId}/parents`} className={BTN_OUTLINE}>
              {access.isHost ? "Registration & door check-in" : "Open door check-in"}
            </Link>
          )}
        </div>
        {!doorLocked && parentNumbers.families > 0 && <ParentNumbers stats={parentNumbers} eventDay={isEventDay} />}
      </Card>
    </PageSection>
  ) : groupsHere ? (
    <PageSection id="signups" title={access.isHost ? `${words.One} registration` : words.Many} saved={<SavedBy eventId={eventId} area="bands" />}>
      <Card className="space-y-5">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
          <p className="text-sm leading-6">
            <span className="font-medium">
              {bands.length ? `${bands.length} ${bands.length === 1 ? words.one : words.many} registered.` : `No ${words.many} registered yet.`}
            </span>{" "}
            <span className="text-muted">
              {access.isHost
                ? `Settings, opening registration, and inviting ${words.one} directors.`
                : roomsHere
                  ? "See each group's times in every room."
                  : "See the performance order and each band's status on the day."}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {roomsHere && !access.isHost && (
              <Link href={`/dashboard/events/${eventId}/rooms`} className={BTN_OUTLINE}>
                Room schedule
              </Link>
            )}
            {(access.isHost || !roomsHere) && (
              <Link href={`/dashboard/events/${eventId}/${access.isHost ? "bands" : "schedule"}`} className={BTN_OUTLINE}>
                {access.isHost ? `Manage ${words.many}` : "Band schedule"}
              </Link>
            )}
          </div>
        </div>
        {access.canManage && bands.length > 0 && <LogisticsTotals bands={bands} noTrucks={roomsHere} />}
      </Card>
    </PageSection>
  ) : hasBooths(event.event_type) ? (
    <PageSection id="signups" title="Booths & partners" saved={<SavedBy eventId={eventId} area="booths" />}>
      <BoothsCard eventId={eventId} isDay={isEventDay} />
    </PageSection>
  ) : null;
  const signupsLabel = conferenceHere ? (booking.child ? "Conference" : "Meetings") : parentsHere ? "Parents" : groupsHere ? words.Many : "Booths";

  const schedule =
    groupsHere && access.isHost ? (
      <PageSection id="schedule" title={roomsHere ? "Rooms and schedule" : "Performance schedule"} saved={<SavedBy eventId={eventId} area="schedule" />}>
        <Card className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={event.performance_order_published ? "success" : "neutral"}>
              {event.performance_order_published ? "Published" : "Not published"}
            </Badge>
            <span className="text-sm text-muted">
              {roomsHere
                ? "Your rooms, the path every group follows, and each group's times."
                : "The running order, breaks, and finals. Directors are emailed their times when you publish."}
            </span>
          </div>
          <Link href={`/dashboard/events/${eventId}/${roomsHere ? "rooms" : "schedule"}`} className={BTN_OUTLINE}>
            {roomsHere ? "Set up rooms & schedule" : "Set up the schedule"}
          </Link>
        </Card>
      </PageSection>
    ) : null;

  const volunteers =
    access.canManage && !conferenceHere ? (
      <PageSection id="volunteers" title="Volunteers" saved={<SavedBy eventId={eventId} area="volunteers" />}>
        <Card className="space-y-5">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={published && event.volunteer_signup_open ? "brand" : "neutral"}>
                {!published ? "Event not published" : event.volunteer_signup_open ? "Signup open" : "Signup closed"}
              </Badge>
              <span className="text-sm text-muted">
                {stations.length} station{stations.length === 1 ? "" : "s"} · {(shifts ?? []).length} shift
                {(shifts ?? []).length === 1 ? "" : "s"}
              </span>
            </div>
            <Link href={`/dashboard/events/${eventId}/volunteering`} className={BTN_OUTLINE}>
              Manage volunteers
            </Link>
          </div>
          <VolunteerStats
            filled={signedUp}
            capacity={totalSlots}
            volunteers={volunteerCount ?? 0}
            checkedIn={isEventDay ? checkedIn : null}
            needs={needsPeople}
          />
        </Card>
      </PageSection>
    ) : null;

  const team =
    access.canManage && !conferenceHere ? (
      <PageSection id="team" title="Team" saved={<SavedBy eventId={eventId} area="team" />}>
        <Card className="space-y-5">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
            <p className="text-sm leading-6 text-muted">Hosts, Volunteer Leads, and {words2.many}, and their invitations.</p>
            <Link
              href={access.isHost ? `/dashboard/events/${eventId}/edit?section=team` : `/dashboard/events/${eventId}/volunteering#section-leads`}
              className={BTN_OUTLINE}
            >
              Manage team
            </Link>
          </div>
          <TeamStats
            eventId={eventId}
            counts={[
              ...(access.isHost ? [{ label: "Hosts", value: hosts.length, tab: "hosts" }] : []),
              { label: "Volunteer Leads", value: directors.length, tab: "volunteer-leads" },
              { label: words2.many, value: leads.length, tab: "section-leads" },
              { label: "Waiting to accept", value: openInvites.length, tab: null },
            ]}
            // What needs fixing is in "Needs attention" at the top; here, who's joined.
            updates={teamUpdates.filter((u) => u.tone === "good")}
          />
        </Card>
      </PageSection>
    ) : null;

  const filesBlock =
    !conferenceHere && (files.length > 0 || access.isHost) ? (
      <PageSection id="files" title="Maps & documents" saved={<SavedBy eventId={eventId} area="files" />}>
        <Card className="space-y-5">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
            <p className="text-sm leading-6 text-muted">
              {files.length
                ? `${files.length} ${files.length === 1 ? "file" : "files"} shared.`
                : groupsHere
                  ? `Share a ${bandsHere ? "stadium" : "building"} map, parking map, or director packet with the public, ${words.one} directors, volunteers, or your team.`
                  : "Share a site map, parking map, or volunteer guide with the public, volunteers, or your team."}
            </p>
            {access.isHost && (
              <Link href={`/dashboard/events/${eventId}/edit?section=files`} className={BTN_OUTLINE}>
                {files.length ? "Manage maps & documents" : "Add a map or document"}
              </Link>
            )}
          </div>
          <FileLinks files={files} details={uploaded} />
        </Card>
      </PageSection>
    ) : null;

  const share = (
    <PageSection id="share" title="Public page">
      <PublicPageCard url={publicUrl} published={published} slug={event.slug} qr={publicQr} />
    </PageSection>
  );

  const publish =
    setup && checklist ? (
      <PublishPanel facts={setup} remaining={checklist.remaining} share={{ url: publicUrl, qrPng: publicQr?.[1] ?? null, slug: event.slug, booking: conferenceHere }} />
    ) : null;

  const attentionBlock =
    attention.length > 0 ? (
      <section id="attention" aria-labelledby="attention-heading" className="mt-6 scroll-mt-6 rounded-lg border border-warning/40 bg-warning-soft p-4 sm:px-6">
        {/* "To do", not "Needs attention": the Contest day card already uses that for late bands. */}
        <h2 id="attention-heading" className="font-semibold">
          To do
        </h2>
        <ul className="mt-2 space-y-1">
          {attention.map((a) => (
            <li key={a.text} className="flex gap-2 text-sm leading-6">
              <span aria-hidden className="text-danger">
                ●
              </span>
              <Link href={a.href} className="underline-offset-4 hover:underline">
                {a.text}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    ) : null;

  const blocks: Record<string, ReactNode> = { publish, attention: attentionBlock, day, signups, schedule, volunteers, team, files: filesBlock, share };
  const order = dayFirst
    ? ["day", "attention", "signups", "schedule", "volunteers", "team", "files", "publish", "share"]
    : ["publish", "attention", "signups", "schedule", "volunteers", "day", "team", "files", "share"];
  const labels: Record<string, string> = {
    day: dayTitle,
    signups: signupsLabel,
    schedule: roomsHere ? "Rooms" : "Schedule",
    volunteers: "Volunteers",
    team: "Team",
    files: "Maps & documents",
    share: "Public page",
  };
  const navLinks = order.filter((k) => labels[k] && blocks[k]).map((k) => ({ id: k, label: labels[k] }));
  const latest = announcements[0];
  const emergency = announcements.some((a) => a.priority === "emergency");

  return (
    <div
      className={
        dayActions
          ? "lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8"
          : checklist
            ? "pb-24 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:pb-0"
            : undefined
      }
    >
      {justPublished && <SuccessToast message={`Published. Your ${conferenceHere ? "booking" : "event"} page is live; share its link below.`} />}
      {justPublished && <ScrollTo id="publish" />}
      {demoEnded && <SuccessToast message="You're back on your own account. The demo people and sample data are gone." />}
      {dayActions ? <DayRail day={dayActions} /> : checklist && <SetupGuide checklist={checklist} />}
      <div className="min-w-0">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← All events
        </Link>

        {/* Name and details on the left; Edit details top right. Deleting lives at the very bottom. */}
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">{event.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Badge tone={published ? "live" : "neutral"}>{published ? "Published" : "Draft: only your team can see this"}</Badge>
              <Badge tone="info">{eventTypeLabel(event.event_type)}</Badge>
            </div>
            <p className="mt-3 text-muted">
              {formatDateRange(event.starts_on, event.ends_on)} · {windowLabel}
            </p>
            <p className="mt-1 text-sm text-muted">All times are {zoneName(tz)}.</p>
            <SavedBy eventId={eventId} area="details" className="mt-2" />
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
          {access.isHost && (
            <Link href={`/dashboard/events/${eventId}/edit`} className={`${BTN_OUTLINE} shrink-0 self-start`}>
              Edit details
            </Link>
          )}
        </div>

        {/* Hosts and Volunteer Leads posted these, so one line is enough; the rest of the team sees them in full. */}
        {access.canManage ? (
          latest && (
            <Link
              href={`/dashboard/events/${eventId}/announcements`}
              className={`mt-6 flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-sm hover:border-brand ${emergency ? "border-danger/50 bg-danger/5" : "border-border bg-surface"}`}
            >
              <span className="min-w-0 truncate">
                <span className={`font-semibold ${emergency ? "text-danger" : ""}`}>
                  {emergency && "⚠️ "}
                  {announcements.length} live {announcements.length === 1 ? "announcement" : "announcements"}
                </span>
                <span className="text-muted"> · {latest.body}</span>
              </span>
              <span className="shrink-0 font-medium text-brand">Manage →</span>
            </Link>
          )
        ) : (
          <EventBannerSlot eventId={eventId} audience="section_leads" tz={tz} className="mt-6" />
        )}

        {navLinks.length >= 3 && (
          <nav aria-label="On this page" className="relative -mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
            <ul className="flex gap-2 whitespace-nowrap sm:flex-wrap">
              {navLinks.map((l) => (
                <li key={l.id}>
                  <a
                    href={`#${l.id}`}
                    className="inline-flex min-h-10 items-center rounded-full border border-border bg-surface px-3.5 text-sm font-medium hover:border-brand"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {order.map((k) => (
          <Fragment key={k}>{blocks[k]}</Fragment>
        ))}

        {demo && (
          <PageSection id="demo" title="Demo this event">
            <Card className="space-y-3">
              <p className="text-sm leading-6 text-muted">
                {conferenceHere
                  ? booking.child
                    ? "Show a teacher how conferences work, as the teacher or as a parent booking a time."
                    : "Show how meetings work, as the host or as someone booking a time."
                  : "See this event the way each person on it does, without switching emails."}
              </p>
              <details className="text-sm leading-6 text-muted">
                <summary className="cursor-pointer font-medium text-foreground">How demo works</summary>
                {conferenceHere ? (
                  <div className="mt-2 space-y-2">
                    <p>
                      {booking.child ? (
                        <>
                          Tap <strong className="text-foreground">Host</strong> to see it as the teacher, or{" "}
                          <strong className="text-foreground">Parent</strong> to see the booking page a family gets (publish the conference first).
                        </>
                      ) : (
                        <>
                          Tap <strong className="text-foreground">Host</strong> to see it as yourself, or{" "}
                          <strong className="text-foreground">Guest</strong> to see the booking page people get (publish your meetings first).
                        </>
                      )}
                      A bar at the top switches between them; <strong className="text-foreground">Back to me</strong> returns you here.
                    </p>
                    <p>
                      The first time, about two of every three meeting times fill with sample {booking.child ? "families" : "people"} (up
                      to eight). If there are no meeting times yet, sample ones are set up (15-minute meetings, their choice of how to
                      meet, Room 214). Sample {booking.child ? "families" : "people"} never get emails, and <strong className="text-foreground">Remove demo people</strong> takes all of it back off.
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <p>
                      Tap a role and this browser signs in as a demo person in that role: a co-host, a Volunteer Lead, a Coordinator (of
                      the first stations),{groupsHere && <> the director of &ldquo;Demo High School&rdquo;,</>} a volunteer with a shift,
                      or a parent looking at the public page. A bar at the top switches roles; <strong className="text-foreground">Back to me</strong>{" "}
                      takes the demo people and sample data back off and returns you here, still signed in.
                    </p>
                    <p>
                      The first time, the event fills with sample data for its kind: sign-ups and shifts with a dozen volunteers
                      {bandsHere ? ", six bands" : groupsHere ? ", five groups and three rooms" : ""}
                      {event.event_type === "school_visit" ? ", eight parent registrations" : ""}
                      {event.event_type === "fair" ? ", eight booths across four zones" : ""}. Use a practice event: the demo people
                      really are on it. Sample people never get emails, and <strong className="text-foreground">Remove demo people</strong>{" "}
                      takes all of it back off.
                    </p>
                  </div>
                )}
              </details>
              <DemoStart eventId={eventId} personas={personasFor(event.event_type)} active={demo.active} />
            </Card>
          </PageSection>
        )}

        {access.isHost && (
          <section aria-labelledby="delete-heading" className="mt-14 border-t border-border pt-6">
            <h2 id="delete-heading" className="text-sm font-semibold">
              Delete this event
            </h2>
            <p className="mt-1 text-sm text-muted">Removes the event and everything in it. This can&apos;t be undone.</p>
            <div className="mt-3">
              <DeleteEventButton name={event.name} action={deleteEvent.bind(null, eventId)} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

const BTN = "inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover";
const BTN_OUTLINE = "inline-flex min-h-11 items-center rounded-md border border-field-border bg-surface px-4 text-sm font-semibold hover:border-brand";

/** One section of the event page: a heading anyone can jump to, then its card. */
function PageSection({ id, title, saved, children }: { id: string; title: string; saved?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="mt-10 scroll-mt-6" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-xl font-semibold">
        {title}
      </h2>
      {saved && <div className="mt-1">{saved}</div>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Publish or unpublish, with what that does in plain words, so hosts know
 * when they're ready and that nothing is sent or locked in.
 */
function PublishPanel({
  facts,
  remaining,
  share,
}: {
  facts: SetupFacts;
  remaining: ReturnType<typeof setupChecklist>["remaining"];
  /** The public page (a conference's booking page), to share once it's live. */
  share: { url: string; qrPng: string | null; slug: string; booking: boolean };
}) {
  const words = groupWords(facts.eventType);
  if (facts.published) {
    // Each thing people can use or see, whether it's on, and where to change it.
    type Live = { label: string; on: boolean; onText: string; offText: string; href: string; note?: string; link?: string };
    // A registration that's open has its own link to share.
    const open = (label: string, on: boolean, href: string, path: string): Live => ({
      label,
      on,
      onText: "Open",
      offText: "Closed",
      href,
      link: `${share.url}/${path}`,
    });
    const shown = (label: string, on: boolean, href: string, note?: string): Live => ({
      label,
      on,
      onText: "Viewable",
      offText: "Not published",
      href,
      note,
    });
    const live: Live[] = [
      ...(facts.stations > 0 || facts.eventType === "volunteer" ? [open("Volunteer sign-up", facts.volunteerSignupOpen, "volunteering", "volunteer")] : []),
      ...(hasEnsembles(facts.eventType) ? [open(`${words.One} registration`, facts.bandRegistrationOpen, "bands", "bands")] : []),
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
      ...(hasParents(facts.eventType) ? [open("Parent registration", facts.parentRegistrationOpen, "parents", "parents")] : []),
    ];
    return (
      <Card id="publish" className="mt-8 scroll-mt-6">
        <h2 className="text-lg font-semibold">Your event is live</h2>
        <SavedBy eventId={facts.eventId} area="publish" className="mt-1" />
        <div className="mt-4 rounded-md border border-border bg-background p-3 text-sm leading-6">
          <p className="font-semibold">Share your {share.booking ? "booking page" : "event page"}</p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <a href={share.url} target="_blank" rel="noreferrer" className="break-all font-mono text-brand underline-offset-4 hover:underline">
              {share.url.replace(/^https?:\/\//, "")} ↗
            </a>
            <CopyLink url={share.url} className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline" />
            {share.qrPng && (
              <a
                href={share.qrPng}
                download={`${share.slug}-qr.png`}
                className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline"
              >
                Download QR code
              </a>
            )}
          </p>
        </div>
        <p className="mt-4 text-sm text-muted">Here&apos;s what people can use and see right now:</p>
        {live.length > 0 && (
          <ul className="mt-3 space-y-2 text-sm">
            {live.map((l) => (
              <li key={l.label} className="flex flex-wrap items-center gap-2">
                <Badge tone={l.on ? "success" : "neutral"}>{l.on ? l.onText : l.offText}</Badge>
                <span>{l.label}</span>
                {l.note && <span className="text-muted">· {l.note}</span>}
                <Link
                  href={`/dashboard/events/${facts.eventId}/${l.href}`}
                  className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline"
                >
                  {l.on ? "Manage" : l.offText === "Closed" ? "Open it" : "Publish it"}
                </Link>
                {l.on && l.link && (
                  <CopyLink url={l.link} className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline" />
                )}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 border-t border-border pt-4">
          <ActionButton
            action={setEventPublished.bind(null, facts.eventId, false)}
            variant="quiet-stop"
            confirmMessage="Unpublish? The public pages will be hidden and volunteer sign-up will close. You can publish again anytime."
          >
            Unpublish event
          </ActionButton>
        </div>
      </Card>
    );
  }
  return (
    <Card id="publish" className="mt-8 scroll-mt-6">
      <h2 className="text-lg font-semibold">{remaining.length ? "Almost ready to publish" : "Ready to publish"}</h2>
      <SavedBy eventId={facts.eventId} area="publish" className="mt-1" />
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
      {facts.planBlock ? (
        // Say why before they try, and what they can do: not an error after the click.
        <div className="mt-5 rounded-md border border-brand/25 bg-brand-soft p-4 text-sm leading-6">
          <p className="font-semibold">Your plan doesn&apos;t allow publishing this yet</p>
          <p className="mt-1">{facts.planBlock.reason}</p>
          <p className="mt-1 text-muted">
            To upgrade or add a one-time event pass, write to us at{" "}
            <a href={`mailto:${brand.supportEmail}`} className="font-medium text-brand underline underline-offset-4">
              {brand.supportEmail}
            </a>
            . See what&apos;s included on your{" "}
            <Link href="/dashboard/account" className="font-medium text-brand underline underline-offset-4">
              Account
            </Link>{" "}
            page.
          </p>
          {facts.planBlock.other && (
            <Link
              href={`/dashboard/events/${facts.planBlock.other.id}#publish`}
              className="mt-3 inline-flex min-h-11 items-center rounded-md border border-field-border bg-surface px-4 text-sm font-semibold hover:border-brand"
            >
              Open {facts.planBlock.other.name}
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-5">
          <ActionButton action={publishAndOpen.bind(null, facts.eventId)} variant="go" pendingText="Publishing…">
            Publish event
          </ActionButton>
        </div>
      )}
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
  // The team page sends each role to where it's set up now (Edit details → Team setup, or Volunteer Setup).
  const href = (tab: string | null) => `/dashboard/events/${eventId}/team${tab ? `?tab=${tab}` : ""}`;
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counts.map((c) => (
          <div key={c.label} className="relative rounded-lg bg-background px-3 py-2 hover:ring-1 hover:ring-border">
            <dt className="text-xs text-muted">{c.label}</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {c.value}
              {/* The whole tile opens where that role is set up (Team setup, or Volunteer Setup for Coordinators). */}
              <Link href={href(c.tab)} className="absolute inset-0 rounded-lg" aria-label={`${c.label}: ${c.value}`} />
            </dd>
          </div>
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
          <p className="mt-1 text-sm text-muted">Nothing new. Every sign-up has a lead and no invitations have expired.</p>
        )}
      </div>
    </div>
  );
}

function PublicPageCard({ url, published, slug, qr }: { url: string; published: boolean; slug: string; qr: [string, string] | null }) {
  const display = url.replace(/^https?:\/\//, "");
  if (!published || !qr) {
    return (
      <Card className="text-sm leading-6">
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
      showLabel="Show QR code"
      hideLabel="Hide QR code"
      header={
        <div className="text-sm leading-6">
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
          <p className="text-muted">Share the link or QR code in emails, flyers, and slides.</p>
          <a href={qr[1]} download={`${slug}-qr.png`} className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline">
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
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-label="Volunteer spots filled" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
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
