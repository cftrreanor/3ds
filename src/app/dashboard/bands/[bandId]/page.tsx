import type { Metadata } from "next";
import { FileLinks } from "@/components/file-links";
import { filesFor } from "@/lib/event-files";
import Link from "next/link";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { ScheduleUpdateBanner } from "@/components/schedule-update-banner";
import { Badge, Card } from "@/components/ui";
import { bandCalendarEvent, type BandTimes } from "@/lib/band-calendar";
import { BAND_COLUMNS, readyAt, registrationIsOpen, warmUpEndAt, type BandRow } from "@/lib/bands";
import { getOrigin } from "@/lib/data";
import { googleCalendarUrl } from "@/lib/ics";
import { formatPhone } from "@/lib/phone";
import { CONTEST_INFO_COOKIE } from "@/lib/preferences";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatDateRange, formatTime, utcToZonedDate, zoneAbbreviation } from "@/lib/time";
import { AutoRefresh } from "@/app/e/[slug]/auto-refresh";
import { eventPhase, type BandDay } from "@/lib/contest-day";
import { CollapsibleInfo } from "./collapsible-info";
import { ContestDayCard, type ProgressRow } from "./contest-day-card";

export const metadata: Metadata = { title: "Contest" };

const linkClass = "font-medium text-brand underline-offset-4 hover:underline";

