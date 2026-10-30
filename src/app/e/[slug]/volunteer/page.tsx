import type { Metadata } from "next";
import { EventHeaderBar, EventHeading } from "@/components/event-brand";
import { loadEventBrand } from "@/lib/event-brand";
import Link from "next/link";
import { Card } from "@/components/ui";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange, formatTimeRange, utcToZonedDate, zoneName } from "@/lib/time";
import { currentSpots, signUpVolunteer } from "./actions";
import { eventPhase, sortStations } from "@/lib/contest-day";
import { hasBooths, leadWords } from "@/lib/event-types";
import { SignupForm, type PublicStation } from "./signup-form";
import { getEventAccess } from "@/lib/data";
import { EyeOffIcon } from "@/components/eye-off-icon";

type Params = { params: Promise<{ slug: string }> };
type PageProps = Params & { searchParams: Promise<{ preview?: string }> };

async function loadEvent(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, status, event_type, timezone, starts_on, ends_on, venue_name, venue_address, venue_place_id, volunteer_signup_open, public_notes")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const event = await loadEvent((await params).slug);
  return { title: event ? `Volunteer: ${event.name}` : "Volunteer sign-up" };
}

export default async function VolunteerSignupPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const preview = (await searchParams).preview === "1";
  const event = await loadEvent(slug);
  if (!event) missing();

  const supabase = await createClient();
  const [{ data: stations }, { data: shifts }, { data: items }, { data: board }] = await Promise.all([
    supabase
      .from("stations")
      // Every column: showing arrives with the 20270105000000 update.
      .select("*")
      .eq("event_id", event.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("shifts")
      // Every column: adults_only and min_age arrive with the 20270102000000 update, and the page works without them.
      .select("*")
      .eq("event_id", event.id)
      .order("starts_at"),
    supabase.from("station_items").select("id, station_id, name, needed, claimed_count").eq("event_id", event.id).order("sort_order").order("created_at"),
    // Who's bringing what: first names and notes only.
    supabase.rpc("public_item_board", { p_event_id: event.id }),
  ]);
  const coming = (board ?? []) as { item_id: string; first_name: string; note: string | null }[];
  // Only jobs volunteers can sign up for. (Signed-in hosts and Coordinators can read hidden
  // jobs too; they preview those elsewhere, never mixed into the real page.)
  const showing = (stations ?? []).filter((st) => (st as { showing?: boolean }).showing !== false);
  // The team's preview (?preview=1): hidden jobs too, set apart, for the people the database lets read them.
  const hidden = preview ? sortStations((stations ?? []).filter((st) => (st as { showing?: boolean }).showing === false)) : [];
  const canEdit = hidden.length > 0 && (await getEventAccess(event.id)).canManage;

  const tz = event.timezone;
  const nowIso = new Date().toISOString();
  const multiDay = event.starts_on !== event.ends_on;
  // Check-in stations first, in the host's order: they matter most on the day.
  const publicStations: PublicStation[] = sortStations(showing)
    .map((st) => ({
      // Only what the form shows (the query reads every column).
      id: st.id,
      name: st.name,
      location: st.location,
      instructions: st.instructions,
      adults_only: st.adults_only,
      // An items station takes things to bring, never time slots.
      // Shifts that haven't ended (a hidden job's preview below lists all of its own).
      shifts: (st.signup_kind === "items" ? [] : (shifts ?? []))
        .filter((s) => s.station_id === st.id && s.ends_at > nowIso)
        .map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          when: `${multiDay ? `${formatDate(utcToZonedDate(s.starts_at, tz), { year: undefined })} · ` : ""}${formatTimeRange(s.starts_at, s.ends_at, tz)}`,
          startsAt: s.starts_at,
          endsAt: s.ends_at,
          spotsLeft: s.max_capacity - s.registered_count,
          adultsOnly: st.adults_only || Boolean((s as { adults_only?: boolean }).adults_only),
          minAge: (s as { min_age?: number | null }).min_age ?? null,
        })),
      items: (items ?? [])
        .filter((i) => i.station_id === st.id)
        .map((i) => ({
          id: i.id,
          name: i.name,
          left: i.needed - i.claimed_count,
          needed: i.needed,
          coming: coming.filter((c) => c.item_id === i.id).map((c) => (c.note ? `${c.first_name} (${c.note})` : c.first_name)),
        })),
    }))
    .filter((st) => st.shifts.length > 0 || st.items.length > 0);

  // On fair day, volunteers who show up are added at the volunteer desk instead.
  const fairDay = hasBooths(event.event_type) && eventPhase(event, new Date()) === "day";
  const isOpen = event.status === "published" && event.volunteer_signup_open && !fairDay;
  const mapUrl = `https://www.google.com/maps/search/?${new URLSearchParams({
    api: "1",
    query: event.venue_address,
    ...(event.venue_place_id ? { query_place_id: event.venue_place_id } : {}),
  })}`;

  // With the account's color, the event name sits on a full-width band of it.
  const band = !!(await loadEventBrand(slug)).color;
  const heading = (
    <EventHeading band={band} eyebrow="Volunteer sign-up" title={event.name}>
      <p className="mt-2 text-muted">
        {formatDateRange(event.starts_on, event.ends_on)} · All times {zoneName(tz)}
      </p>
      <p className="mt-1 text-muted">
        {[event.venue_name, event.venue_address].filter(Boolean).join(" · ")} ·{" "}
        <a href={mapUrl} target="_blank" rel="noreferrer" className="font-medium text-brand underline-offset-4 hover:underline">
          Map
        </a>
      </p>
      {event.public_notes && <p className="mt-4 leading-7">{event.public_notes}</p>}
    </EventHeading>
  );

  return (
    <>
    {hidden.length > 0 && (
      <div className="border-b border-warning/40 bg-warning-soft print:hidden">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
          <p>
            <span className="font-semibold">Preview only.</span> Volunteers can&apos;t see hidden jobs (dashed).
          </p>
          {canEdit && (
            <Link
              href={`/dashboard/events/${event.id}/volunteering`}
              className="inline-flex min-h-11 items-center rounded-md border border-field-border bg-surface px-4 font-semibold hover:border-brand"
            >
              Back to jobs
            </Link>
          )}
        </div>
      </div>
    )}
    <EventHeaderBar slug={slug} />
    {band && heading}
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      {!band && heading}

      {!isOpen && (
        <Card className="mt-8 bg-brand-soft">
          <p className="font-medium">
            {fairDay
              ? "Online sign-up is closed on fair day."
              : event.status === "published"
                ? "Volunteer sign-up is closed."
                : "Preview: this page isn't public yet."}
          </p>
          <p className="mt-1 text-sm text-muted">
            {fairDay
              ? "Want to help today? Find the volunteer desk at the fair, and they'll add you to a shift."
              : event.status === "published"
                ? "Please contact the event organizers if you'd like to help."
              : "Only your team can see it. Publish the event and open volunteer sign-up to start taking sign-ups."}
          </p>
        </Card>
      )}

      {hidden.length > 0 && (
        <ul className="mt-8 space-y-4" aria-label="Hidden jobs">
          {hidden.map((st) => {
            const own = st.signup_kind === "items" ? [] : (shifts ?? []).filter((s) => s.station_id === st.id);
            const things = (items ?? []).filter((i) => i.station_id === st.id);
            return (
              <li key={st.id} className="rounded-lg border-2 border-dashed border-warning/60 p-4 sm:p-5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold">
                  <EyeOffIcon className="size-3.5" />
                  Hidden from volunteers
                </span>
                <p className="mt-2 font-semibold">{st.name}</p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {own.map((s) => (
                    <li key={s.id}>
                      {multiDay && `${formatDate(utcToZonedDate(s.starts_at, tz), { year: undefined })} · `}
                      {formatTimeRange(s.starts_at, s.ends_at, tz)} · {s.max_capacity} {s.max_capacity === 1 ? "spot" : "spots"}
                    </li>
                  ))}
                  {things.map((i) => (
                    <li key={i.id}>
                      {i.name} · {i.needed} needed
                    </li>
                  ))}
                  {own.length + things.length === 0 && <li className="text-muted">{st.signup_kind === "items" ? "No things to bring yet" : "No shifts yet"}</li>}
                </ul>
                {canEdit && (
                  <Link
                    href={`/dashboard/events/${event.id}/volunteering?station=${st.id}`}
                    className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand underline underline-offset-4"
                  >
                    Edit {st.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8">
        {publicStations.length === 0 ? (
          <Card>
            <p className="text-muted">{hidden.length ? "No jobs are showing to volunteers yet." : "Nothing is open for sign-up right now."}</p>
          </Card>
        ) : (
          <SignupForm
            action={signUpVolunteer.bind(null, event.id)}
            spots={currentSpots.bind(null, event.id)}
            stations={publicStations}
            // The team's preview never takes real sign-ups, even on a live event.
            disabled={!isOpen || hidden.length > 0}
            lead={leadWords(event.event_type).one}
          />
        )}
      </div>

      <p className="mt-10 text-center text-sm text-muted">
        Already signed up?{" "}
        <Link href="/my" className="font-medium text-brand underline-offset-4 hover:underline">
          Go to My volunteering
        </Link>
      </p>
    </main>
    </>
  );
}
