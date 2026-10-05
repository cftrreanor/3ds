import type { Metadata } from "next";
import { HeaderBar } from "@/components/logo";
import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { registrationIsOpen } from "@/lib/bands";
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
type FinalsRow = {
  slot_number: number;
  perform_at: string | null;
  school_name: string | null;
  band_name: string | null;
  classification: string | null;
};
type BreakRow = { starts_at: string; minutes: number; label: string };
/** One line of the public schedule, prelims or finals. */
type Line = { key: string; number: string; perform_at: string | null; title: string; subtitle: string | null };

async function loadEvent(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, name, status, timezone, starts_on, ends_on, venue_name, venue_address, venue_place_id, public_notes, volunteer_signup_open, band_registration_open, band_registration_deadline, performance_order_published, finals_published")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const event = await loadEvent((await params).slug);
  return { title: event?.name ?? "Event" };
}

/** Which band is on now and who's next, from the clock. */
function nowAndNext(rows: Line[]) {
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
  const [{ data: scheduleData }, { data: finalsData }, { data: breakData }, { data: announcements }] = await Promise.all([
    supabase.rpc("public_schedule", { p_slug: slug }),
    supabase.rpc("public_finals", { p_slug: slug }),
    supabase.rpc("public_breaks", { p_slug: slug }),
    supabase
      .from("announcements")
      .select("id, body, priority, created_at")
      .eq("event_id", event.id)
      .contains("audiences", ["public"])
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  const schedule: Line[] = ((scheduleData ?? []) as ScheduleRow[]).map((r) => ({
    key: `p${r.performance_order}`,
    number: String(r.performance_order),
    perform_at: r.perform_at,
    title: r.band_name,
    subtitle: `${r.school_name} · ${r.classification}`,
  }));
  const finals: Line[] = ((finalsData ?? []) as FinalsRow[]).map((r) => ({
    key: `f${r.slot_number}`,
    number: `F${r.slot_number}`,
    perform_at: r.perform_at,
    title: r.band_name ?? `Finalist ${r.slot_number}`,
    subtitle: r.band_name ? `${r.school_name} · ${r.classification}` : "To be announced",
  }));
  const breaks = (breakData ?? []) as BreakRow[];
  const published = event.performance_order_published || event.finals_published;
  const bandsOpen = registrationIsOpen(event);
  const tz = event.timezone;
  const isEventDay = utcToZonedDate(new Date().toISOString(), tz) >= event.starts_on && utcToZonedDate(new Date().toISOString(), tz) <= event.ends_on;
  const { current, next } = nowAndNext([...schedule, ...finals]);
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
      {isEventDay && published && <AutoRefresh seconds={30} />}
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

      {(event.volunteer_signup_open || bandsOpen) && event.status === "published" && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {event.volunteer_signup_open && (
            <Link href={`/e/${slug}/volunteer`} className="block">
              <Card className="h-full transition hover:border-brand">
                <p className="font-semibold">Volunteer</p>
                <p className="mt-1 text-sm text-muted">Pick a shift and help make the day happen.</p>
              </Card>
            </Link>
          )}
          {bandsOpen && (
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
        {schedule.length === 0 && finals.length === 0 ? (
          <p className="mt-2 text-muted">The performance order hasn&apos;t been posted yet. Check back soon.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">
              All times {zoneName(tz)} (
              {zoneAbbreviation([...schedule, ...finals].find((r) => r.perform_at)?.perform_at ?? new Date().toISOString(), tz)})
              {isEventDay && " · updates automatically"}
            </p>
            {isEventDay && (current || next) && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {current && (
                  <Card className="border-brand">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">On the field</p>
                    <p className="mt-1 text-lg font-semibold">{current.title}</p>
                    <p className="text-sm text-muted">{current.subtitle}</p>
                  </Card>
                )}
                {next && (
                  <Card>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Up next · {formatTime(next.perform_at!, tz)}</p>
                    <p className="mt-1 text-lg font-semibold">{next.title}</p>
                    <p className="text-sm text-muted">{next.subtitle}</p>
                  </Card>
                )}
              </div>
            )}
            {schedule.length > 0 && (
              <ScheduleList lines={schedule} breaks={breaks} currentKey={isEventDay ? current?.key : undefined} at={at} />
            )}
            {finals.length > 0 && (
              <>
                <h3 className="mt-8 text-lg font-semibold">🏆 Finals</h3>
                <ScheduleList lines={finals} breaks={breaks} currentKey={isEventDay ? current?.key : undefined} at={at} />
              </>
            )}
          </>
        )}
      </section>
    </main>
    </>
  );
}

/** Numbered schedule rows, with any break that falls between two performances. */
function ScheduleList({
  lines,
  breaks,
  currentKey,
  at,
}: {
  lines: Line[];
  breaks: BreakRow[];
  currentKey: string | undefined;
  at: (iso: string) => string;
}) {
  return (
    <ol className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
      {lines.map((r, i) => {
        const prev = lines[i - 1]?.perform_at;
        const between =
          prev && r.perform_at ? breaks.filter((b) => b.starts_at >= prev && b.starts_at < r.perform_at!) : [];
        const isCurrent = currentKey === r.key;
        return (
          <Fragment key={r.key}>
            {between.map((b) => (
              <li key={b.starts_at} className="flex items-center gap-3 bg-background px-4 py-2 text-sm text-muted">
                <span className="w-8 shrink-0 text-center">☕</span>
                <span className="flex-1 font-medium">{b.label}</span>
                <span className="shrink-0 tabular-nums">
                  {at(b.starts_at)} · {b.minutes} min
                </span>
              </li>
            ))}
            <li className={`flex items-center gap-3 px-4 py-3 ${isCurrent ? "bg-accent-soft" : ""}`}>
              <span className="w-8 shrink-0 text-center text-sm font-semibold text-muted">{r.number}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                {r.subtitle && <p className="truncate text-sm text-muted">{r.subtitle}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-medium tabular-nums">{r.perform_at ? at(r.perform_at) : "TBA"}</p>
                {isCurrent && <Badge tone="brand">Now</Badge>}
              </div>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}
