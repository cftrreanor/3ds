import type { Metadata } from "next";
import { HeaderBar } from "@/components/logo";
import Link from "next/link";
import { registerBand } from "@/app/dashboard/band-actions";
import { Card } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { BAND_COLUMNS, deadlinePassed, registrationIsOpen, type BandRow } from "@/lib/bands";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange } from "@/lib/time";
import { RegisterForm, type PreviousBand } from "./register-form";

type Params = { params: Promise<{ slug: string }> };

async function loadEvent(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, status, starts_on, ends_on, venue_name, venue_address, timezone, band_registration_open, band_registration_deadline, director_info, chaperone_limit, classifications")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const event = await loadEvent((await params).slug);
  return { title: event ? `Band registration: ${event.name}` : "Band registration" };
}

export default async function BandRegistrationPage({ params }: Params) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) missing();
  const user = await getUser();
  const supabase = await createClient();

  const [{ data: myBandData }, { data: profile }] = user
    ? await Promise.all([
        supabase.from("bands").select(`${BAND_COLUMNS}, events(name)`).eq("director_user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];
  const myBands = (myBandData ?? []) as unknown as (BandRow & { events: { name: string } | null })[];
  const mine = myBands.filter((b) => b.event_id === event.id);
  // The latest registration of each of the director's bands, to copy from.
  const seen = new Set<string>();
  const previous: PreviousBand[] = myBands
    .filter((b) => {
      const k = `${b.band_name}|${b.school_name}`.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((b) => ({
      ...b,
      head_director_phone: formatPhone(b.head_director_phone),
      label: `${b.band_name} (${b.school_name}) · from ${b.events?.name ?? "an earlier contest"}`,
    }));

  const open = registrationIsOpen(event);
  const here = `/e/${slug}/bands`;
  const form = user && (
    <RegisterForm
      action={registerBand.bind(null, event.id)}
      classifications={event.classifications}
      chaperoneLimit={event.chaperone_limit}
      previous={previous}
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
    <HeaderBar maxWidth="max-w-2xl" href={`/e/${slug}`} />
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mt-6">
        <p className="text-sm font-medium text-muted">Band registration</p>
        <h1 className="mt-1 text-4xl font-bold tracking-tight sm:text-5xl">{event.name}</h1>
        <p className="mt-2 text-muted">{formatDateRange(event.starts_on, event.ends_on)}</p>
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
          <p className="mt-2 text-sm text-muted">Open a band to see your times or change your registration.</p>
        </Card>
      )}

      <div className="mt-8">
        {!open ? (
          <Card>
            <p className="font-medium">
              {event.status !== "published"
                ? "Preview: this page isn't public yet."
                : deadlinePassed(event) && event.band_registration_open
                  ? `Band registration closed on ${formatDate(event.band_registration_deadline!)}.`
                  : "Band registration is closed."}
            </p>
            <p className="mt-1 text-sm text-muted">
              {event.status === "published"
                ? "Please contact the host if you need to make a change."
                : "Publish the event and open band registration to accept registrations."}
            </p>
          </Card>
        ) : !user ? (
          <Card>
            <h2 className="font-semibold">Directors: sign in to register</h2>
            <p className="mt-2 leading-7 text-muted">
              We&apos;ll email you a sign-in link, no password needed. Your registration is saved to your account so
              you can update it and see your performance time when it&apos;s posted.
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
