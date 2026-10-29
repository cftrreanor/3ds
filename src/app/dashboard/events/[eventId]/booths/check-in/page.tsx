import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/auto-refresh";
import { Badge, Card } from "@/components/ui";
import { eventPhase } from "@/lib/contest-day";
import { getEventAccess } from "@/lib/data";
import { hasBooths } from "@/lib/event-types";
import { formatPhone } from "@/lib/phone";
import { missing } from "@/lib/schema-check";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime, utcToZonedDate } from "@/lib/time";
import { checkInBooth } from "../actions";
import { ArrivedButton } from "../arrived-button";

export const metadata: Metadata = { title: "Partner check-in" };

type Booth = {
  id: string;
  title: string;
  host_name: string | null;
  zone: string | null;
  location: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  show_publicly: boolean;
  arrived_at: string | null;
};

/**
 * A fair's partner check-in: tap Arrived as each partner or vendor sets up.
 * Its own page, like volunteer and parent check-in, so it's all there is on
 * the phone in hand. Hosts and the event's team.
 */
export default async function PartnerCheckInPage({ params }: PageProps<"/dashboard/events/[eventId]/booths/check-in">) {
  const { eventId } = await params;
  const supabase = await createClient();
  const [access, { data: staff }, { data: event }] = await Promise.all([
    getEventAccess(eventId),
    supabase.rpc("is_event_staff", { ev: eventId }),
    supabase.from("events").select("id, name, timezone, starts_on, ends_on, event_type").eq("id", eventId).maybeSingle(),
  ]);
  if (!access.isHost && !staff) redirect("/dashboard");
  if (!event) missing();
  if (!hasBooths(event.event_type)) redirect(`/dashboard/events/${eventId}`);

  const { data, error } = await supabase
    .from("fair_booths")
    .select("id, title, host_name, zone, location, contact_name, contact_phone, show_publicly, arrived_at")
    .eq("event_id", eventId)
    .order("zone", { nullsFirst: false })
    .order("title");
  if (error) missing();
  const booths = (data ?? []) as Booth[];
  const partners = booths.filter((b) => b.host_name);
  const arrived = partners.filter((b) => b.arrived_at).length;
  const isDay = eventPhase(event, new Date()) === "day";
  // Arrived buttons from the day before (setup) through the fair, not weeks ahead.
  const today = utcToZonedDate(new Date().toISOString(), event.timezone);
  const dayBefore = new Date(Date.parse(`${event.starts_on}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  const checkInOpen = today >= dayBefore && today <= event.ends_on;
  const groups = [...new Set(booths.map((b) => b.zone ?? ""))].map((zone) => ({ zone, booths: booths.filter((b) => (b.zone ?? "") === zone) }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/dashboard/events/${eventId}`} className="text-sm text-muted hover:text-foreground">
        ← Back to {event.name}
      </Link>
      <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-4xl">Partner check-in</h1>
      {isDay && <AutoRefresh seconds={10} status className="mt-1" />}
      <p className="mt-4 leading-7 text-muted">Tap Arrived as each partner or vendor checks in. Everyone on the team sees it within seconds.</p>

      {partners.length > 0 && (
        <div className="sticky top-0 z-10 -mx-4 mt-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
          <p className="text-sm font-medium">
            <span className="text-2xl font-semibold tabular-nums">{arrived}</span>
            <span className="text-muted"> / {partners.length} partners arrived</span>
          </p>
          {arrived > 0 && arrived < partners.length && (
            <p className="mt-1 text-sm">
              <span className="font-semibold">Not here yet:</span>{" "}
              {partners
                .filter((b) => !b.arrived_at)
                .map((b) => b.host_name)
                .join(", ")}
            </p>
          )}
        </div>
      )}
      {!checkInOpen && partners.length > 0 && (
        <p className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-sm">
          Arrived buttons turn on {formatDate(dayBefore)}, the day before the fair, so no one gets checked in early.
        </p>
      )}
      {booths.length === 0 && <p className="mt-6 text-muted">No booths added yet.</p>}

      <div className="mt-6 space-y-8">
        {groups.map((g) => (
          <section key={g.zone || "none"} aria-label={g.zone || "No zone"}>
            <h2 className="text-xl font-semibold">
              {g.zone || "No zone yet"} <span className="text-base font-normal text-muted">({g.booths.length})</span>
            </h2>
            <ul className="mt-3 space-y-3">
              {g.booths.map((b) => (
                <li key={b.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {b.title}
                          {!b.show_publicly && (
                            <span className="ml-2 align-middle">
                              <Badge>Not on public page</Badge>
                            </span>
                          )}
                        </p>
                        {b.host_name && <p className="text-sm">Hosted by {b.host_name}</p>}
                        {b.location && <p className="text-sm text-muted">{b.location}</p>}
                        {b.contact_phone && (
                          <a href={`tel:${b.contact_phone}`} className="inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline">
                            {b.contact_name ? `${b.contact_name} · ` : ""}
                            {formatPhone(b.contact_phone)}
                          </a>
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
        ))}
      </div>
    </div>
  );
}
