import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HeaderBar } from "@/components/logo";
import { Card } from "@/components/ui";
import { formatDuration } from "@/lib/schedule";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime, formatTimeRange, zoneName } from "@/lib/time";
import { bookConference } from "./actions";
import { BookingForm } from "./booking-form";
import { loadConference } from "./data";
import { PrivacyNote } from "./privacy-note";

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const conf = await loadConference({ slug: (await params).slug });
  return { title: conf ? `Book a time: ${conf.event.name}` : "Book a conference" };
}

/** Families book a parent-teacher conference: only open times are shown. */
export default async function BookConferencePage({ params, searchParams }: Params) {
  const { slug } = await params;
  const { canceled } = await searchParams;
  const conf = await loadConference({ slug });
  if (!conf) {
    const supabase = await createClient();
    const { data } = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
    if (data) redirect(`/e/${slug}`);
    missing();
  }
  const { event, settings, teacher } = conf;
  const published = event.status === "published";
  const supabase = await createClient();
  // A draft is only previewed by the teacher (who can read it), like any event page.
  if (!published && !(await supabase.from("events").select("id").eq("id", event.id).maybeSingle()).data) missing();
  const { data: open } = published ? await supabase.rpc("conference_open_times", { p_slug: slug }) : { data: [] };
  const times = ((open ?? []) as { starts_at: string }[]).map((t) => ({ value: t.starts_at, label: formatTime(t.starts_at, event.timezone) }));
  const school = [event.venue_name, event.venue_address].filter(Boolean).join(", ");
  const how =
    settings.meeting_mode === "in_person"
      ? `In person${settings.room ? `: ${settings.room}` : ""}${school ? `, ${school}` : ""}.`
      : settings.meeting_mode === "video"
        ? "On video. You'll get the details when you book."
        : `In person${settings.room ? ` (${settings.room}${school ? `, ${school}` : ""})` : ""} or on video: you choose when you book.`;

  return (
    <>
      <HeaderBar maxWidth="max-w-2xl" href={`/e/${slug}`} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
        <header>
          <p className="text-sm font-medium text-muted">Parent-teacher conference with {teacher.name}</p>
          <h1 className="mt-1 text-4xl font-medium tracking-tight sm:text-5xl">{event.name}</h1>
          <p className="mt-2 text-muted">
            {formatDate(event.starts_on)} · {formatTimeRange(event.window_start, event.window_end, event.timezone)}
          </p>
          <p className="mt-1 text-muted">
            {formatDuration(settings.meeting_minutes)} meetings · {how}
          </p>
          {event.public_notes && <p className="mt-4 leading-7">{event.public_notes}</p>}
        </header>

        {canceled === "1" && (
          <Card className="mt-6 bg-brand-soft" role="status">
            <p className="font-medium">Your conference was canceled. You can book another time below.</p>
          </Card>
        )}

        <div className="mt-8">
          {published ? (
            <>
              <BookingForm action={bookConference.bind(null, event.id)} times={times} askMode={settings.meeting_mode === "either"} />
              <p className="mt-4 text-sm text-muted">All times are {zoneName(event.timezone)}.</p>
              <div className="mt-6">
                <PrivacyNote teacher={teacher.name} />
              </div>
            </>
          ) : (
            <Card>
              <p className="font-medium">Preview: booking opens when {teacher.name} publishes these conferences.</p>
            </Card>
          )}
        </div>
      </main>
    </>
  );
}
