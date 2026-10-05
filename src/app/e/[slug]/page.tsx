import type { Metadata } from "next";
import { HeaderBar } from "@/components/logo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange, formatTime, utcToZonedDate, zoneAbbreviation, zoneName } from "@/lib/time";
import { AutoRefresh } from "./auto-refresh";

type Params = { params: Promise<{ slug: string }> };

type ScheduleRow = {
  performance_order: number;
  perform_at: string | null;
  school_name: string;
  band_name: string;
  classification: string;
  status: string;
};

async function loadEvent(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, status, timezone, starts_on, ends_on, venue_name, venue_address, venue_place_id, public_notes, volunteer_signup_open, band_registration_open, performance_order_published")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const event = await loadEvent((await params).slug);
  return { title: event?.name ?? "Event" };
}

/** Which band is on now and who's next, from the clock and checkpoint status. */
function nowAndNext(rows: ScheduleRow[]) {
  const now = Date.now();
  const timed = rows.filter((r) => r.perform_at);
  const started = timed.filter((r) => new Date(r.perform_at!).getTime() <= now);
  const current = started.at(-1) ?? null;
  const upcoming = timed.filter((r) => new Date(r.perform_at!).getTime() > now);
  return { current, next: upcoming[0] ?? null };
}

export default async function EventPublicPage({ params }: Params) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) notFound();

  const supabase = await createClient();
  const [{ data: scheduleData }, { data: announcements }] = await Promise.all([
    supabase.rpc("public_schedule", { p_slug: slug }),
    supabase
      .from("announcements")
      .select("id, body, priority, created_at")
      .eq("event_id", event.id)
      .contains("audiences", ["public"])
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  const schedule = (scheduleData ?? []) as ScheduleRow[];
  const tz = event.timezone;
  const isEventDay = utcToZonedDate(new Date().toISOString(), tz) >= event.starts_on && utcToZonedDate(new Date().toISOString(), tz) <= event.ends_on;
  const { current, next } = nowAndNext(schedule);
  const multiDay = event.starts_on !== event.ends_on;
  const mapUrl = `https://www.google.com/maps/search/?${new URLSearchParams({
    api: "1",
    query: event.venue_address,
    ...(event.venue_place_id ? { query_place_id: event.venue_place_id } : {}),
  })}`;
  const at = (iso: string) =>
    `${multiDay ? `${formatDate(utcToZonedDate(iso, tz), { year: undefined })} · ` : ""}${formatTime(iso, tz)}`;

  return (
    <>
    <HeaderBar maxWidth="max-w-2xl" href={`/e/${slug}`} />
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      {isEventDay && event.performance_order_published && <AutoRefresh seconds={30} />}
      {event.status !== "published" && (
        <Card className="mt-6 bg-accent-soft">
          <p className="text-sm">Preview: this page isn&apos;t public yet. Only your team can see it.</p>
        </Card>
      )}

      <header className="mt-6">
        <h1 className="text-3xl font-semibold tracking-tight">{event.name}</h1>
        <p className="mt-2 text-muted">{formatDateRange(event.starts_on, event.ends_on)}</p>
        <p className="mt-1 text-muted">
          {[event.venue_name, event.venue_address].filter(Boolean).join(" · ")} ·{" "}
          <a href={mapUrl} target="_blank" rel="noreferrer" className="font-medium text-brand underline-offset-4 hover:underline">
            Directions
          </a>
        </p>
        {event.public_notes && <p className="mt-4 leading-7">{event.public_notes}</p>}
      </header>

      {(announcements ?? []).map((a) => (
        <Card
          key={a.id}
          role={a.priority === "emergency" ? "alert" : undefined}
          className={`mt-6 ${a.priority === "emergency" ? "border-danger bg-danger/5" : "bg-accent-soft"}`}
        >
          <p className="text-xs font-semibold uppercase tracking-wide">
            {a.priority === "emergency" ? "⚠️ Emergency" : a.priority === "schedule" ? "Schedule update" : "Announcement"} ·{" "}
            {formatTime(a.created_at, tz)}
          </p>
          <p className="mt-1 leading-7">{a.body}</p>
        </Card>
      ))}

      {(event.volunteer_signup_open || event.band_registration_open) && event.status === "published" && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {event.volunteer_signup_open && (
            <Link href={`/e/${slug}/volunteer`} className="block">
              <Card className="h-full transition hover:border-brand">
                <p className="font-semibold">Volunteer</p>
                <p className="mt-1 text-sm text-muted">Pick a shift and help make the day happen.</p>
              </Card>
            </Link>
          )}
          {event.band_registration_open && (
            <Link href={`/e/${slug}/bands`} className="block">
              <Card className="h-full transition hover:border-brand">
                <p className="font-semibold">Band directors</p>
                <p className="mt-1 text-sm text-muted">Register your ensemble for this contest.</p>
              </Card>
            </Link>
          )}
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Performance schedule</h2>
        {schedule.length === 0 ? (
          <p className="mt-2 text-muted">The performance order hasn&apos;t been posted yet. Check back soon.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              All times {zoneName(tz)} ({zoneAbbreviation(schedule.find((r) => r.perform_at)?.perform_at ?? new Date().toISOString(), tz)})
              {isEventDay && " · updates automatically"}
            </p>
            {isEventDay && (current || next) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {current && (
                  <Card className="border-brand">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">On the field</p>
                    <p className="mt-1 text-lg font-semibold">{current.band_name}</p>
                    <p className="text-sm text-muted">{current.school_name}</p>
                  </Card>
                )}
                {next && (
                  <Card>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Up next · {formatTime(next.perform_at!, tz)}</p>
                    <p className="mt-1 text-lg font-semibold">{next.band_name}</p>
                    <p className="text-sm text-muted">{next.school_name}</p>
                  </Card>
                )}
              </div>
            )}
            <ol className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
              {schedule.map((r) => {
                const isCurrent = isEventDay && current?.performance_order === r.performance_order;
                return (
                  <li key={r.performance_order} className={`flex items-center gap-3 px-4 py-3 ${isCurrent ? "bg-accent-soft" : ""}`}>
                    <span className="w-8 shrink-0 text-center text-sm font-semibold text-muted">{r.performance_order}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.band_name}</p>
                      <p className="truncate text-sm text-muted">
                        {r.school_name} · {r.classification}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium tabular-nums">{r.perform_at ? at(r.perform_at) : "TBA"}</p>
                      {isCurrent && <Badge tone="brand">Now</Badge>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </>
        )}
      </section>
    </main>
    </>
  );
}
