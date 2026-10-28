import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getEventAccess, getOrigin } from "@/lib/data";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { eachDate, formatDate, formatTimeRange, utcToZonedDate } from "@/lib/time";
import { importVolunteers } from "@/app/dashboard/import-actions";
import { SpreadsheetImport } from "@/components/spreadsheet-import";
import { importFields, type Choice } from "@/lib/imports";
import { createStation, moveCheckpoint, setVolunteerSignupOpen } from "../../../actions";
import { ActionButton, CopyLinkButton, NewStationForm, type LeadOption } from "../forms";
import { StationTabs, UnsavedChangesProvider } from "./station-steps";
import { FAIR_ZONES, hasBands, hasBooths, hasRooms, leadWords } from "@/lib/event-types";
import { kindLabel, sortStations } from "@/lib/contest-day";
import { TapButton } from "../contest-day/controls";
import { StationPanel, type ItemSignup, type RosterEntry, type Shift, type Station, type StationItem } from "../station-panel";
import { SavedBy } from "@/components/saved-by";

export const metadata: Metadata = { title: "Volunteer Setup" };

type HostRow = { user_id: string; role: "owner" | "admin"; profiles: { full_name: string; email: string } | null };
type StaffRow = { user_id: string; role: "volunteer_director" | "section_lead"; profiles: { full_name: string; email: string } | null };
const roleLabel = (role: "volunteer_director" | "section_lead", type: string | null) =>
  role === "volunteer_director" ? "Volunteer Lead" : leadWords(type).one;
const HOST_LABEL = { owner: "Host", admin: "Co-host" } as const;

