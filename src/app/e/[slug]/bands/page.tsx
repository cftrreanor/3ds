import type { Metadata } from "next";
import { EventHeaderBar } from "@/components/event-brand";
import Link from "next/link";
import { redirect } from "next/navigation";
import { groupWords, hasEnsembles, hasRooms } from "@/lib/event-types";
import { registerAgain, registerBand } from "@/app/dashboard/band-actions";
import { Card } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { BAND_COLUMNS, deadlinePassed, registrationIsOpen, type BandRow } from "@/lib/bands";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange, formatTimeRange } from "@/lib/time";
import { RegisterForm, type PreviousBand } from "./register-form";

type Params = { params: Promise<{ slug: string }> };

type Prefill = {
  id: string;
  email: string;
  band_name: string;
  school_name: string | null;
  classification: string | null;
  school_address: string | null;
  contact_email: string | null;
  head_director_name: string | null;
  head_director_phone: string | null;
  assistant_directors: string[];
  student_count: number | null;
  chaperone_count: number | null;
  bus_count: number | null;
  box_truck_count: number | null;
  truck_trailer_count: number | null;
  semi_truck_count: number | null;
  special_needs: string | null;
};

async function loadEvent(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, status, event_type, starts_on, ends_on, window_start, window_end, venue_name, venue_address, timezone, band_registration_open, band_registration_deadline, director_info, chaperone_limit, classifications")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const event = await loadEvent((await params).slug);
  const w = groupWords(event?.event_type);
  return { title: event ? `${w.One} registration: ${event.name}` : "Registration" };
}

