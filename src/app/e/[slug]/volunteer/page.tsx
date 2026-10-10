import type { Metadata } from "next";
import { HeaderBar } from "@/components/logo";
import Link from "next/link";
import { Card } from "@/components/ui";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange, formatTimeRange, utcToZonedDate, zoneName } from "@/lib/time";
import { signUpVolunteer } from "./actions";
import { sortStations } from "@/lib/contest-day";
import { SignupForm, type PublicStation } from "./signup-form";

type Params = { params: Promise<{ slug: string }> };

async function loadEvent(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, status, timezone, starts_on, ends_on, venue_name, venue_address, venue_place_id, volunteer_signup_open, public_notes")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const event = await loadEvent((await params).slug);
  return { title: event ? `Volunteer: ${event.name}` : "Volunteer signup" };
}

export default async function VolunteerSignupPage({ params }: Params) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) missing();

  const supabase = await createClient();
  const [{ data: stations }, { data: shifts }] = await Promise.all([
    supabase
      .from("stations")
      .select("id, name, checkpoint_order, location, instructions, adults_only")
      .eq("event_id", event.id)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("shifts")
      .select("id, station_id, title, description, starts_at, ends_at, max_capacity, registered_count")
      .eq("event_id", event.id)
      .gt("ends_at", new Date().toISOString())
      .order("starts_at"),
  ]);

  const tz = event.timezone;
  const multiDay = event.starts_on !== event.ends_on;
  // Check-in stations first, in the host's order: they matter most on the day.
  const publicStations: PublicStation[] = sortStations(stations ?? [])
    .map((st) => ({
      ...st,
      shifts: (shifts ?? [])
        .filter((s) => s.station_id === st.id)
        .map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          when: `${multiDay ? `${formatDate(utcToZonedDate(s.starts_at, tz), { year: undefined })} · ` : ""}${formatTimeRange(s.starts_at, s.ends_at, tz)}`,
          spotsLeft: s.max_capacity - s.registered_count,
        })),
    }))
    .filter((st) => st.shifts.length > 0);

  const isOpen = event.status === "published" && event.volunteer_signup_open;
  const mapUrl = `https://www.google.com/maps/search/?${new URLSearchParams({
    api: "1",
    query: event.venue_address,
    ...(event.venue_place_id ? { query_place_id: event.venue_place_id } : {}),
  })}`;

  return (
    <>
    <HeaderBar maxWidth="max-w-2xl" href={`/e/${slug}`} />
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mt-6">
        <p className="text-sm font-medium text-muted">Volunteer signup</p>
        <h1 className="mt-1 text-4xl font-medium tracking-tight sm:text-5xl">{event.name}</h1>
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
      </header>

      {!isOpen && (
        <Card className="mt-8 bg-brand-soft">
          <p className="font-medium">
            {event.status === "published" ? "Volunteer signup is closed." : "Preview: this page isn't public yet."}
          </p>
          <p className="mt-1 text-sm text-muted">
            {event.status === "published"
              ? "Please contact the event organizers if you'd like to help."
              : "Only your team can see it. Publish the event and open volunteer signup to start taking signups."}
          </p>
        </Card>
      )}

      <div className="mt-8">
        {publicStations.length === 0 ? (
          <Card>
            <p className="text-muted">No shifts are available right now.</p>
          </Card>
        ) : (
          <SignupForm action={signUpVolunteer.bind(null, event.id)} stations={publicStations} disabled={!isOpen} />
        )}
      </div>

      <p className="mt-10 text-center text-sm text-muted">
        Already signed up?{" "}
        <Link href="/my" className="font-medium text-brand underline-offset-4 hover:underline">
          View my shifts
        </Link>
      </p>
    </main>
    </>
  );
}
