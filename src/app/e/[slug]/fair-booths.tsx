import { createClient } from "@/lib/supabase/server";

type PublicBooth = { id: string; title: string; host_name: string | null; zone: string | null; location: string | null; description: string | null };

const ZONE_ICON: Record<string, string> = {
  "game zone": "🎯",
  "activity stations": "🎨",
  marketplace: "🛍️",
  showcase: "🎭",
  "food & drinks": "🍿",
};

/** A fair's public "What's at the fair": booths by zone, with a thank-you to who hosts each one. */
export async function FairBooths({ slug }: { slug: string }) {
  const { data } = await (await createClient()).rpc("public_fair_booths", { p_slug: slug });
  const booths = (data ?? []) as PublicBooth[];
  if (booths.length === 0) return null;
  const zones = [...new Set(booths.map((b) => b.zone ?? ""))];
  const hosts = [...new Set(booths.map((b) => b.host_name).filter((h): h is string => Boolean(h)))];
  return (
    <section className="mt-10" aria-labelledby="fair-heading">
      <h2 id="fair-heading" className="text-2xl font-medium tracking-tight">
        What&apos;s at the fair
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {zones.map((zone) => (
          <div key={zone || "more"} className="rounded-lg border border-border bg-surface p-4 shadow-card sm:p-5">
            <h3 className="text-lg font-semibold">
              <span aria-hidden>{ZONE_ICON[zone.toLowerCase()] ?? "✨"} </span>
              {zone || "And more"}
            </h3>
            <ul className="mt-2 space-y-2">
              {booths
                .filter((b) => (b.zone ?? "") === zone)
                .map((b) => (
                  <li key={b.id} className="leading-6">
                    <span className="font-medium">{b.title}</span>
                    {b.host_name && <span className="text-muted"> · hosted by {b.host_name}</span>}
                    {(b.description || b.location) && (
                      <span className="block text-sm text-muted">{[b.description, b.location].filter(Boolean).join(" · ")}</span>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      {hosts.length > 0 && (
        <p className="mt-4 text-sm leading-6 text-muted">
          <span className="font-semibold text-foreground">Thank you to our community partners:</span> {hosts.join(", ")}.
        </p>
      )}
    </section>
  );
}