export default async function BandRegistrationPage({ params }: Params) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) missing();
  // Only band contests and group events take registrations.
  if (!hasEnsembles(event.event_type)) redirect(`/e/${slug}`);
  const w = groupWords(event.event_type);
  const kind = hasRooms(event.event_type) ? "group" : "band";
  const user = await getUser();
  const supabase = await createClient();

  const [{ data: myBandData }, { data: profile }, { data: prefillData }] = user
    ? await Promise.all([
        supabase.from("bands").select(`${BAND_COLUMNS}, events(name, event_type)`).eq("director_user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
        // Details the host imported for this director, from their spreadsheet.
        supabase.rpc("my_band_prefills", { p_event: event.id }),
      ])
    : [{ data: [] }, { data: null }, { data: [] }];
  const myBands = (myBandData ?? []) as unknown as (BandRow & { events: { name: string; event_type: string | null } | null })[];
  const mine = myBands.filter((b) => b.event_id === event.id);
  // The latest registration of each of the director's bands, to copy from.
  // (Not ones already registered for this contest.)
  const seen = new Set<string>(mine.map((b) => `${b.band_name}|${b.school_name}`.toLowerCase()));
  const registeredNames = new Set(mine.map((b) => b.band_name.toLowerCase()));
  const prefilled: PreviousBand[] = ((prefillData ?? []) as Prefill[])
    .filter((p) => !registeredNames.has(p.band_name.toLowerCase()))
    .map((p) => ({
      id: p.id,
      from: "the host",
      prefilled: true,
      band_name: p.band_name,
      school_name: p.school_name ?? "",
      classification: p.classification ?? "",
      school_address: p.school_address ?? "",
      contact_email: p.contact_email ?? p.email,
      head_director_name: p.head_director_name ?? profile?.full_name ?? "",
      head_director_email: p.email,
      head_director_phone: formatPhone(p.head_director_phone ?? profile?.phone),
      assistant_directors: p.assistant_directors,
      student_count: p.student_count ?? undefined,
      chaperone_count: p.chaperone_count ?? undefined,
      bus_count: p.bus_count ?? undefined,
      box_truck_count: p.box_truck_count ?? undefined,
      truck_trailer_count: p.truck_trailer_count ?? undefined,
      semi_truck_count: p.semi_truck_count ?? undefined,
      special_needs: p.special_needs,
    }));
  const previous: PreviousBand[] = myBands
    // Groups copy from groups, bands from bands.
    .filter((b) => hasRooms(b.events?.event_type) === hasRooms(event.event_type))
    // Not ones whose details were removed 2 years after their event (purge_band_directors).
    .filter((b) => b.head_director_email)
    .filter((b) => {
      const k = `${b.band_name}|${b.school_name}`.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((b) => ({
      ...b,
      head_director_phone: formatPhone(b.head_director_phone),
      from: b.events?.name ?? "an earlier event",
    }));
  previous.unshift(...prefilled);

  const open = registrationIsOpen(event);
  const here = `/e/${slug}/bands`;
  const form = user && (
    <RegisterForm
      action={registerBand.bind(null, event.id)}
      again={registerAgain.bind(null, event.id)}
      classifications={event.classifications}
      chaperoneLimit={event.chaperone_limit}
      previous={previous}
      kind={kind}
      blank={{
        head_director_name: profile?.full_name ?? "",
        head_director_email: user.email,
        head_director_phone: formatPhone(profile?.phone),
        contact_email: user.email,
      }}
    />
  );

  return (
    <>
    <EventHeaderBar slug={slug} />
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mt-6">
        <p className="text-sm font-medium text-muted">{w.One} registration</p>
        <h1 className="mt-1 text-4xl font-medium tracking-tight sm:text-5xl">{event.name}</h1>
        <p className="mt-2 text-muted">
          {event.starts_on === event.ends_on && event.window_start && event.window_end
            ? `${formatDate(event.starts_on)} · ${formatTimeRange(event.window_start, event.window_end, event.timezone)}`
            : formatDateRange(event.starts_on, event.ends_on)}
        </p>
        <p className="mt-1 text-muted">{[event.venue_name, event.venue_address].filter(Boolean).join(" · ")}</p>
      </header>

      {(event.director_info || (open && event.band_registration_deadline)) && (
        <Card className="mt-8 space-y-3">
          {open && event.band_registration_deadline && (
            <p className="font-medium">Registration closes at the end of {formatDate(event.band_registration_deadline)}.</p>
          )}
          {event.director_info && <p className="whitespace-pre-line leading-7">{event.director_info}</p>}
        </Card>
      )}

      {mine.length > 0 && (
        <Card className="mt-8 bg-brand-soft">
          <p className="font-medium">You&apos;ve registered</p>
          <ul className="mt-2 space-y-1">
            {mine.map((b) => (
              <li key={b.id}>
                <Link href={`/dashboard/bands/${b.id}`} className="font-medium text-brand underline-offset-4 hover:underline">
                  {b.band_name} ({b.school_name})
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">Open a {w.one} to see your times or change your registration.</p>
        </Card>
      )}

      <div className="mt-8">
        {!open ? (
          <Card>
            <p className="font-medium">
              {event.status !== "published"
                ? "Preview: this page isn't public yet."
                : deadlinePassed(event) && event.band_registration_open
                  ? `${w.One} registration closed on ${formatDate(event.band_registration_deadline!)}.`
                  : `${w.One} registration is closed.`}
            </p>
            <p className="mt-1 text-sm text-muted">
              {event.status === "published"
                ? "Please contact the organizer if you need to make a change."
                : `Publish the event and open ${w.one} registration to accept registrations.`}
            </p>
          </Card>
        ) : !user ? (
          <Card>
            <h2 className="font-semibold">Directors: sign in to register</h2>
            <p className="mt-2 leading-7 text-muted">
              We&apos;ll email you a sign-in link, no password needed. Your registration is saved to your account so
              you can update it and see your {kind === "group" ? "schedule" : "performance time"} when it&apos;s posted.
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(here)}`}
              className="mt-4 inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-medium text-brand-foreground hover:opacity-90"
            >
              Sign in to register
            </Link>
          </Card>
        ) : mine.length > 0 ? (
          <details className="group">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-md border border-border bg-surface px-4 text-sm font-medium hover:bg-background group-open:mb-6">
              + Register another ensemble
            </summary>
            {form}
          </details>
        ) : (
          form
        )}
      </div>
    </main>
    </>
  );
}