/** Volunteer signup and one tab per station (section) with its own shift schedule. */
export default async function VolunteeringPage({ params, searchParams }: PageProps<"/dashboard/events/[eventId]/volunteering">) {
  const { eventId } = await params;
  const { station: tab } = await searchParams;
  const access = await getEventAccess(eventId);
  if (!access.canManage) redirect(`/dashboard/events/${eventId}`);
  const user = await requireUser();
  const supabase = await createClient();

  const { data: event } = await supabase
    .from("events")
    .select("id, organization_id, slug, name, status, event_type, volunteer_signup_open, timezone, starts_on, ends_on, window_start, window_end")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();
  // Group events: the rooms, suggested as station locations.
  const { data: roomData } = hasRooms(event.event_type)
    ? await supabase.from("rooms").select("name, note").eq("event_id", eventId).order("name")
    : { data: [] };
  const locations = (roomData ?? []).map((r) => [r.name, r.note].filter(Boolean).join(" · "));

  const [{ data: stationData, error: stationsError }, { data: shiftData }, { data: staff }, { data: leadRows }, { data: hostData }, { data: inviteData }] = await Promise.all([
    supabase
      .from("stations")
      .select(
        `id, name, checkpoint_kind, checkpoint_order, due_minutes_before_warm_up, location, instructions, adults_only, lead_user_id, details_saved_at, signup_kind${hasBooths(event.event_type) ? ", zone" : ""}`,
      )
      .eq("event_id", eventId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("shifts")
      .select("id, station_id, title, description, starts_at, ends_at, max_capacity, registered_count")
      .eq("event_id", eventId)
      .order("starts_at"),
    supabase.from("event_staff").select("user_id, role, profiles(full_name, email)").eq("event_id", eventId),
    supabase.from("station_leads").select("station_id, user_id").eq("event_id", eventId).order("created_at"),
    // Only hosts can read the organization's members (co-hosts can lead stations too).
    access.isHost
      ? supabase
          .from("organization_members")
          .select("user_id, role, profiles(full_name, email)")
          .eq("organization_id", event.organization_id)
          .order("created_at")
      : Promise.resolve({ data: [] }),
    // Coordinators invited but not joined yet, shown on their sign-up.
    supabase.from("invitations").select("email, station_id").eq("event_id", eventId).eq("role", "section_lead").is("accepted_at", null),
  ]);
  // Check-in stations first, in the band's order, matching the volunteer signup page.
  // The newest columns are missing until the database update is run.
  if (stationsError) missing();
  const stations = sortStations((stationData ?? []) as unknown as Omit<Station, "lead_ids">[]).map((st) => ({
    ...st,
    lead_ids: (leadRows ?? []).filter((l) => l.station_id === st.id).map((l) => l.user_id),
  }));
  const checkpoints = stations.filter((s) => s.checkpoint_kind);

  // Fairs: zone suggestions for stations.
  const [{ data: zoneRows }, { data: boothZones }] = hasBooths(event.event_type)
    ? await Promise.all([
        supabase.from("fair_zones").select("name").eq("event_id", eventId).order("created_at"),
        supabase.from("fair_booths").select("zone").eq("event_id", eventId).not("zone", "is", null),
      ])
    : [{ data: [] }, { data: [] }];
  // The fair's zones (made on Booths & Partners), or the usual five until there are some.
  const made = [
    ...(zoneRows ?? []).map((z) => z.name),
    ...stations.map((s) => (s as { zone?: string | null }).zone),
    ...(boothZones ?? []).map((b) => b.zone),
  ].filter((z): z is string => Boolean(z));
  const zones = hasBooths(event.event_type) ? [...new Set(made.length ? made : FAIR_ZONES)] : undefined;

  const shifts = (shiftData ?? []) as Shift[];
  // Items to bring (stations without times), and for the open one, who's bringing what.
  const { data: itemData } = await supabase
    .from("station_items")
    .select("id, station_id, name, needed, claimed_count")
    .eq("event_id", eventId)
    .order("sort_order")
    .order("created_at");
  const items = (itemData ?? []) as StationItem[];
  const staffRows = (staff ?? []) as unknown as StaffRow[];
  const hosts = (hostData ?? []) as unknown as HostRow[];

  // The open tab: ?station=<id>, "new" to add one (also when there are none yet), or the first station.
  const adding = tab === "new" || stations.length === 0;
  const current = adding ? null : (stations.find((s) => s.id === tab) ?? stations[0]);
  const currentShifts = current ? shifts.filter((s) => s.station_id === current.id) : [];
  const currentItems = current ? items.filter((i) => i.station_id === current.id) : [];
  const itemSignups: ItemSignup[] | undefined =
    current?.signup_kind === "items" && currentItems.length
      ? (
          ((
            await supabase
              .from("item_signups")
              .select("id, item_id, note, volunteers(full_name, email, phone)")
              .in("item_id", currentItems.map((i) => i.id))
              .order("created_at")
          ).data ?? []) as unknown as { id: string; item_id: string; note: string | null; volunteers: { full_name: string; email: string | null; phone: string | null } | null }[]
        ).map((r) => ({
          id: r.id,
          item_id: r.item_id,
          note: r.note,
          volunteer_name: r.volunteers?.full_name ?? "A volunteer",
          email: r.volunteers?.email ?? null,
          phone: r.volunteers?.phone ?? null,
        }))
      : undefined;
  // Who's signed up, for organizers and the sign-up's own leads.
  const roster =
    current && current.signup_kind !== "items"
      ? (((await supabase.rpc("station_roster", { p_station_id: current.id })).data ?? []) as RosterEntry[])
      : undefined;

  const tz = event.timezone;
  const days = eachDate(event.starts_on, event.ends_on);
  const windowLabel = formatTimeRange(event.window_start, event.window_end, tz);
  const origin = await getOrigin();
  const signupUrl = `${origin}/e/${event.slug}/volunteer`;
  const [qrSvg, qrPng] = await Promise.all([
    QRCode.toString(signupUrl, { type: "svg", margin: 1, width: 160 }),
    QRCode.toDataURL(signupUrl, { margin: 2, width: 1024 }),
  ]);
  const filled = shifts.reduce((n, s) => n + s.registered_count, 0) + items.reduce((n, i) => n + i.claimed_count, 0);
  const capacity = shifts.reduce((n, s) => n + s.max_capacity, 0) + items.reduce((n, i) => n + i.needed, 0);

  const nameOf = (userId: string | null) => {
    if (!userId) return null;
    if (userId === user.id) return "You";
    const p = [...staffRows, ...hosts].find((s) => s.user_id === userId)?.profiles;
    return p?.full_name || p?.email || "Team member";
  };
  const leadOptions: LeadOption[] = [
    ...(access.isHost ? [{ id: user.id, label: "Me" }] : []),
    ...hosts
      .filter((h) => h.user_id !== user.id)
      .map((h) => ({ id: h.user_id, label: `${h.profiles?.full_name || h.profiles?.email || "Team member"} (${HOST_LABEL[h.role]})` })),
    ...[...new Map(staffRows.filter((s) => s.user_id !== user.id && !hosts.some((h) => h.user_id === s.user_id)).map((s) => [s.user_id, s])).values()].map((s) => ({
      id: s.user_id,
      label: `${s.profiles?.full_name || s.profiles?.email || "Team member"} (${roleLabel(s.role, event.event_type)})`,
    })),
  ];
  // Each shift as a spreadsheet might name it: "Parking 9:00–11:00 AM", "Morning Parking"…
  const multiDay = days.length > 1;
  const shiftChoices: Choice[] = shifts.map((sh) => {
    const station = stations.find((s) => s.id === sh.station_id)?.name ?? "";
    const time = formatTimeRange(sh.starts_at, sh.ends_at, tz, { zone: false });
    const day = multiDay ? `${formatDate(utcToZonedDate(sh.starts_at, tz), { year: undefined })} ` : "";
    return {
      value: sh.id,
      label: `${station}: ${sh.title} · ${day}${time}`,
      also: [sh.title, `${station} ${sh.title}`, `${station} ${time}`, `${sh.title} ${time}`, `${station} ${day}${time}`],
    };
  });
  const tabHref = (id: string) => `/dashboard/events/${eventId}/volunteering?station=${id}`;

  return (
    <div>
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Volunteer Setup</h1>
      <SavedBy eventId={eventId} area="volunteers" className="mt-2" />
      <p className="mt-1 text-sm text-muted">
        🔒 Volunteers&apos; phone numbers (and under-18 helpers) are deleted 10 days after the event. Adults&apos; names, emails, and
        how many shifts they kept stay in your Volunteer tracking for 2 years after their last event.
      </p>

      <Card className="mt-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={event.status === "published" && event.volunteer_signup_open ? "brand" : "neutral"}>
                {event.status !== "published" ? "Event not published" : event.volunteer_signup_open ? "Signup open" : "Signup closed"}
              </Badge>
              <span className="text-sm text-muted">
                {filled} of {capacity} spots filled
              </span>
            </div>
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
                  Check-in
                </Link>
                <Link
                  href={`/dashboard/events/${eventId}/volunteering/badges`}
                  className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium hover:bg-background"
                >
                  Print volunteer badges
                </Link>
              </div>
            </div>
            {event.status !== "published" ? (
              <p className="text-sm text-muted">Publish the event from its main page, then open signup here.</p>
            ) : (
              access.isHost && (
                <ActionButton
                  action={setVolunteerSignupOpen.bind(null, eventId, !event.volunteer_signup_open)}
                  variant={event.volunteer_signup_open ? "stop" : "go"}
                  confirmMessage={event.volunteer_signup_open ? "Close volunteer signup? People won't be able to sign up for shifts." : undefined}
                >
                  {event.volunteer_signup_open ? "Close volunteer signup" : "Open volunteer signup"}
                </ActionButton>
              )
            )}
          </div>
          <div className="flex flex-col items-center gap-2 self-center sm:self-start">
            <div
              className="rounded-lg border border-border bg-white p-2"
              aria-label="QR code for the signup link"
              role="img"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <a href={qrPng} download={`${event.slug}-volunteer-qr.png`} className="inline-flex min-h-11 items-center text-xs font-medium text-brand underline-offset-4 hover:underline">
              Download QR code
            </a>
          </div>
        </div>
      </Card>

      <section className="mt-10" aria-labelledby="signups-heading">
        <h2 id="signups-heading" className="text-xl font-semibold">
          Volunteer sign-ups
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Each sign-up is a job, a place, or a list of things to bring, like Parking, Concessions, or a potluck. People sign up for its time slots or its items.
        </p>
        <UnsavedChangesProvider
          key={current?.id ?? "new"}
          needsDetails={false}
          needsShifts={false}
        >
          <StationTabs
            tabs={stations.map((st) => {
              const own = shifts.filter((x) => x.station_id === st.id);
              const ownItems = items.filter((x) => x.station_id === st.id);
              return {
                id: st.id,
                name: st.name,
                href: tabHref(st.id),
                active: current?.id === st.id,
                configured: own.length + ownItems.length > 0,
                items: st.signup_kind === "items",
                filled: own.reduce((n, x) => n + x.registered_count, 0) + ownItems.reduce((n, x) => n + x.claimed_count, 0),
                capacity: own.reduce((n, x) => n + x.max_capacity, 0) + ownItems.reduce((n, x) => n + x.needed, 0),
              };
            })}
            add={{ href: tabHref("new"), active: adding }}
          />
          <div className="mt-6">
            {current ? (
              <StationPanel
                // A fresh panel per station, so its forms never keep the previous tab's choices.
                key={current.id}
                eventId={eventId}
                station={current}
                items={currentItems}
                itemSignups={itemSignups}
                stationShifts={currentShifts}
                event={event}
                days={days}
                windowLabel={windowLabel}
                userId={user.id}
                canManage
                locations={locations}
                zones={zones}
                leadNames={current.lead_ids.map((id) => nameOf(id) ?? "Team member")}
                roster={roster}
                kindLocked={
                  current.checkpoint_kind
                    ? "A check-in stop always takes time slots."
                    : current.signup_kind === "items"
                      ? currentItems.length
                        ? "To switch to time slots, first delete this sign-up's items."
                        : null
                      : currentShifts.length
                        ? "To switch to items to bring, first delete this sign-up's time slots."
                        : null
                }
                leadOptions={leadOptions}
                pendingInvites={(inviteData ?? []).filter((inv) => inv.station_id === current.id).map((inv) => inv.email)}
              />
            ) : (
              <Card>
                <h3 className="text-lg font-semibold">{stations.length ? "Add a sign-up" : "Add your first sign-up"}</h3>
                <p className="mt-1 mb-4 text-sm text-muted">Name it and choose its type. You&apos;ll add its details, Coordinators, and time slots or items next.</p>
                <NewStationForm action={createStation.bind(null, eventId)} openTab />
              </Card>
            )}
          </div>
        </UnsavedChangesProvider>

        {hasBands(event.event_type) && (
        <Card className="mt-8 p-4">
          <h3 className="text-sm font-semibold">Band check-in order</h3>
          {checkpoints.length > 0 ? (
            <>
              <p className="mt-0.5 text-sm text-muted">
                The stops each band goes through on contest day. This order sorts the sign-up tabs here and on the sign-up
                page, and is how we tell whether a band is on track.
              </p>
              <ol className="mt-3 space-y-2">
                {checkpoints.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <span className="w-5 text-sm font-semibold text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name}</span>
                      <span className="block text-xs text-muted">{kindLabel(c.checkpoint_kind!)}</span>
                    </span>
                    {i > 0 && (
                      <TapButton
                        action={moveCheckpoint.bind(null, eventId, c.id, "up")}
                        variant="ghost"
                        className="[&_button]:min-h-9 [&_button]:px-2"
                      >
                        <span aria-label={`Move ${c.name} earlier`}>↑</span>
                      </TapButton>
                    )}
                    {i < checkpoints.length - 1 && (
                      <TapButton
                        action={moveCheckpoint.bind(null, eventId, c.id, "down")}
                        variant="ghost"
                        className="[&_button]:min-h-9 [&_button]:px-2"
                      >
                        <span aria-label={`Move ${c.name} later`}>↓</span>
                      </TapButton>
                    )}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p className="mt-0.5 text-sm text-muted">
              None yet. In a station&apos;s settings, choose what kind of check-in station it is (Parking, Check-in point,
              Warm-up or Gate) to add it to the bands&apos; path.
            </p>
          )}
        </Card>
        )}

      </section>

      <section className="mt-10" aria-labelledby="import-heading">
        <h2 id="import-heading" className="text-xl font-semibold">
          Import volunteers from a spreadsheet
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          Already have sign-ups from a paper sheet or another sign-up site? Add them to their shifts here. One row per
          person per shift; people who share an email are signed up together, on the same shifts. A full shift makes
          room for them.
        </p>
        <Card>
          {shifts.length === 0 ? (
            <p className="text-sm">
              Add a sign-up and its shifts above first. Each volunteer you import goes onto one of your shifts.
            </p>
          ) : (
            <SpreadsheetImport
              kind="volunteers"
              fields={importFields("volunteers")}
              choices={{ shift: shiftChoices }}
              noun={{ one: "sign-up", many: "sign-ups" }}
              templateName="volunteers.csv"
              emailOption="Email each volunteer a confirmation with their shifts and a calendar invite"
              action={importVolunteers.bind(null, eventId)}
            />
          )}
        </Card>
      </section>
    </div>
  );
}
