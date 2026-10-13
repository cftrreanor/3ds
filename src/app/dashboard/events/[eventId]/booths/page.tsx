import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/app/e/[slug]/auto-refresh";
import { SetupStep, StepStatus } from "@/components/setup-step";
import { Badge, Card } from "@/components/ui";
import { eventPhase } from "@/lib/contest-day";
import { getEventAccess } from "@/lib/data";
import { FAIR_ZONES, hasBooths } from "@/lib/event-types";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/time";
import { ActionButton, DeleteButton } from "../forms";
import { addZone, checkInBooth, deleteBooth, deleteZone, renameZone, saveBooth } from "./actions";
import { ArrivedButton } from "./arrived-button";
import { BoothForm, NewZoneForm, ZoneForm, ZoneRow, type BoothValues } from "./booth-form";

export const metadata: Metadata = { title: "Booths & Partners" };

type Booth = BoothValues & { id: string; arrived_at: string | null };

/**
 * A fair's booths and community partners, by zone. The host and Volunteer
 * Leads set them up in steps (see "Setup pages" in docs/DESIGN.md); on fair
 * day anyone on the team taps partners in.
 */
export default async function BoothsPage({ params }: PageProps<"/dashboard/events/[eventId]/booths">) {
  const { eventId } = await params;
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
  const partners = booths.filter((b) => b.host_name);
  const arrived = partners.filter((b) => b.arrived_at).length;
  // The fair's zones (step 1), in the order they were made, plus any a booth or
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

  return (
    <div className="space-y-6">
      {isDay && <AutoRefresh seconds={30} />}
      <div>
        <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
          ← Back to {event.name}
        </Link>
        <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Booths &amp; Partners</h1>
        <p className="mt-1 text-muted">
          Everything at the event, by zone: games, activities, vendors and showcases, and who hosts each one.
          {event.status === "published" ? " Listed ones show on the public page." : " Listed ones show on the public page once the event is published."}
        </p>
      </div>

      {canManage && (
        <div className="flex flex-col gap-3">
          <SetupStep
            id="zones"
            title="1. Zones"
            status={<StepStatus done={zones.length > 0} doneLabel={`${zones.length} ${zones.length === 1 ? "zone" : "zones"}`} />}
            open={zones.length === 0}
            intro="The areas of your fair, like Game Zone or Marketplace. Booths go into them, and they group booths on the public page so families can find their way around."
          >
            <div className="space-y-4">
              {zones.length > 0 && (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {zones.map((z) => (
                    <ZoneRow
                      key={z}
                      name={z}
                      booths={booths.filter((b) => b.zone === z).length}
                      rename={renameZone.bind(null, eventId, z)}
                      remove={deleteZone.bind(null, eventId, z)}
                    />
                  ))}
                </ul>
              )}
              <NewZoneForm action={addZone.bind(null, eventId, null)} />
              {suggestions.length > 0 && (
                <div>
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
            </div>
          </SetupStep>

          <SetupStep
            id="booths"
            title="2. Booths"
            status={
              booths.length > 0 && unzoned.length > 0 ? (
                <StepStatus done={false} todoLabel={`${unzoned.length} ${unzoned.length === 1 ? "needs" : "need"} a zone`} />
              ) : (
                <StepStatus
                  done={booths.length > 0}
                  doneLabel={`${booths.length} ${booths.length === 1 ? "booth" : "booths"}`}
                  todoLabel={zones.length === 0 ? "Add zones first" : "Needs to be done"}
                />
              )
            }
            open={zones.length > 0 && (booths.length === 0 || unzoned.length > 0)}
            intro="Your games, activities, vendors and showcases, the partner who hosts each one, and its zone. Edit or delete one from the list below."
          >
            <div className="space-y-6">
              <BoothForm action={saveBooth.bind(null, eventId, null)} zones={zones} />
              {unzoned.length > 0 && (
                <div>
                  <h3 className="font-semibold">Pick a zone for these</h3>
                  <ul className="mt-3 space-y-3">
                    {unzoned.map((b) => (
                      <li key={b.id} className="rounded-lg border border-border px-4 py-3">
                        <p className="font-semibold">
                          {b.title}
                          {b.host_name && <span className="font-normal text-muted"> · {b.host_name}</span>}
                        </p>
                        <div className="mt-3">
                          <ZoneForm action={saveBooth.bind(null, eventId, b.id)} booth={b} zones={zones} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </SetupStep>
        </div>
      )}

      {partners.length > 0 && (
        <Card className={isDay ? "border-brand" : ""}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">{isDay ? "Partner check-in" : "Partners"}</h2>
            <p className="text-lg font-semibold tabular-nums">
              {arrived} of {partners.length} arrived
            </p>
          </div>
          <p className="mt-1 text-sm text-muted">
            {isDay
              ? "Tap Arrived as each partner or vendor checks in. Updates every 30 seconds for everyone on the team."
              : "On fair day, anyone on your team can tap partners in here as they arrive."}
          </p>
          {isDay && arrived < partners.length && (
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

      {!canManage && booths.length === 0 && <p className="text-muted">No booths added yet.</p>}

      {groups.map((g) => (
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
                    <div className="flex items-center gap-2">
                      {b.host_name && (
                        <ArrivedButton
                          arrived={Boolean(b.arrived_at)}
                          time={b.arrived_at ? formatTime(b.arrived_at, event.timezone) : null}
                          toggle={checkInBooth.bind(null, eventId, b.id)}
                        />
                      )}
                      {canManage && (
                        <DeleteButton
                          action={deleteBooth.bind(null, eventId, b.id)}
                          label={`Delete ${b.title}`}
                          confirmMessage={`Delete “${b.title}”${b.host_name ? ` (${b.host_name})` : ""}?`}
                        />
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <details className="mt-3 rounded-lg border border-border px-4 py-3">
                      <summary className="cursor-pointer text-sm font-medium">Edit</summary>
                      <div className="mt-4">
                        <BoothForm action={saveBooth.bind(null, eventId, b.id)} initial={b} zones={zones} submitLabel="Save" />
                      </div>
                    </details>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
