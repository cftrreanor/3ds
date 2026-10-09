import { DayStatusBanner } from "@/components/day-status";
import { Card } from "@/components/ui";
import type { BandDay } from "@/lib/contest-day";
import { bandSteps, dayStatus, type DayTimes, type ProgressRow } from "@/lib/director-day";

export type { ProgressRow };

/**
 * On contest day: where the director's band is along the check-in path, what's
 * next and by when (at a glance, in colour), and their equipment spot. Steps
 * follow the host's order.
 */
export function ContestDayCard({
  band,
  rows,
  prelims,
  finals,
  readyMinutes,
  finalsReadyMinutes,
  time,
  phone,
}: {
  band: BandDay & { band_name: string };
  rows: ProgressRow[];
  prelims: DayTimes;
  /** Only once the finalists are revealed. */
  finals: DayTimes;
  readyMinutes: number;
  finalsReadyMinutes: number;
  time: (iso: string) => string;
  /** The host's number, offered when the band is running late. */
  phone?: string | null;
}) {
  const { steps, round } = bandSteps({ band, rows, prelims, finals, readyMinutes, finalsReadyMinutes, time });
  const status = dayStatus(steps, new Date(), time);
  const next = status.next;

  return (
    <Card className="mt-6 border-brand">
      <h2 className="font-semibold">Contest day{round === "finals" ? " · 🏆 Finals" : ""}</h2>
      {band.scratched_at ? (
        <p className="mt-2 text-sm">Your band is marked as withdrawn. If that&apos;s not right, contact the host.</p>
      ) : (
        <>
          <div className="mt-3">
            <DayStatusBanner
              status={status}
              phone={phone}
              doneText={round === "finals" ? "You've performed in the finals. Congratulations! 🎉" : "You've performed. Thank you! 🎉"}
            />
          </div>
          {band.equipment_spot != null && (
            <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm">
              Your equipment is in <span className="font-semibold">Spot {band.equipment_spot}</span>.
            </p>
          )}
          {band.away_at && (
            <p className="mt-3 text-sm text-muted">You&apos;re marked as away. Check in with parking when you&apos;re back.</p>
          )}
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
