import Link from "next/link";
import { Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

/** On a fair's event page: booths by zone and, on fair day, how many partners have arrived. */
export async function BoothsCard({ eventId, isDay }: { eventId: string; isDay: boolean }) {
  const { data } = await (await createClient()).from("fair_booths").select("zone, host_name, arrived_at").eq("event_id", eventId);
  const booths = (data ?? []) as { zone: string | null; host_name: string | null; arrived_at: string | null }[];
  const partners = booths.filter((b) => b.host_name);
  const arrived = partners.filter((b) => b.arrived_at).length;
  const zones = new Set(booths.map((b) => b.zone).filter(Boolean)).size;
  return (
    <section className="mt-10" aria-labelledby="booths-heading">
      <h2 id="booths-heading" className="text-xl font-semibold">
        Booths &amp; Partners
      </h2>
      <Card className={`mt-4 ${isDay ? "border-brand" : ""}`}>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between [&>*:last-child]:shrink-0">
          <p className="text-sm leading-6">
            {booths.length === 0 ? (
              "Add your games, activities, vendors and showcases, and the partners who host them."
            ) : (
              <>
                <span className="font-medium">
                  {booths.length} booth{booths.length === 1 ? "" : "s"}
                  {zones ? ` in ${zones} zone${zones === 1 ? "" : "s"}` : ""}
                </span>
                {partners.length > 0 && (
                  <span className="text-muted">
                    {" "}
                    · {isDay ? `${arrived} of ${partners.length} partners arrived` : `${partners.length} partner${partners.length === 1 ? "" : "s"}`}
                  </span>
                )}
              </>
            )}
          </p>
          <Link
            href={`/dashboard/events/${eventId}/booths`}
            className="inline-flex min-h-11 items-center rounded-md bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
          >
            {isDay ? "Partner check-in" : booths.length ? "Manage booths" : "Add booths"}
          </Link>
        </div>
      </Card>
    </section>
  );
}
