import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { EventHeaderBar } from "@/components/event-brand";
import { Card } from "@/components/ui";
import { formatDuration } from "@/lib/schedule";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { weeklySummary } from "@/lib/conferences";
import { formatDate, formatTime, formatTimeRange, utcToZonedDate, zoneName } from "@/lib/time";
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
  const times = ((open ?? []) as { starts_at: string }[]).map((t) => {
    const day = utcToZonedDate(t.starts_at, event.timezone);
    return { value: t.starts_at, label: formatTime(t.starts_at, event.timezone), day, dayLabel: formatDate(day, { year: undefined }) };
  });
  const weekly = settings.schedule === "weekly";
  const school = [event.venue_name, event.venue_address].filter(Boolean).join(", ");
  // Where to meet, one line each: the room and school, and the video option.
  const place = [settings.room, school].filter(Boolean).join(", ");
  const where =
    settings.meeting_mode === "phone"
      ? [`By phone. ${teacher.name} calls you at the number you give.`]
      : settings.meeting_mode === "video"
        ? ["On video. You'll get the details when you book."]
        : [place ? `In person: ${place}` : "In person", ...(settings.meeting_mode === "either" ? ["Or on video. You choose when you book."] : [])];

  return (
    <>
      <EventHeaderBar slug={slug} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
        <header>
          <p className="text-sm font-medium text-muted">Parent-teacher conference with {teacher.name}</p>
          <h1 className="mt-1 text-4xl font-medium tracking-tight sm:text-5xl">{event.name}</h1>
          <p className="mt-2 text-muted">
            {weekly
              ? `Every week: ${weeklySummary(settings.weekly_hours)}`
              : `${formatDate(event.starts_on)} · ${formatTimeRange(event.window_start, event.window_end, event.timezone)}`}
          </p>
          {weekly && <p className="mt-1 text-muted">Through {formatDate(event.ends_on, { year: undefined })}</p>}
          <p className="mt-1 text-muted">{formatDuration(settings.meeting_minutes)} meetings</p>
          {where.map((line) => (
            <p key={line} className="mt-1 text-muted">
              {line}
            </p>
          ))}
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
              <BookingForm
                action={bookConference.bind(null, event.id)}
                times={times}
                askMode={settings.meeting_mode === "either"}
                askPhone={settings.meeting_mode === "phone"}
                zone={zoneName(event.timezone)}
              />
              <div className="mt-6">
                <PrivacyNote teacher={teacher.name} weekly={weekly} />
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