/** A band's page for one contest: when and where to be, then their registration. */
export default async function BandContestPage({ params, searchParams }: PageProps<"/dashboard/bands/[bandId]">) {
  const { bandId } = await params;
  const { registered, saved } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("bands").select(BAND_COLUMNS).eq("id", bandId).maybeSingle();
  const band = data as BandRow | null;
  if (!band) missing();

  const [{ data: event }, { data: slot }, { data: finalsSlot }, { data: contact }, { data: phone }, cookieStore, { data: day }, { data: progress }] = await Promise.all([
    supabase
      .from("events")
      .select(
        "name, slug, status, timezone, starts_on, ends_on, venue_name, venue_address, venue_place_id, band_registration_open, band_registration_deadline, director_info, performance_order_published, ready_minutes_before, finals_ready_minutes_before, finalists_revealed, schedule_updated_at",
      )
      .eq("id", band.event_id)
      .single(),
    supabase.from("performance_slots").select("performance_order, warm_up_at, warm_up_minutes, perform_at, warm_up_location").eq("band_id", bandId).maybeSingle(),
    supabase.from("finals_slots").select("slot_number, warm_up_at, warm_up_minutes, perform_at, warm_up_location").eq("band_id", bandId).maybeSingle(),
    supabase.from("event_director_contacts").select("name, email, has_phone").eq("event_id", band.event_id).maybeSingle(),
    supabase.rpc("director_contact_phone", { ev: band.event_id }),
    cookies(),
    // Contest day: where the band is along the host's check-in path.
    supabase
      .from("bands")
      .select("id, band_name, bus_count, box_truck_count, truck_trailer_count, semi_truck_count, buses_at, equipment_at, equipment_spot, away_at, left_at, scratched_at")
      .eq("id", bandId)
      .maybeSingle(),
    supabase.rpc("my_band_progress", { p_band_id: bandId }),
  ]);
  if (!event) missing();
  const open = registrationIsOpen(event);
  const files = await filesFor([band.event_id], ["public", "directors"], () => event.timezone);
  const origin = await getOrigin();
  const mapUrl = `https://www.google.com/maps/search/?${new URLSearchParams({
    api: "1",
    query: event.venue_address,
    ...(event.venue_place_id ? { query_place_id: event.venue_place_id } : {}),
  })}`;
  const calendar = (round: "order" | "finals", times: BandTimes) =>
    bandCalendarEvent({
      bandId,
      bandName: band.band_name,
      round,
      times,
      event: { ...event, ready_minutes_before: round === "finals" ? event.finals_ready_minutes_before : event.ready_minutes_before },
      url: `${origin}/dashboard/bands/${bandId}`,
    });
  const hasContact = contact && (contact.name || contact.has_phone || contact.email);
  const infoOpen = cookieStore.get(CONTEST_INFO_COOKIE)?.value !== "closed";
  const contestDay =
    eventPhase(event, new Date()) === "day" && event.performance_order_published && slot && day && (progress ?? []).length > 0;

  return (
    <div className="mx-auto max-w-2xl">
      {event.status === "published" && (
        <div className="-mx-4 -mt-8 mb-4 sm:-mt-10">
          <ScheduleUpdateBanner slug={event.slug} version={event.schedule_updated_at} />
        </div>
      )}
      <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
        ← Dashboard
      </Link>
      {registered && (
        <Card className="mt-4 border-success/30 bg-success-soft" role="status">
          <p className="font-medium">You&apos;re registered! 🎺</p>
          <p className="mt-1 text-sm text-muted">We emailed you a copy. We&apos;ll email again when performance times are posted.</p>
        </Card>
      )}
      {saved && (
        <Card className="mt-4 border-success/30 bg-success-soft" role="status">
          <p className="font-medium">Registration updated.</p>
        </Card>
      )}

      <header className="mt-4">
        <p className="text-sm font-medium text-muted">{formatDateRange(event.starts_on, event.ends_on)}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{event.name}</h1>
        <p className="mt-1 text-muted">
          {[event.venue_name, event.venue_address].filter(Boolean).join(" · ")} ·{" "}
          <a href={mapUrl} target="_blank" rel="noreferrer" className={linkClass}>
            Directions
          </a>{" "}
          ·{" "}
          <Link href={`/e/${event.slug}`} className={linkClass}>
            Full schedule
          </Link>
        </p>
        {(hasContact || event.director_info) && (
          <CollapsibleInfo initialOpen={infoOpen}>
            {hasContact && (
              <p className="mt-2 flex flex-wrap gap-x-3 text-muted">
                <span>{contact.name || "Host contact"}</span>
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className={linkClass}>
                    Email
                  </a>
                )}
                {/* No digits on screen; the number only unlocks the day before and on contest day. */}
                {phone && (
                  <>
                    <a href={`tel:${phone}`} className={linkClass}>
                      Call
                    </a>
                    <a href={`sms:${phone}`} className={linkClass}>
                      Text
                    </a>
                  </>
                )}
              </p>
            )}
            {event.director_info && <p className="mt-2 whitespace-pre-line text-sm leading-6">{event.director_info}</p>}
          </CollapsibleInfo>
        )}
        <p className="mt-4">
          <span aria-hidden="true">🎺</span> <span className="font-semibold">{band.band_name}</span>{" "}
          <span className="text-muted">· {band.school_name}</span>
        </p>
      </header>

      {contestDay && (
        <>
          <AutoRefresh seconds={30} />
          <ContestDayCard
            band={day as BandDay & { band_name: string }}
            rows={(progress ?? []) as ProgressRow[]}
            prelims={slot}
            finals={event.finalists_revealed ? finalsSlot : null}
            readyMinutes={event.ready_minutes_before}
            finalsReadyMinutes={event.finals_ready_minutes_before}
            time={(iso) => formatTime(iso, event.timezone)}
          />
        </>
      )}

      {files.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-semibold">Maps &amp; documents</h2>
          <p className="mt-1 text-sm text-muted">From the host.</p>
          <FileLinks files={files} className="mt-3" />
        </Card>
      )}

      {event.finalists_revealed && finalsSlot && (
        <TimesCard
          title={`🏆 Finals · #${finalsSlot.slot_number}`}
          times={finalsSlot}
          event={{ ...event, ready_minutes_before: event.finals_ready_minutes_before }}
          calendar={calendar("finals", finalsSlot)}
          icsUrl={`/dashboard/bands/${bandId}/calendar?round=finals`}
          highlight
        />
      )}
      {event.performance_order_published && slot ? (
        <TimesCard
          title={`Your times · #${slot.performance_order} in the order`}
          times={slot}
          event={event}
          calendar={calendar("order", slot)}
          icsUrl={`/dashboard/bands/${bandId}/calendar`}
        />
      ) : (
        <Card className="mt-6">
          <h2 className="font-semibold">Your times</h2>
          <p className="mt-2 text-sm text-muted">
            The host hasn&apos;t posted the performance order yet. We&apos;ll email you when your times are ready.
          </p>
        </Card>
      )}

      <details className="group mt-6 rounded-xl border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-5 sm:p-6 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">Your registration</h2>
              <Badge tone={open ? "success" : "neutral"}>
                {open
                  ? event.band_registration_deadline
                    ? `Editable until ${formatDate(event.band_registration_deadline, { year: undefined })}`
                    : "Editable while registration is open"
                  : "Registration closed"}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">
              {band.classification} · {band.student_count} students · {band.chaperone_count} chaperones
            </p>
          </div>
          <span className="shrink-0 text-sm font-medium text-brand">
            <span className="group-open:hidden">{open ? "View or edit" : "View"}</span>
            <span className="hidden group-open:inline">Hide</span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-muted transition group-open:rotate-180">
            ▾
          </span>
        </summary>
          <div className="border-t border-border px-5 pb-5 sm:px-6 sm:pb-6">
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <Item label="Classification">{band.classification}</Item>
              <Item label="People">
                {band.student_count} students · {band.chaperone_count} chaperones
              </Item>
              <Item label="Vehicles">
                {[
                  [band.bus_count, "bus", "buses"],
                  [band.box_truck_count, "box truck", "box trucks"],
                  [band.truck_trailer_count, "truck + trailer", "trucks + trailers"],
                  [band.semi_truck_count, "semi", "semis"],
                ]
                  .filter(([n]) => Number(n) > 0)
                  .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`)
                  .join(" · ") || "None listed"}
              </Item>
              <Item label="Head director">
                {band.head_director_name} · {formatPhone(band.head_director_phone)}
              </Item>
              {band.assistant_directors.length > 0 && <Item label="Assistant directors">{band.assistant_directors.join(", ")}</Item>}
              <Item label="Band contact email">{band.contact_email}</Item>
              <Item label="Scheduling conflicts">{band.contest_day_conflicts ?? "None"}</Item>
              <Item label="Accessibility or staging needs">{band.special_needs ?? "None"}</Item>
            </dl>
            {open ? (
              <Link
                href={`/dashboard/bands/${bandId}/edit`}
                className="mt-5 inline-flex min-h-11 items-center rounded-md border border-border bg-surface px-4 text-sm font-medium hover:bg-background"
              >
                Edit registration
              </Link>
            ) : (
              <p className="mt-5 text-sm text-muted">
                Registration is closed, so changes go through the host{hasContact ? " (contact details above)" : ""}.
              </p>
            )}
          </div>
      </details>
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

type TimesEvent = { timezone: string; starts_on: string; ends_on: string; ready_minutes_before: number };

/** Warm-up → ends → ready → performs, as a vertical timeline with the performance time up top. */
function TimesCard({
  title,
  times: t,
  event,
  calendar,
  icsUrl,
  highlight = false,
}: {
  title: string;
  times: BandTimes;
  event: TimesEvent;
  calendar: ReturnType<typeof bandCalendarEvent>;
  icsUrl: string;
  highlight?: boolean;
}) {
  const tz = event.timezone;
  const multiDay = event.starts_on !== event.ends_on;
  const at = (iso: string) => `${formatTime(iso, tz)} ${zoneAbbreviation(iso, tz)}`;
  const warmEnd = warmUpEndAt(t.warm_up_at, t.warm_up_minutes);
  const ready = readyAt(t.perform_at, event.ready_minutes_before);
  const steps = [
    t.warm_up_at && { label: "Warm-up starts", time: at(t.warm_up_at), note: t.warm_up_location },
    warmEnd && { label: "Warm-up ends", time: at(warmEnd), note: `${t.warm_up_minutes} min` },
    ready && { label: "Ready position", time: at(ready), note: `${event.ready_minutes_before} min before performing` },
    t.perform_at && { label: "Performance", time: at(t.perform_at), note: null },
  ].filter(Boolean) as { label: string; time: string; note: string | null }[];

  return (
    <Card className={`mt-6 ${highlight ? "border-brand" : ""}`}>
      <h2 className="font-semibold">{title}</h2>
      {t.perform_at ? (
        <p className="mt-3">
          <span className="block text-sm text-muted">
            Performs{multiDay ? ` ${formatDate(utcToZonedDate(t.perform_at, tz), { year: undefined })}` : ""}
          </span>
          <span className="text-3xl font-semibold tabular-nums">{at(t.perform_at)}</span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">Performance time to be announced.</p>
      )}
      <ol className="mt-5 space-y-0">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-border" aria-hidden="true" />}
            <span
              className={`relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ${s.label === "Performance" ? "bg-brand" : "border-2 border-brand bg-surface"}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-semibold tabular-nums">{s.time}</span> <span className="text-muted">·</span> {s.label}
              </p>
              {s.note && <p className="text-sm text-muted">{s.note}</p>}
            </div>
          </li>
        ))}
      </ol>
      {calendar && (
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className="text-muted">Add to calendar:</span>
          <a href={googleCalendarUrl(calendar)} target="_blank" rel="noreferrer" className={linkClass}>
            Google
          </a>
          <a href={icsUrl} className={linkClass}>
            Apple / Outlook
          </a>
        </p>
      )}
    </Card>
  );
}
