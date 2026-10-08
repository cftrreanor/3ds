import { Card } from "@/components/ui";
import { readyAt } from "@/lib/bands";
import { dueAt, sortStations, type BandDay, type Checkpoint, type Round, type Stop } from "@/lib/contest-day";

/** One row of my_band_progress(): a stop on the path, and the band's tap there (if any). */
export type ProgressRow = Checkpoint & { station_id: string; round: Round | null; performed: boolean; reached_at: string | null };
type Times = { warm_up_at: string | null; warm_up_minutes: number | null; perform_at: string | null; warm_up_location: string | null } | null;

/** `at`: a start time (warm-up, performance); otherwise a deadline ("by"). */
type Step = { key: string; label: string; done: string | null; due: string | null; where?: string | null; at?: boolean };

/**
 * On contest day: where the director's band is along the check-in path, what's
 * next and by when, and their equipment spot. Steps follow the host's order.
 */
export function ContestDayCard({
  band,
  rows,
  prelims,
  finals,
  readyMinutes,
  finalsReadyMinutes,
  time,
}: {
  band: BandDay & { band_name: string };
  rows: ProgressRow[];
  prelims: Times;
  /** Only once the finalists are revealed. */
  finals: Times;
  readyMinutes: number;
  finalsReadyMinutes: number;
  time: (iso: string) => string;
}) {
  const path = sortStations([...new Map(rows.map((r) => [r.station_id, { ...r, id: r.station_id }])).values()]);
  const stops: Stop[] = rows
    .filter((r) => r.reached_at)
    .map((r) => ({ band_id: band.id, station_id: r.station_id, round: r.round, performed: r.performed, reached_at: r.reached_at! }));
  const tapped = (station: Checkpoint, round: Round | null, performed = false) =>
    stops.find((s) => s.station_id === station.id && s.performed === performed && (round === null ? s.round === null : s.round === round))
      ?.reached_at ?? null;
  // A finalist moves on to the finals path once they've performed in prelims.
  const prelimsDone = path.some((c) => c.checkpoint_kind === "gate" && tapped(c, "prelims", true));
  const round: Round = finals && prelimsDone ? "finals" : "prelims";
  const slot = round === "finals" ? finals : prelims;
  const ready = round === "finals" ? finalsReadyMinutes : readyMinutes;

  const steps: Step[] = path.flatMap((c): Step[] => {
    switch (c.checkpoint_kind) {
      case "parking": {
        const parked = band.buses_at || band.equipment_at;
        const bits = [
          band.buses_at ? `Buses ${time(band.buses_at)}` : null,
          band.equipment_at ? `Equipment${band.equipment_spot ? ` in Spot ${band.equipment_spot}` : ` ${time(band.equipment_at)}`}` : null,
        ].filter(Boolean);
        return [{ key: c.id, label: "Park buses and equipment", done: parked ? bits.join(" · ") : null, due: dueAt(c, prelims ?? undefined, readyMinutes) }];
      }
      case "stop": {
        const at = tapped(c, null);
        return [{ key: c.id, label: c.name, done: at && `Here ${time(at)}`, due: dueAt(c, prelims ?? undefined, readyMinutes) }];
      }
      case "warm_up": {
        const at = tapped(c, round);
        return [{ key: c.id, label: "Warm-up", done: at && `Started ${time(at)}`, due: slot?.warm_up_at ?? null, where: slot?.warm_up_location, at: true }];
      }
      case "gate": {
        const at = tapped(c, round);
        const performed = tapped(c, round, true);
        return [
          { key: c.id, label: `At ${c.name}`, done: at && `Here ${time(at)}`, due: slot?.perform_at ? readyAt(slot.perform_at, ready) : null },
          { key: `${c.id}-performed`, label: "Perform", done: performed && `Done ${time(performed)}`, due: slot?.perform_at ?? null, at: true },
        ];
      }
    }
  });
  const next = steps.find((s) => !s.done);

  return (
    <Card className="mt-6 border-brand">
      <h2 className="font-semibold">Contest day{round === "finals" ? " · 🏆 Finals" : ""}</h2>
      {band.scratched_at ? (
        <p className="mt-2 text-sm">Your band is marked as withdrawn. If that&apos;s not right, contact the host.</p>
      ) : (
        <>
          {band.equipment_spot != null && (
            <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm">
              Your equipment is in <span className="font-semibold">Spot {band.equipment_spot}</span>.
            </p>
          )}
          {band.away_at && (
            <p className="mt-3 text-sm text-muted">You&apos;re marked as away. Check in with parking when you&apos;re back.</p>
          )}
          <p className="mt-3 text-lg font-semibold">
            {next
              ? `Next: ${next.label}${next.due ? ` ${next.at ? "at" : "by"} ${time(next.due)}` : ""}${next.where ? ` · ${next.where}` : ""}`
              : round === "finals"
                ? "You've performed in the finals. Congratulations! 🎉"
                : "You've performed. Thank you! 🎉"}
          </p>
          <ol className="mt-3 space-y-2">
            {steps.map((s, i) => (
              <li key={s.key} className="flex items-start gap-3 text-sm">
                <span
                  aria-hidden
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    s.done ? "border-success bg-success text-success-foreground" : s === next ? "border-brand text-brand" : "border-border text-muted"
                  }`}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={s === next ? "font-semibold" : "font-medium"}>{s.label}</span>
                  <span className="block text-muted">
                    {s.done ?? [s.due ? `${s.at ? "At" : "By"} ${time(s.due)}` : null, s.where].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">Updates as the host&apos;s team checks you in.</p>
        </>
      )}
    </Card>
  );
}
