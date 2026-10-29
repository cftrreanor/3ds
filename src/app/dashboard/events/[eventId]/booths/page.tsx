import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Card } from "@/components/ui";
import { eventPhase } from "@/lib/contest-day";
import { getEventAccess } from "@/lib/data";
import { FAIR_ZONES, hasBooths } from "@/lib/event-types";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatTime, utcToZonedDate } from "@/lib/time";
import { ActionButton } from "../forms";
import { addZone, checkInBooth, deleteBooth, deleteZone, renameZone, saveBooth } from "./actions";
import { ArrivedButton } from "./arrived-button";
import { NewZoneForm, ZoneBooths, ZoneHeader, type BoothRow, type BoothValues } from "./booth-form";
import { ZoneTabs } from "./zone-tabs";
import { SavedBy } from "@/components/saved-by";

export const metadata: Metadata = { title: "Booths & Partners" };

type Booth = BoothValues & { id: string; arrived_at: string | null };

// The tabs that aren't zones: booths with none, and "+ Add zone".
const NO_ZONE = "__none";
const NEW_ZONE = "__new";

/**
 * A fair's booths and community partners, by zone. The host and Volunteer
 * Leads set them up like Volunteer Setup: a tab per zone with its booths; on
 * fair day anyone on the team taps partners in.
 */
