import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  emailFinalists,
  emailTimeChanges,
  publishFinals,
  publishRunningOrder,
  saveSchedule,
  setBandRegistrationOpen,
  updateBandSettings,
} from "@/app/dashboard/band-actions";
import { Badge, Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { BAND_COLUMNS, deadlinePassed, registrationIsOpen, type BandRow } from "@/lib/bands";
import { getEventAccess, getOrigin } from "@/lib/data";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { eachDate, formatDate, utcToZonedDate, utcToZonedTime, zoneName } from "@/lib/time";
import { ActionButton, CopyLinkButton } from "../forms";
import { ScheduleBuilder, type FinalsSlot, type OrderBand, type ScheduleBreak } from "./schedule-builder";
import { BandSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Band Registration" };

type Slot = {
  band_id: string;
  performance_order: number;
  warm_up_at: string | null;
  warm_up_minutes: number | null;
  perform_at: string | null;
  warm_up_location: string | null;
};

export default async function BandsPage({ params }: PageProps<"/dashboard/events/[eventId]/bands">) {
  const { eventId } = await params;
  const access = await getEventAccess(eventId);
  if (!access.canManage) redirect(`/dashboard/events/${eventId}`);

  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, slug, name, status, timezone, starts_on, ends_on, band_registration_open, band_registration_deadline, director_info, performance_order_published, chaperone_limit, classifications, ready_minutes_before, finals_ready_minutes_before, finals_published")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) notFound();

  const user = await requireUser();
  const [{ data: bandData }, { data: slotData }, { data: breakData }, { data: finalsData }, { data: contact }, { data: contactPhone }, { data: profile }] = await Promise.all([
    supabase.from("bands").select(BAND_COLUMNS).eq("event_id", eventId).order("created_at"),
    supabase.from("performance_slots").select("band_id, performance_order, warm_up_at, warm_up_minutes, perform_at, warm_up_location").eq("event_id", eventId),
    supabase.from("schedule_breaks").select("starts_at, minutes, label").eq("event_id", eventId).order("starts_at"),
    supabase
      .from("finals_slots")
      .select("slot_number, band_id, warm_up_at, warm_up_minutes, perform_at, warm_up_location")
      .eq("event_id", eventId)
      .order("slot_number"),
    supabase.from("event_director_contacts").select("name, email").eq("event_id", eventId).maybeSingle(),
    supabase.rpc("director_contact_phone", { ev: eventId }),
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
  ]);
  const regOpen = registrationIsOpen(event);
  const pastDeadline = event.band_registration_open && deadlinePassed(event);
  const bands = (bandData ?? []) as BandRow[];
  const slots = new Map(((slotData ?? []) as Slot[]).map((s) => [s.band_id, s]));
  const tz = event.timezone;
  const days = eachDate(event.starts_on, event.ends_on);
  const origin = await getOrigin();
  const registrationUrl = `${origin}/e/${event.slug}/bands`;

  // Scheduled bands in their order, then anyone not yet placed.
  const ordered = [...bands].sort((a, b) => {
    const sa = slots.get(a.id)?.performance_order ?? Infinity;
    const sb = slots.get(b.id)?.performance_order ?? Infinity;
    return sa - sb || a.created_at.localeCompare(b.created_at);
  });
  // Stored times → wall-clock times on the event's days, for the builder.
  const toTimes = (s: Omit<Slot, "band_id" | "performance_order"> | undefined, fallbackDay: string) => {
    const ref = s?.perform_at ?? s?.warm_up_at;
    return {
      day: ref ? utcToZonedDate(ref, tz) : fallbackDay,
      warmUp: s?.warm_up_at ? utcToZonedTime(s.warm_up_at, tz) : "",
      warmUpMinutes: s?.warm_up_minutes ?? 0,
      perform: s?.perform_at ? utcToZonedTime(s.perform_at, tz) : "",
      location: s?.warm_up_location ?? "",
    };
  };
  const builderBands: OrderBand[] = ordered.map((b) => ({
    id: b.id,
    name: b.band_name,
    school: b.school_name,
    classification: b.classification,
    conflicts: b.contest_day_conflicts,
    ...toTimes(slots.get(b.id), days[0]),
  }));
  const builderBreaks: ScheduleBreak[] = (breakData ?? []).map((b) => ({
    day: utcToZonedDate(b.starts_at, tz),
    start: utcToZonedTime(b.starts_at, tz),
    minutes: b.minutes,
    label: b.label,
  }));
  const finalsSlots = (finalsData ?? []) as (Omit<Slot, "band_id" | "performance_order"> & { slot_number: number; band_id: string | null })[];
  const builderFinals: FinalsSlot[] = finalsSlots.map((f) => ({ bandId: f.band_id ?? "", ...toTimes(f, days.at(-1)!) }));

  const total = (k: keyof BandRow) => bands.reduce((n, b) => n + Number(b[k] ?? 0), 0);
  const byClass = bands.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.classification]: (acc[b.classification] ?? 0) + 1 }), {});

  return (
    <div>
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Band Registration</h1>

      <section className="mt-6">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={regOpen ? "brand" : "neutral"}>
              {event.status !== "published"
                ? "Event not published"
                : regOpen
                  ? "Registration open"
                  : pastDeadline
                    ? "Closed: deadline passed"
                    : "Registration closed"}
            </Badge>
            <span className="text-sm text-muted">
              {bands.length} band{bands.length === 1 ? "" : "s"} registered
            </span>
          </div>
          {event.status !== "published" && (
            <p className="text-sm text-muted">Publish the event from its main page first, then open registration here.</p>
          )}
          {event.band_registration_deadline && (
            <p className="text-sm text-muted">
              {pastDeadline
                ? `The deadline (${formatDate(event.band_registration_deadline)}) has passed. Change it in Registration settings to reopen.`
                : `Closes automatically at the end of ${formatDate(event.band_registration_deadline)}.`}
            </p>
          )}
          <div>
            <p className="text-sm font-medium">Link for band directors</p>
            <p className="mt-1 break-all text-sm text-muted">{registrationUrl}</p>
            <div className="mt-2">
              <CopyLinkButton url={registrationUrl} label="Copy link" />
            </div>
          </div>
          {access.isHost && (
            <details className="rounded-lg border border-border px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">Registration settings</summary>
              <div className="mt-4">
                <BandSettingsForm
                  action={updateBandSettings.bind(null, eventId)}
                  chaperoneLimit={event.chaperone_limit}
                  classifications={event.classifications}
                  deadline={event.band_registration_deadline ?? ""}
                  directorInfo={event.director_info ?? ""}
                  contact={{
                    name: contact?.name || profile?.full_name || "",
                    phone: formatPhone(contact ? contactPhone : profile?.phone),
                    email: contact?.email || user.email || "",
                  }}
                  contactSaved={Boolean(contact)}
                />
              </div>
            </details>
          )}
          {access.isHost && event.status === "published" && (
            <ActionButton
              action={setBandRegistrationOpen.bind(null, eventId, !event.band_registration_open)}
              variant={event.band_registration_open ? "stop" : "go"}
              confirmMessage={event.band_registration_open ? "Close band registration? Directors won't be able to register or make changes." : undefined}
            >
              {event.band_registration_open ? "Close band registration" : "Open band registration"}
            </ActionButton>
          )}
        </Card>
      </section>

      {bands.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Logistics totals</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Students", total("student_count")],
              ["Chaperones", total("chaperone_count")],
              ["Buses", total("bus_count")],
              ["Box trucks", total("box_truck_count")],
              ["Truck + trailers", total("truck_trailer_count")],
              ["Semi trucks", total("semi_truck_count")],
            ].map(([label, value]) => (
              <Card key={label as string} className="p-4">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
              </Card>
            ))}
            <Card className="col-span-2 p-4">
              <dt className="text-sm text-muted">By classification</dt>
              <dd className="mt-1 text-sm">
                {Object.entries(byClass)
                  .sort()
                  .map(([c, n]) => `${c}: ${n}`)
                  .join(" · ")}
              </dd>
            </Card>
          </dl>
        </section>
      )}

      {access.isHost && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Performance schedule</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            All times {zoneName(tz)}. Directors and the public only see a round once you publish it from the bar at the
            bottom. Conflicts directors reported are shown with ⚠️.
          </p>
          <ScheduleBuilder
            initialBands={builderBands}
            initialBreaks={builderBreaks}
            initialFinals={builderFinals}
            initialReadyMinutes={event.ready_minutes_before}
            initialFinalsReadyMinutes={event.finals_ready_minutes_before}
            days={days}
            zoneLabel={zoneName(tz)}
            orderPublished={event.performance_order_published}
            finalsPublished={event.finals_published}
            save={saveSchedule.bind(null, eventId)}
            emailChanges={emailTimeChanges.bind(null, eventId)}
            publishOrder={publishRunningOrder.bind(null, eventId)}
            publishFinals={publishFinals.bind(null, eventId)}
            emailFinalists={emailFinalists.bind(null, eventId)}
          />
        </section>
      )}

      {bands.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Registrations</h2>
          <ul className="mt-4 space-y-3">
            {bands.map((b) => (
              <li key={b.id}>
                <details className="rounded-xl border border-border bg-surface px-4 py-3">
                  <summary className="cursor-pointer">
                    <span className="font-semibold">{b.band_name}</span>
                    <span className="text-muted">
                      {" "}
                      · {b.school_name} · {b.classification} · {b.student_count} students
                    </span>
                  </summary>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <Detail label="Head director">
                      {b.head_director_name} ·{" "}
                      <a className="text-brand hover:underline" href={`tel:${b.head_director_phone}`}>
                        {formatPhone(b.head_director_phone)}
                      </a>{" "}
                      ·{" "}
                      <a className="text-brand hover:underline" href={`mailto:${b.head_director_email}`}>
                        {b.head_director_email}
                      </a>
                    </Detail>
                    <Detail label="Assistant directors">{b.assistant_directors.join(", ") || "None listed"}</Detail>
                    <Detail label="Band contact">{b.contact_email}</Detail>
                    <Detail label="School address">{b.school_address}</Detail>
                    <Detail label="People">
                      {b.student_count} students · {b.chaperone_count} chaperones
                    </Detail>
                    <Detail label="Vehicles">
                      {b.bus_count} buses · {b.box_truck_count} box trucks · {b.truck_trailer_count} truck/trailers ·{" "}
                      {b.semi_truck_count} semis
                    </Detail>
                    <Detail label="Conflicts">{b.contest_day_conflicts ?? "None"}</Detail>
                    <Detail label="Accessibility / staging">{b.special_needs ?? "None"}</Detail>
                  </dl>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
