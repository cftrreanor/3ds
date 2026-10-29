import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { Badge, Card } from "@/components/ui";
import { eventPhase } from "@/lib/contest-day";
import { getEventAccess, getOrigin } from "@/lib/data";
import { FAIR_ZONES, hasBooths } from "@/lib/event-types";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time";
import { ActionButton, CopyLinkButton } from "../forms";
import { addZone, deleteBooth, deleteZone, renameZone, saveBooth } from "./actions";
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
 * Leads set them up like Volunteer Setup: a card with the public list's link,
 * then a tab per zone with its booths. Partner check-in is its own page
 * (check-in/), like volunteer check-in; the rest of the team goes straight there.
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
  if (!access.canManage) redirect(`/dashboard/events/${eventId}/booths/check-in`);

  const { data, error } = await supabase
    .from("fair_booths")
    .select("id, title, host_name, zone, location, description, contact_name, contact_email, contact_phone, show_publicly, arrived_at")
    .eq("event_id", eventId)
    .order("zone", { nullsFirst: false })
    .order("title");
  if (error) missing();
  const booths = (data ?? []) as Booth[];
  const isDay = eventPhase(event, new Date()) === "day";
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
    />
  );

  const setup = (
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
  );

  const publicUrl = `${await getOrigin()}/e/${event.slug}`;
  const [qrSvg, qrPng] = await Promise.all([
    QRCode.toString(publicUrl, { type: "svg", margin: 1, width: 160 }),
    QRCode.toDataURL(publicUrl, { margin: 2, width: 1024 }),
  ]);
  const smallButton = "inline-flex min-h-9 items-center rounded-md border border-border bg-surface px-3 text-xs font-medium hover:bg-background";
  const published = event.status === "published";

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
      </div>

      {/* On fair day, check-in is one tap away. */}
      {isDay && partners.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-brand p-4">
          <p className="text-sm leading-6">
            <span className="font-semibold">It&apos;s fair day.</span> {arrived} of {partners.length} partners have arrived.
          </p>
          <Link
            href={`${base}/check-in`}
            className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
          >
            Open check-in
          </Link>
        </Card>
      )}

      {/* Where the public list stands, its link, and check-in. */}
      <Card>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={published ? "live" : "neutral"}>{published ? "On the public page" : "Event not published"}</Badge>
          <span className="text-muted">
            {booths.length} {booths.length === 1 ? "booth" : "booths"} in {zones.length} {zones.length === 1 ? "zone" : "zones"} · {partners.length}{" "}
            {partners.length === 1 ? "partner" : "partners"}
          </span>
        </p>
        <div className="mt-4">
          <p className="text-sm font-medium">Public page</p>
          <p className="mt-1 break-all text-sm text-muted">{publicUrl}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyLinkButton url={publicUrl} label="Copy link" />
            <a href={`/e/${event.slug}`} target="_blank" className={smallButton}>
              Preview page
            </a>
            <Link href={`${base}/check-in`} className={smallButton}>
              Check-in
            </Link>
          </div>
          {!published && (
            <p className="mt-3 rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm">
              Publish the event from its main page to show your booths to families.
            </p>
          )}
          <p className="mt-2 text-sm text-muted">
            Booths marked &ldquo;Show on the public page&rdquo; are listed by zone under &ldquo;What&apos;s at the event.&rdquo; On fair
            day, your team taps partners in on Check-in as they arrive.
          </p>
          {/* Tucked away to keep the top of the page short; open it to show or download the code. */}
          <details className="group mt-1">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
              <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
                ›
              </span>
              QR code
            </summary>
            <div className="mt-2 flex flex-col items-start gap-2">
              <div
                className="rounded-lg border border-border bg-white p-2"
                aria-label="QR code for the public page"
                role="img"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <a href={qrPng} download={`${event.slug}-qr.png`} className="inline-flex min-h-11 items-center text-xs font-medium text-brand underline-offset-4 hover:underline">
                Download QR code
              </a>
            </div>
          </details>
        </div>
      </Card>

      {setup}
    </div>
  );
}
