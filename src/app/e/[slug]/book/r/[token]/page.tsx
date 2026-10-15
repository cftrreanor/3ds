import type { Metadata } from "next";
import { HeaderBar } from "@/components/logo";
import { Card } from "@/components/ui";
import { meetingPlace, meetingWhen } from "@/lib/conference-bookings";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time";
import { cancelBooking, changeBooking } from "../../actions";
import { loadBooking, loadConference } from "../../data";
import { PrivacyNote } from "../../privacy-note";
import { CancelBookingButton, ChangeBookingForm } from "./manage-forms";

export const metadata: Metadata = { title: "Your conference" };

type Params = { params: Promise<{ slug: string; token: string }> };

/** A family's own page, from the link in their emails: see, change or cancel their conference. */
export default async function ManageBookingPage({ params }: Params) {
  const { slug, token } = await params;
  const booking = await loadBooking(token);
  const conf = booking ? await loadConference({ id: booking.event_id }) : null;

  if (!booking || !conf) {
    return (
      <>
        <HeaderBar maxWidth="max-w-2xl" href={`/e/${slug}`} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
          <Card>
            <p className="font-medium">This booking was canceled, or the link isn&apos;t complete.</p>
            <a href={`/e/${slug}/book`} className="mt-2 inline-block font-medium text-brand underline underline-offset-4">
              Book a time
            </a>
          </Card>
        </main>
      </>
    );
  }

  const { event, settings, teacher } = conf;
  const tz = event.timezone;
  const place = meetingPlace(booking, event, settings, teacher);
  const started = new Date(booking.starts_at) <= new Date();
  const { data: open } = started ? { data: [] } : await (await createClient()).rpc("conference_open_times", { p_slug: event.slug });
  const times = ((open ?? []) as { starts_at: string }[]).map((t) => ({ value: t.starts_at, label: formatTime(t.starts_at, tz) }));

  return (
    <>
      <HeaderBar maxWidth="max-w-2xl" href={`/e/${event.slug}`} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
        <p className="text-sm font-medium text-muted">Parent-teacher conference with {teacher.name}</p>
        <h1 className="mt-1 text-4xl font-medium tracking-tight sm:text-5xl">{booking.child_name}</h1>

        <Card className="mt-6 space-y-4">
          <div>
            <p className="text-sm font-semibold text-muted">When</p>
            <p className="text-lg font-medium">{meetingWhen(booking.starts_at, settings.meeting_minutes, tz)}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">{place.title}</p>
            {place.lines.map((l) => (
              <p key={l} className="leading-7">
                {l}
              </p>
            ))}
            {place.link && (
              <a
                href={place.link}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
              >
                Join the meeting
              </a>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-muted">Coming</p>
            <p>{booking.parents.map((p) => p.name).join(", ")}</p>
          </div>
          {booking.note && (
            <div>
              <p className="text-sm font-semibold text-muted">Your note</p>
              <p className="whitespace-pre-line">{booking.note}</p>
            </div>
          )}
        </Card>

        {started ? (
          <p className="mt-6 text-muted">This meeting has started or passed, so it can&apos;t be changed here.</p>
        ) : (
          <>
            <section className="mt-8" aria-labelledby="change-heading">
              <h2 id="change-heading" className="text-xl font-semibold">
                Change your time
              </h2>
              <p className="mt-1 text-sm text-muted">Only open times are listed. Everyone on this booking gets an updated invite.</p>
              <div className="mt-4">
                <ChangeBookingForm
                  action={changeBooking.bind(null, token)}
                  current={{ value: booking.starts_at, label: formatTime(booking.starts_at, tz) }}
                  times={times}
                  mode={booking.meeting_mode}
                  askMode={settings.meeting_mode === "either"}
                />
              </div>
            </section>
            <section className="mt-8 border-t border-border pt-6" aria-labelledby="cancel-heading">
              <h2 id="cancel-heading" className="text-xl font-semibold">
                Can&apos;t make it?
              </h2>
              <p className="mb-4 mt-1 text-sm text-muted">Canceling frees your time for another family.</p>
              <CancelBookingButton action={cancelBooking.bind(null, token)} child={booking.child_name} />
            </section>
          </>
        )}
        <div className="mt-8">
          <PrivacyNote teacher={teacher.name} />
        </div>
      </main>
    </>
  );
}
