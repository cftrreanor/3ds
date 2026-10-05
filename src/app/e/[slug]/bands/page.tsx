import type { Metadata } from "next";
import { HeaderBar } from "@/components/logo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { registerBand } from "@/app/dashboard/band-actions";
import { BandForm } from "@/components/band-form";
import { Card } from "@/components/ui";
import { getUser } from "@/lib/auth";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { formatDateRange } from "@/lib/time";

type Params = { params: Promise<{ slug: string }> };

async function loadEvent(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, status, starts_on, ends_on, venue_name, venue_address, band_registration_open, chaperone_limit, classifications")
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
  if (!event) notFound();
  const user = await getUser();
  const supabase = await createClient();

  const [{ data: mine }, { data: profile }] = user
    ? await Promise.all([
        supabase.from("bands").select("id, band_name, school_name").eq("event_id", event.id).eq("director_user_id", user.id),
        supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
      ])
    : [{ data: [] }, { data: null }];

  const open = event.status === "published" && event.band_registration_open;
  const here = `/e/${slug}/bands`;

  return (
    <>
    <HeaderBar maxWidth="max-w-2xl" href={`/e/${slug}`} />
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mt-6">
        <p className="text-sm font-medium text-muted">Band registration</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{event.name}</h1>
        <p className="mt-2 text-muted">{formatDateRange(event.starts_on, event.ends_on)}</p>
        <p className="mt-1 text-muted">{[event.venue_name, event.venue_address].filter(Boolean).join(" · ")}</p>
      </header>

      {(mine ?? []).length > 0 && (
        <Card className="mt-8 bg-accent-soft">
          <p className="font-medium">You&apos;ve registered</p>
          <ul className="mt-2 space-y-1">
            {(mine ?? []).map((b) => (
              <li key={b.id}>
                <Link href={`/dashboard/bands/${b.id}`} className="font-medium text-brand underline-offset-4 hover:underline">
                  {b.band_name} ({b.school_name})
                </Link>
              </li>
            ))}
          </ul>
          {open && <p className="mt-2 text-sm text-muted">Bringing another ensemble? Register it below.</p>}
        </Card>
      )}

      <div className="mt-8">
        {!open ? (
          <Card>
            <p className="font-medium">
              {event.status === "published" ? "Band registration is closed." : "Preview: this page isn't public yet."}
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
        ) : (
          <BandForm
            action={registerBand.bind(null, event.id)}
            classifications={event.classifications}
            chaperoneLimit={event.chaperone_limit}
            submitLabel="Register band"
            initial={{
              head_director_name: profile?.full_name ?? "",
              head_director_email: user.email,
              head_director_phone: formatPhone(profile?.phone),
              contact_email: user.email,
            }}
          />
        )}
      </div>
    </main>
    </>
  );
}
