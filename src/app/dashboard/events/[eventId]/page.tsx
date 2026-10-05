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
  utcToZonedTime,
  zoneName,
} from "@/lib/time";
import QRCode from "qrcode";
import {
  createShift,
  createStation,
  deleteShift,
  deleteStation,
  generateShifts,
  setEventPublished,
  setVolunteerSignupOpen,
  updateShift,
  updateStation,
} from "../../actions";
import { cancelInvitation, inviteMember, removeMember } from "../../team-actions";
import {
  ActionButton,
  CopyLinkButton,
  DeleteButton,
  GenerateShiftsForm,
  InviteForm,
  RemoveButton,
  ShiftForm,
  StationForm,
  type LeadOption,
} from "./forms";

export const metadata: Metadata = { title: "Event setup" };

type Shift = {
  id: string;
  station_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  max_capacity: number;
  registered_count: number;
};

type RosterEntry = {
  assignment_id: string;
  shift_id: string;
  volunteer_name: string;
  email: string | null;
  phone: string | null;
  checked_in_at: string | null;
  contact_locked: boolean;
};

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
  const [{ data: stations }, { data: shifts }, { data: staff }, { data: invitations }] = await Promise.all([
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
  ]);

  const tz = event.timezone;
  const days = eachDate(event.starts_on, event.ends_on);
  const multiDay = days.length > 1;
  const windowLabel = formatTimeRange(event.window_start, event.window_end, tz);
  const origin = await getOrigin();

  const signupUrl = `${origin}/e/${event.slug}/volunteer`;
  const [qrSvg, qrPng] = access.canManage
    ? await Promise.all([
        QRCode.toString(signupUrl, { type: "svg", margin: 1, width: 160 }),
        QRCode.toDataURL(signupUrl, { margin: 2, width: 1024 }),
      ])
    : ["", ""];
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
        </div>
        <div className="flex flex-col items-end gap-2">
          <Badge tone={event.status === "published" ? "brand" : "neutral"}>
            {event.status === "published" ? "Published" : "Draft: only your team can see this"}
          </Badge>
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
        <section className="mt-10" aria-labelledby="share-heading">
          <h2 id="share-heading" className="text-lg font-semibold">
            Volunteer signup
          </h2>
          <Card className="mt-4">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={event.status === "published" && event.volunteer_signup_open ? "brand" : "neutral"}>
                    {event.status !== "published"
                      ? "Not published"
                      : event.volunteer_signup_open
                        ? "Signup open"
                        : "Signup closed"}
                  </Badge>
                  <span className="text-sm text-muted">
                    {signedUp} of {totalSlots} spots filled
                  </span>
                </div>

                {access.isHost && (
                  <div className="flex flex-wrap gap-2">
                    {event.status !== "published" ? (
                      <ActionButton action={setEventPublished.bind(null, eventId, true)} pendingText="Publishing…">
                        Publish event
                      </ActionButton>
                    ) : (
                      <>
                        <ActionButton
                          action={setVolunteerSignupOpen.bind(null, eventId, !event.volunteer_signup_open)}
                          variant={event.volunteer_signup_open ? "secondary" : "primary"}
                        >
                          {event.volunteer_signup_open ? "Close volunteer signup" : "Open volunteer signup"}
                        </ActionButton>
                        <ActionButton
                          action={setEventPublished.bind(null, eventId, false)}
                          variant="secondary"
                          confirmMessage="Unpublish? The public pages will be hidden and signup will close."
                        >
                          Unpublish
                        </ActionButton>
                      </>
                    )}
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium">Signup link</p>
                  <p className="mt-1 break-all text-sm text-muted">{signupUrl}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <CopyLinkButton url={signupUrl} label="Copy link" />
                    <a
                      href={`/e/${event.slug}/volunteer`}
                      target="_blank"
                      className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium hover:bg-background"
                    >
                      Preview page
                    </a>
                    <Link
                      href={`/dashboard/events/${eventId}/volunteers`}
                      className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium hover:bg-background"
                    >
                      Volunteers &amp; check-in
                    </Link>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-2 self-center sm:self-start">
                <div
                  className="rounded-lg border border-border bg-white p-2"
                  aria-label="QR code for the signup link"
                  role="img"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <a
                  href={qrPng}
                  download={`${event.slug}-volunteer-qr.png`}
                  className="text-xs font-medium text-brand underline-offset-4 hover:underline"
                >
                  Download QR code
                </a>
              </div>
            </div>
          </Card>
        </section>
      )}

      {access.canManage && (
        <section className="mt-10" aria-labelledby="bands-heading">
          <h2 id="bands-heading" className="text-lg font-semibold">
            Bands
          </h2>
          <Card className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm leading-6 text-muted">
              Band registration, logistics totals, and the performance order.
            </p>
            <Link
              href={`/dashboard/events/${eventId}/bands`}
              className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
            >
              Manage bands
            </Link>
          </Card>
        </section>
      )}

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

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold">Stations &amp; volunteer shifts</h2>
          {totalSlots > 0 && (
            <p className="text-sm text-muted">
              {stations?.length} station{stations?.length === 1 ? "" : "s"} · {shifts?.length} shifts ·{" "}
              {totalSlots} volunteer slots
            </p>
          )}
        </div>

        {(stations ?? []).length === 0 && (
          <p className="mt-2 max-w-2xl leading-7 text-muted">
            A station is a place or job volunteers are assigned to, like Parking, Concessions or a Warm-Up
            area.{access.canManage && " Add your first one below, then create its shifts."}
          </p>
        )}

        <div className="mt-6 space-y-6">
          {(stations ?? []).map((station) => {
            const stationShifts = shiftsByStation.get(station.id) ?? [];
            const leadName = nameOf(station.lead_user_id);
            return (
              <Card key={station.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{station.name}</h3>
                      {station.station_type === "active_checkpoint" && <Badge tone="accent">Band checkpoint</Badge>}
                      {station.lead_user_id === user.id && <Badge tone="brand">You lead this</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {[station.location, leadName ? `Lead: ${leadName}` : access.canManage ? "No lead yet" : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {access.canManage && (
                    <DeleteButton
                      action={deleteStation.bind(null, eventId, station.id)}
                      label={`Delete station ${station.name}`}
                      confirmMessage={`Delete “${station.name}” and all of its shifts?`}
                    />
                  )}
                </div>

                {stationShifts.length > 0 ? (
                  <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                    {stationShifts.map((s) => (
                      <li key={s.id} className="px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{s.title}</p>
                            <p className="text-sm text-muted">
                              {multiDay && `${formatDate(utcToZonedDate(s.starts_at, tz), { year: undefined })} · `}
                              {formatTimeRange(s.starts_at, s.ends_at, tz)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <span className="mr-1 text-sm tabular-nums text-muted">
                              {s.registered_count} / {s.max_capacity} filled
                            </span>
                            {access.canManage && (
                              <DeleteButton
                                action={deleteShift.bind(null, eventId, s.id)}
                                label={`Delete shift ${s.title}`}
                                confirmMessage={`Delete “${s.title}”?`}
                              />
                            )}
                          </div>
                        </div>
                        {access.canManage && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground">
                              Edit shift
                            </summary>
                            <div className="mt-3 pb-1">
                              <ShiftForm
                                action={updateShift.bind(null, eventId, s.id)}
                                days={days}
                                registered={s.registered_count}
                                submitLabel="Save shift"
                                initial={{
                                  title: s.title,
                                  day: utcToZonedDate(s.starts_at, tz),
                                  startTime: utcToZonedTime(s.starts_at, tz),
                                  endTime: utcToZonedTime(s.ends_at, tz),
                                  capacity: s.max_capacity,
                                  description: s.description,
                                }}
                              />
                            </div>
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-muted">No shifts yet.</p>
                )}

                {rosters.has(station.id) && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold">Your volunteers</h4>
                    {rosters.get(station.id)!.length === 0 ? (
                      <p className="mt-1 text-sm text-muted">No one has signed up yet.</p>
                    ) : (
                      <>
                        {rosters.get(station.id)![0].contact_locked && (
                          <p className="mt-1 text-sm text-muted">
                            Phone numbers and emails unlock on event day ({formatDateRange(event.starts_on, event.ends_on)}).
                          </p>
                        )}
                        <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
                          {rosters.get(station.id)!.map((v) => {
                            const shift = stationShifts.find((s) => s.id === v.shift_id);
                            return (
                              <li key={v.assignment_id} className="flex items-center justify-between gap-3 px-3 py-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{v.volunteer_name}</p>
                                  <p className="truncate text-sm text-muted">
                                    {shift ? formatTimeRange(shift.starts_at, shift.ends_at, tz) : ""}
                                    {v.phone && (
                                      <>
                                        {" · "}
                                        <a href={`tel:${v.phone}`} className="font-medium text-brand hover:underline">
                                          {formatPhone(v.phone)}
                                        </a>
                                      </>
                                    )}
                                  </p>
                                </div>
                                <span className="shrink-0 text-sm">
                                  {v.checked_in_at ? "✓ Arrived" : <span className="text-muted">Not yet</span>}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    )}
                  </div>
                )}

                {access.canManage && (
                  <div className="mt-4 flex flex-col gap-3">
                    <details className="rounded-lg border border-border px-4 py-3" open={stationShifts.length === 0}>
                      <summary className="cursor-pointer text-sm font-medium">Fill the day with shifts</summary>
                      <div className="mt-4">
                        <GenerateShiftsForm
                          action={generateShifts.bind(null, eventId, station.id)}
                          windowLabel={windowLabel}
                        />
                      </div>
                    </details>
                    <details className="rounded-lg border border-border px-4 py-3">
                      <summary className="cursor-pointer text-sm font-medium">Add a single shift</summary>
                      <div className="mt-4">
                        <ShiftForm action={createShift.bind(null, eventId, station.id)} days={days} />
                      </div>
                    </details>
                    <details className="rounded-lg border border-border px-4 py-3">
                      <summary className="cursor-pointer text-sm font-medium">Edit station &amp; lead</summary>
                      <div className="mt-4">
                        <StationForm
                          action={updateStation.bind(null, eventId, station.id)}
                          initial={station}
                          leads={leadOptions}
                          submitLabel="Save station"
                        />
                      </div>
                    </details>
                  </div>
                )}
              </Card>
            );
          })}

          {access.canManage && (
            <Card className="border-dashed">
              <h3 className="mb-4 font-semibold">Add a station</h3>
              <StationForm action={createStation.bind(null, eventId)} />
            </Card>
          )}
        </div>
      </section>
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
