import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getEventAccess, getOrigin } from "@/lib/data";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { eachDate, formatTimeRange } from "@/lib/time";
import { createStation, setVolunteerSignupOpen } from "../../../actions";
import { ActionButton, CopyLinkButton, StationForm, type LeadOption } from "../forms";
import { StationPanel, type RosterEntry, type Shift, type Station } from "../station-panel";

export const metadata: Metadata = { title: "Volunteer Registration" };

type HostRow = { user_id: string; role: "owner" | "admin"; profiles: { full_name: string; email: string } | null };
type StaffRow = { user_id: string; role: "volunteer_director" | "section_lead"; profiles: { full_name: string; email: string } | null };
const ROLE_LABEL = { volunteer_director: "Volunteer Lead", section_lead: "Section Lead" } as const;
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
    .select("id, organization_id, slug, name, status, volunteer_signup_open, timezone, starts_on, ends_on, window_start, window_end")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) missing();

  const [{ data: stationData }, { data: shiftData }, { data: staff }, { data: leadRows }, { data: hostData }] = await Promise.all([
    supabase
      .from("stations")
      .select("id, name, station_type, duties, location, instructions, lead_user_id")
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
  ]);
  // Check-in (band checkpoint) stations first, matching the volunteer signup page.
  const stations = ((stationData ?? []) as Omit<Station, "lead_ids">[])
    .map((st) => ({ ...st, lead_ids: (leadRows ?? []).filter((l) => l.station_id === st.id).map((l) => l.user_id) }))
    .sort((a, b) => Number(b.station_type === "active_checkpoint") - Number(a.station_type === "active_checkpoint"));
  const shifts = (shiftData ?? []) as Shift[];
  const staffRows = (staff ?? []) as unknown as StaffRow[];
  const hosts = (hostData ?? []) as unknown as HostRow[];

  // The open tab: ?station=<id>, "new" to add one, or the first station.
  const current = tab === "new" || stations.length === 0 ? null : (stations.find((s) => s.id === tab) ?? stations[0]);
  const currentShifts = current ? shifts.filter((s) => s.station_id === current.id) : [];
  const roster =
    current && current.lead_ids.includes(user.id)
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
  const filled = shifts.reduce((n, s) => n + s.registered_count, 0);
  const capacity = shifts.reduce((n, s) => n + s.max_capacity, 0);

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
      label: `${s.profiles?.full_name || s.profiles?.email || "Team member"} (${ROLE_LABEL[s.role]})`,
    })),
  ];
  const tabHref = (id: string) => `/dashboard/events/${eventId}/volunteering?station=${id}`;

  return (
    <div>
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Volunteer Registration</h1>

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
            <a href={qrPng} download={`${event.slug}-volunteer-qr.png`} className="text-xs font-medium text-brand underline-offset-4 hover:underline">
              Download QR code
            </a>
          </div>
        </div>
      </Card>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Stations &amp; shifts</h2>
        <p className="mt-1 text-sm text-muted">
          Each station is a place or job volunteers are assigned to, like Parking or Concessions, with its own shift schedule.
        </p>

        <nav aria-label="Stations" className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <ul className="flex min-w-max gap-1 border-b border-border">
            {stations.map((s) => {
              const st = shifts.filter((x) => x.station_id === s.id);
              const f = st.reduce((n, x) => n + x.registered_count, 0);
              const c = st.reduce((n, x) => n + x.max_capacity, 0);
              const active = current?.id === s.id;
              return (
                <li key={s.id}>
                  <Link
                    href={tabHref(s.id)}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={`-mb-px flex flex-col border-b-2 px-4 py-2 text-sm ${
                      active ? "border-brand font-semibold text-foreground" : "border-transparent text-muted hover:text-foreground"
                    }`}
                  >
                    <span className="whitespace-nowrap">{s.name}</span>
                    <span className="text-xs font-normal tabular-nums text-muted">{c ? `${f}/${c} filled` : "No shifts"}</span>
                  </Link>
                </li>
              );
            })}
            <li>
              <Link
                href={tabHref("new")}
                scroll={false}
                aria-current={!current ? "page" : undefined}
                className={`-mb-px flex h-full items-center border-b-2 px-4 py-2 text-sm font-medium ${
                  !current ? "border-brand text-foreground" : "border-transparent text-brand hover:text-foreground"
                }`}
              >
                + Add station
              </Link>
            </li>
          </ul>
        </nav>

        <div className="mt-6">
          {current ? (
            <StationPanel
              eventId={eventId}
              station={current}
              stationShifts={currentShifts}
              event={event}
              days={days}
              windowLabel={windowLabel}
              userId={user.id}
              canManage
              leadNames={current.lead_ids.map((id) => nameOf(id) ?? "Team member")}
              leadOptions={leadOptions}
              roster={roster}
            />
          ) : (
            <Card>
              <h3 className="mb-1 font-semibold">Add a station</h3>
              <p className="mb-4 text-sm text-muted">
                {stations.length === 0
                  ? "Start with your first station, like Parking, Concessions or a Warm-Up area. You'll set up its shifts next."
                  : "It gets its own tab and shift schedule."}
              </p>
              <StationForm action={createStation.bind(null, eventId)} />
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
