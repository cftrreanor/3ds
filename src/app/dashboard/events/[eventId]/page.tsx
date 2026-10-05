import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getEventAccess, getOrigin } from "@/lib/data";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import {
  eachDate,
  formatDate,
  formatDateRange,
  formatTimeRange,
  utcToZonedDate,
  zoneName,
} from "@/lib/time";
import { setEventPublished } from "../../actions";
import { cancelInvitation, inviteMember, removeMember } from "../../team-actions";
import { ActionButton, CopyLinkButton, DeleteButton, InviteForm, RemoveButton, type LeadOption } from "./forms";
import { StationPanel, type RosterEntry, type Shift } from "./station-panel";

export const metadata: Metadata = { title: "Event setup" };

type Person = { full_name: string; email: string; phone: string | null } | null;
type StaffRow = { user_id: string; role: "volunteer_director" | "section_lead"; profiles: Person };
type Invitation = {
  id: string;
  email: string;
  role: "volunteer_director" | "section_lead";
  station_id: string | null;
  token: string;
  expires_at: string;
};

const ROLE_LABEL = { volunteer_director: "Volunteer Director", section_lead: "Section Lead" } as const;

export default async function EventPage({ params }: PageProps<"/dashboard/events/[eventId]">) {
  const { eventId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, slug, name, status, volunteer_signup_open, timezone, starts_on, ends_on, window_start, window_end, venue_name, venue_address, venue_place_id",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();

  const access = await getEventAccess(eventId);
  const [{ data: stations }, { data: shifts }, { data: staff }, { data: invitations }, { data: bandData }] = await Promise.all([
    supabase
      .from("stations")
      .select("id, name, station_type, location, instructions, lead_user_id")
      .eq("event_id", eventId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("shifts")
      .select("id, station_id, title, description, starts_at, ends_at, max_capacity, registered_count")
      .eq("event_id", eventId)
      .order("starts_at"),
    supabase.from("event_staff").select("user_id, role, profiles(full_name, email, phone)").eq("event_id", eventId),
    access.canManage
      ? supabase
          .from("invitations")
          .select("id, email, role, station_id, token, expires_at")
          .eq("event_id", eventId)
          .is("accepted_at", null)
          .order("created_at")
      : Promise.resolve({ data: [] as Invitation[] }),
    access.canManage
      ? supabase
          .from("bands")
          .select("classification, student_count, chaperone_count, bus_count, box_truck_count, truck_trailer_count, semi_truck_count")
          .eq("event_id", eventId)
      : Promise.resolve({ data: [] }),
  ]);
  const bands = (bandData ?? []) as BandTotals[];

  const tz = event.timezone;
  const days = eachDate(event.starts_on, event.ends_on);
  const multiDay = days.length > 1;
  const windowLabel = formatTimeRange(event.window_start, event.window_end, tz);
  const origin = await getOrigin();

  const signedUp = (shifts ?? []).reduce((n, s) => n + s.registered_count, 0);

  // Section Leads see their own station's roster; contact details are
  // released by the database only on event day.
  const myStations = (stations ?? []).filter((s) => s.lead_user_id === user.id);
  const rosters = new Map<string, RosterEntry[]>(
    await Promise.all(
      myStations.map(async (s) => {
        const { data } = await supabase.rpc("station_roster", { p_station_id: s.id });
        return [s.id, (data ?? []) as RosterEntry[]] as const;
      }),
    ),
  );

  const shiftsByStation = new Map<string, Shift[]>();
  for (const s of (shifts ?? []) as Shift[]) {
    shiftsByStation.set(s.station_id, [...(shiftsByStation.get(s.station_id) ?? []), s]);
  }
  const totalSlots = (shifts ?? []).reduce((n, s) => n + s.max_capacity, 0);
  const staffRows = (staff ?? []) as unknown as StaffRow[];
  const directors = staffRows.filter((s) => s.role === "volunteer_director");
  const leads = staffRows.filter((s) => s.role === "section_lead");
  const nameOf = (userId: string | null) => {
    if (!userId) return null;
    if (userId === user.id) return "You";
    const p = staffRows.find((s) => s.user_id === userId)?.profiles;
    return p?.full_name || p?.email || "Team member";
  };
  const leadOptions: LeadOption[] = [
    ...(access.isHost ? [{ id: user.id, label: "Me" }] : []),
    ...[...new Map(staffRows.filter((s) => s.user_id !== user.id).map((s) => [s.user_id, s])).values()].map((s) => ({
      id: s.user_id,
      label: `${s.profiles?.full_name || s.profiles?.email || "Team member"} (${ROLE_LABEL[s.role]})`,
    })),
  ];
  const stationName = (id: string | null) => stations?.find((s) => s.id === id)?.name;
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
          <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
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

      {access.canManage && (
        <section className="mt-10" aria-labelledby="team-heading">
          <h2 id="team-heading" className="text-lg font-semibold">
            Team
          </h2>
          <Card className="mt-4 space-y-6">
            <div>
              <h3 className="text-sm font-semibold">Volunteer Director</h3>
              {directors.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {directors.map((d) => (
                    <PersonRow key={d.user_id} person={d.profiles} isYou={d.user_id === user.id}>
                      {access.isHost && (
                        <RemoveButton
                          action={removeMember.bind(null, eventId, d.user_id, d.role)}
                          label="Remove Volunteer Director"
                          confirmMessage="Remove this Volunteer Director from the event?"
                        />
                      )}
                    </PersonRow>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm leading-6 text-muted">
                  {access.isHost
                    ? "You're running volunteers yourself as the host. Larger clubs can invite a separate Volunteer Director below."
                    : "The host is running volunteers."}
                </p>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold">Section Leads</h3>
              {leads.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {leads.map((l) => {
                    const led = (stations ?? []).filter((s) => s.lead_user_id === l.user_id).map((s) => s.name);
                    return (
                      <PersonRow
                        key={l.user_id}
                        person={l.profiles}
                        isYou={l.user_id === user.id}
                        detail={led.length ? `Leads ${led.join(", ")}` : "No station yet"}
                      >
                        <RemoveButton
                          action={removeMember.bind(null, eventId, l.user_id, l.role)}
                          label="Remove Section Lead"
                          confirmMessage="Remove this Section Lead from the event? They'll be taken off their stations."
                        />
                      </PersonRow>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted">
                  None yet. Section Leads run a station on the day, like the Parking lead.
                </p>
              )}
            </div>

            {(invitations ?? []).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold">Waiting to accept</h3>
                <ul className="mt-2 space-y-2">
                  {(invitations as Invitation[]).map((inv) => (
                    <li
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{inv.email}</p>
                        <p className="text-sm text-muted">
                          {ROLE_LABEL[inv.role]}
                          {inv.station_id && stationName(inv.station_id) ? ` · ${stationName(inv.station_id)}` : ""}
                          {new Date(inv.expires_at) < new Date() ? " · Expired" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <CopyLinkButton url={`${origin}/invite/${inv.token}`} />
                        {(access.isHost || inv.role === "section_lead") && (
                          <DeleteButton
                            action={cancelInvitation.bind(null, eventId, inv.id)}
                            label={`Cancel invitation for ${inv.email}`}
                            confirmMessage={`Cancel the invitation for ${inv.email}?`}
                            text="Cancel"
                          />
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <details className="rounded-lg border border-border px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">Invite someone</summary>
              <div className="mt-4 space-y-4">
                <p className="text-sm leading-6 text-muted">
                  We&apos;ll create a private link. Send it to them by text or email; they sign in with the
                  email you enter here to join.
                </p>
                <InviteForm
                  action={inviteMember.bind(null, eventId)}
                  roles={
                    access.isHost
                      ? [
                          { value: "section_lead", label: "Section Lead" },
                          { value: "volunteer_director", label: "Volunteer Director" },
                        ]
                      : [{ value: "section_lead", label: "Section Lead" }]
                  }
                  stations={(stations ?? []).map((s) => ({ id: s.id, name: s.name }))}
                />
              </div>
            </details>
          </Card>
        </section>
      )}

      {access.canManage && (
        <section className="mt-10" aria-labelledby="bands-heading">
          <h2 id="bands-heading" className="text-lg font-semibold">
            Band registration
          </h2>
          <Card className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm leading-6 text-muted">
                {bands.length
                  ? `${bands.length} band${bands.length === 1 ? "" : "s"} registered.`
                  : "No bands registered yet."}{" "}
                Registration, the performance schedule and finals.
              </p>
              <Link
                href={`/dashboard/events/${eventId}/bands`}
                className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
              >
                Manage bands
              </Link>
            </div>
            {bands.length > 0 && <LogisticsTotals bands={bands} />}
          </Card>
        </section>
      )}

      {access.canManage && (
        <section className="mt-10" aria-labelledby="volunteers-heading">
          <h2 id="volunteers-heading" className="text-lg font-semibold">
            Volunteer registration
          </h2>
          <Card className="mt-4 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={event.status === "published" && event.volunteer_signup_open ? "brand" : "neutral"}>
                  {event.status !== "published" ? "Event not published" : event.volunteer_signup_open ? "Signup open" : "Signup closed"}
                </Badge>
                <span className="text-sm text-muted">
                  {(stations ?? []).length} station{(stations ?? []).length === 1 ? "" : "s"} · {(shifts ?? []).length} shift
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

      {!access.canManage && myStations.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Your stations</h2>
          <div className="mt-4 space-y-6">
            {myStations.map((station) => (
              <StationPanel
                key={station.id}
                eventId={eventId}
                station={station}
                stationShifts={shiftsByStation.get(station.id) ?? []}
                event={event}
                days={days}
                windowLabel={windowLabel}
                userId={user.id}
                canManage={false}
                leadName={nameOf(station.lead_user_id)}
                leadOptions={leadOptions}
                roster={rosters.get(station.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function PersonRow({
  person,
  isYou,
  detail,
  children,
}: {
  person: Person;
  isYou: boolean;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {person?.full_name || person?.email || "Team member"}
          {isYou && <span className="font-normal text-muted"> (you)</span>}
        </p>
        <p className="text-sm text-muted">
          {[person?.email, formatPhone(person?.phone), detail].filter(Boolean).join(" · ")}
        </p>
      </div>
      {children}
    </li>
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