export default async function BoothsPage({ params, searchParams }: PageProps<"/dashboard/events/[eventId]/booths">) {
  const { eventId } = await params;
  const { zone: tab } = await searchParams;
  const supabase = await createClient();
  const [access, { data: staff }, { data: event }] = await Promise.all([
    getEventAccess(eventId),
    supabase.rpc("is_event_staff", { ev: eventId }),
    supabase.from("events").select("id, name, slug, status, timezone, starts_on, ends_on, event_type").eq("id", eventId).maybeSingle(),
  ]);
  if (!access.isHost && !staff) redirect("/dashboard");
  if (!event) missing();
  if (!hasBooths(event.event_type)) redirect(`/dashboard/events/${eventId}`);

  const { data, error } = await supabase
    .from("fair_booths")
    .select("id, title, host_name, zone, location, description, contact_name, contact_email, contact_phone, show_publicly, arrived_at")
    .eq("event_id", eventId)
    .order("zone", { nullsFirst: false })
    .order("title");
  if (error) missing();
  const booths = (data ?? []) as Booth[];
  const canManage = access.canManage;
  const isDay = eventPhase(event, new Date()) === "day";
  // Arrived buttons from the day before (setup) through the fair, not weeks ahead.
  const today = utcToZonedDate(new Date().toISOString(), event.timezone);
  const dayBefore = new Date(Date.parse(`${event.starts_on}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const checkInOpen = today >= dayBefore && today <= event.ends_on;
  const partners = booths.filter((b) => b.host_name);
  const arrived = partners.filter((b) => b.arrived_at).length;
  // The fair's zones, in the order they were made, plus any a booth or
  // station already uses (sample data, older events).
  const [{ data: zoneRows }, { data: stationZones }] = await Promise.all([
    supabase.from("fair_zones").select("name").eq("event_id", eventId).order("created_at"),
    supabase.from("stations").select("zone").eq("event_id", eventId).not("zone", "is", null),
  ]);
  const zones = [
    ...new Set(
      [...(zoneRows ?? []).map((z) => z.name), ...booths.map((b) => b.zone), ...(stationZones ?? []).map((s) => s.zone)].filter(
        (z): z is string => Boolean(z),
      ),
    ),
  ];
  const suggestions = FAIR_ZONES.filter((z) => !zones.includes(z));
  const unzoned = booths.filter((b) => !b.zone);
  const groups = [...new Set(booths.map((b) => b.zone ?? ""))].map((zone) => ({ zone, booths: booths.filter((b) => (b.zone ?? "") === zone) }));

  // The zone tabs, like the sign-up tabs in Volunteer Setup: ?zone=<name>, the
  // booths with none (older events), or "+ Add zone" (also when there are none yet).
  const base = `/dashboard/events/${eventId}/booths`;
  const tabHref = (key: string) => `${base}?zone=${encodeURIComponent(key)}`;
  const adding = tab === NEW_ZONE || zones.length === 0;
  const current = adding
    ? NEW_ZONE
    : tab === NO_ZONE && unzoned.length
      ? NO_ZONE
      : typeof tab === "string" && zones.includes(tab)
        ? tab
        : unzoned.length && !zones.length
          ? NO_ZONE
          : zones[0];
  const rows = (list: Booth[]): BoothRow[] =>
    list.map((b) => ({
      ...b,
      phone: b.contact_phone ? formatPhone(b.contact_phone) : null,
      arrived: Boolean(b.arrived_at),
      arrivedTime: b.arrived_at ? formatTime(b.arrived_at, event.timezone) : null,
    }));
  const zoneBooths = (zone: string | null) => (
    <ZoneBooths
      booths={rows(booths.filter((b) => (b.zone ?? null) === zone))}
      zones={zones}
      zone={zone}
      save={saveBooth.bind(null, eventId)}
      remove={deleteBooth.bind(null, eventId)}
      checkIn={checkInOpen && !isDay ? checkInBooth.bind(null, eventId) : undefined}
    />
  );

  const setup = canManage ? (
    <section aria-labelledby="zones-heading">
      <h2 id="zones-heading" className="text-xl font-semibold">
        Zones and booths
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted">
        Each zone is an area of your fair, like Game Zone or Marketplace. Open one to add its booths: the games, activities, vendors,
        and showcases there, and who runs each one.
      </p>
      <ZoneTabs
        tabs={[
          ...zones.map((z) => ({ key: z, name: z, booths: booths.filter((b) => b.zone === z).length, active: current === z, href: tabHref(z) })),
          ...(unzoned.length ? [{ key: NO_ZONE, name: "No zone", booths: unzoned.length, active: current === NO_ZONE, href: tabHref(NO_ZONE), unzoned: true }] : []),
        ]}
        add={{ href: tabHref(NEW_ZONE), active: current === NEW_ZONE }}
      />
      {/* A fresh panel per tab, so nothing from the last zone stays open. */}
      <Card key={current} className="mt-6">
        {current === NEW_ZONE ? (
          <>
            <h3 className="text-lg font-semibold">{zones.length ? "Add a zone" : "Add your first zone"}</h3>
            <p className="mt-1 mb-4 text-sm text-muted">
              Name it, then add its booths. Zones group booths on the public page so families can find their way around.
            </p>
            <NewZoneForm action={addZone.bind(null, eventId, null)} />
            {suggestions.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-muted">Or add a common one:</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((z) => (
                    <ActionButton key={z} action={addZone.bind(null, eventId, z)} variant="secondary" pendingText="Adding…">
                      + {z}
                    </ActionButton>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : current === NO_ZONE ? (
          <>
            <h3 className="text-xl font-semibold">No zone</h3>
            <p className="mt-1 text-sm text-muted">
              These booths were added before every booth needed a zone. Open each one, pick its zone, and save.
            </p>
            {zoneBooths(null)}
          </>
        ) : (
          <>
            <ZoneHeader
              name={current}
              booths={booths.filter((b) => b.zone === current).length}
              otherZones={zones.filter((z) => z !== current)}
              rename={renameZone.bind(null, eventId, current)}
              remove={deleteZone.bind(null, eventId, current)}
            />
            {zoneBooths(current)}
          </>
        )}
      </Card>
    </section>
  ) : null;

  // Who can't change booths, and everyone on fair day: the list by zone, with Arrived buttons on the day.
  const list = groups.map((g) => (
    <section key={g.zone || "none"} aria-label={g.zone || "No zone"}>
      <h2 className="text-xl font-semibold">
        {g.zone || "No zone yet"} <span className="text-base font-normal text-muted">({g.booths.length})</span>
      </h2>
      <ul className="mt-3 space-y-3">
        {g.booths.map((b) => (
          <li key={b.id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">
                    {b.title}
                    {!b.show_publicly && (
                      <span className="ml-2 align-middle">
                        <Badge>Not on public page</Badge>
                      </span>
                    )}
                  </p>
                  {b.host_name && <p className="text-sm">Hosted by {b.host_name}</p>}
                  <p className="text-sm text-muted">{[b.location, b.description].filter(Boolean).join(" · ")}</p>
                  {(b.contact_name || b.contact_email || b.contact_phone) && (
                    <p className="mt-1 text-sm text-muted">
                      {[b.contact_name, b.contact_email, b.contact_phone ? formatPhone(b.contact_phone) : null].filter(Boolean).join(" · ")}
                      {b.contact_phone && (
                        <>
                          {" "}
                          <a href={`tel:${b.contact_phone}`} className="font-medium text-brand underline-offset-4 hover:underline">
                            Call
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </div>
                {b.host_name && checkInOpen && (
                  <ArrivedButton
                    arrived={Boolean(b.arrived_at)}
                    time={b.arrived_at ? formatTime(b.arrived_at, event.timezone) : null}
                    toggle={checkInBooth.bind(null, eventId, b.id)}
                  />
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  ));
  const publicHref = `/e/${event.slug}`;

  return (
    // data-required-marks: a small asterisk on each box that has to be filled in (globals.css).
    <div className="space-y-6" data-required-marks>
      <div>
        <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
          ← Back to {event.name}
        </Link>
        <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Booths &amp; Partners</h1>
        <SavedBy eventId={eventId} area="booths" className="mt-2" />
        <p className="mt-1 text-muted">Everything at your fair, by zone: games, activities, vendors, and showcases, and who runs each one.</p>
        {isDay && <AutoRefresh seconds={10} status className="mt-1" />}
      </div>

      {canManage && !isDay && (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={event.status === "published" ? "brand" : "neutral"}>{event.status === "published" ? "On the public page" : "Event not published"}</Badge>
            <span className="text-sm text-muted">
              {booths.length} {booths.length === 1 ? "booth" : "booths"} in {zones.length} {zones.length === 1 ? "zone" : "zones"} · {partners.length}{" "}
              {partners.length === 1 ? "partner" : "partners"}
            </span>
          </div>
          <p className="mt-4 text-sm font-medium">Public list</p>
          <p className="mt-1 text-sm text-muted">
            Booths marked &ldquo;Show on the public page&rdquo; are listed by zone under &ldquo;What&apos;s at the event&rdquo;
            {event.status === "published" ? "." : " once the event is published."} On fair day, anyone on your team taps partners in here as they arrive.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href={publicHref}
              target="_blank"
              className="inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium hover:bg-background"
            >
              Preview public page
            </a>
          </div>
        </Card>
      )}

      {/* On fair day check-in comes first; setup folds away under one link. */}
      {!isDay && setup}

      {isDay && partners.length > 0 && (
        <Card id="check-in" className="scroll-mt-6 border-brand">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">Partner check-in</h2>
            <p className="text-lg font-semibold tabular-nums">
              {arrived} of {partners.length} arrived
            </p>
          </div>
          <p className="mt-1 text-sm text-muted">Tap Arrived as each partner or vendor checks in. Everyone on the team sees it within seconds.</p>
          {arrived < partners.length && (
            <p className="mt-2 text-sm">
              <span className="font-semibold">Not here yet:</span>{" "}
              {partners
                .filter((b) => !b.arrived_at)
                .map((b) => b.host_name)
                .join(", ")}
            </p>
          )}
        </Card>
      )}

      {isDay && setup && (
        <details className="rounded-lg border border-border px-4 py-1">
          <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Edit booths and zones</summary>
          <div className="pb-3 pt-2">{setup}</div>
        </details>
      )}

      {!canManage && booths.length === 0 && <p className="text-muted">No booths added yet.</p>}
      {(isDay || !canManage) && list}
    </div>
  );
}
